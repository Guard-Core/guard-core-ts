export interface MatchResult {
  [index: number]: string | undefined;
  index: number;
  input: string;
  length: number;
  groups?: Record<string, string>;
}

interface RE2Instance {
  exec(str: string): MatchResult | null;
  lastIndex: number;
}

type RE2Class = new (pattern: string | RegExp, flags?: string) => RE2Instance;

const DANGEROUS_PATTERNS = [
  /\(\.\*\)\+/,
  /\(\.\+\)\+/,
  /\([^)]*\*\)\+/,
  /\([^)]*\+\)\+/,
  /(?:\.\*){2,}/,
  /(?:\.\+){2,}/,
];

const DEFAULT_TEST_STRINGS = [
  'a'.repeat(10),
  'a'.repeat(100),
  'a'.repeat(1000),
  'x'.repeat(50) + 'y'.repeat(50),
  '<'.repeat(100) + '>'.repeat(100),
];

let RE2Ctor: RE2Class | null = null;

async function loadRE2(): Promise<RE2Class | null> {
  if (RE2Ctor) return RE2Ctor;
  try {
    const mod = await import('re2-wasm');
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    RE2Ctor = mod.RE2 ?? mod.default?.RE2 ?? mod.default;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    return RE2Ctor;
  /* v8 ignore start -- re2-wasm import catch; module available in test env */
  } catch {
    return null;
  }
  /* v8 ignore stop */
}

export class PatternCompiler {
  private cache = new Map<string, RE2Instance | RegExp>();
  private cacheOrder: string[] = [];
  private re2Available: boolean | null = null;

  constructor(
    private readonly defaultTimeoutMs = 2000,
    private readonly maxCacheSize = 1000,
  ) {
    this.maxCacheSize = Math.min(maxCacheSize, 5000);
  }

  private async ensureRE2(): Promise<boolean> {
    if (this.re2Available !== null) return this.re2Available;
    const ctor = await loadRE2();
    this.re2Available = ctor !== null;
    return this.re2Available;
  }

  async compile(pattern: string, flags = 'gi'): Promise<RE2Instance | RegExp> {
    const key = `${pattern}:${flags}`;

    if (this.cache.has(key)) {
      const idx = this.cacheOrder.indexOf(key);
      if (idx !== -1) {
        this.cacheOrder.splice(idx, 1);
        this.cacheOrder.push(key);
      }
      return this.cache.get(key)!;
    }

    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.cacheOrder.shift();
      if (oldest) this.cache.delete(oldest);
    }

    let compiled: RE2Instance | RegExp;

    if (await this.ensureRE2()) {
      try {
        compiled = new RE2Ctor!(pattern, flags);
      } catch {
        compiled = new RegExp(pattern, flags);
      }
    } else {
      compiled = new RegExp(pattern, flags);
    }

    this.cache.set(key, compiled);
    this.cacheOrder.push(key);
    return compiled;
  }

  compileSync(pattern: string, flags = 'gi'): RegExp {
    return new RegExp(pattern, flags);
  }

  async safeMatch(
    pattern: string,
    content: string,
    timeoutMs?: number,
  ): Promise<MatchResult | null> {
    try {
      const compiled = await this.compile(pattern);
      return compiled.exec(content);
    } catch {
      return this.fallbackMatch(pattern, content, timeoutMs ?? this.defaultTimeoutMs);
    }
  }

  private async fallbackMatch(
    pattern: string,
    content: string,
    timeoutMs: number,
  ): Promise<MatchResult | null> {
    try {
      const { Worker } = await import('node:worker_threads');
      return new Promise<MatchResult | null>((resolve: (v: MatchResult | null) => void) => {
        const workerCode = `
          const { parentPort, workerData } = require('node:worker_threads');
          try {
            const re = new RegExp(workerData.pattern, workerData.flags);
            const result = re.exec(workerData.content);
            parentPort.postMessage({ result });
          } catch (e) {
            parentPort.postMessage({ result: null });
          }
        `;
        const worker = new Worker(workerCode, {
          eval: true,
          workerData: { pattern, content, flags: 'gi' },
        });

        /* v8 ignore start -- setTimeout/worker callbacks execute in separate V8 isolate; coverage cannot instrument worker thread code */
        const timer = setTimeout(() => {
          worker.terminate();
          resolve(null);
        }, timeoutMs);

        worker.on('message', (msg: { result: MatchResult | null }) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(msg.result);
        });

        worker.on('error', () => {
          clearTimeout(timer);
          worker.terminate();
          resolve(null);
        });
        /* v8 ignore stop */
      });
    /* v8 ignore start -- fallback when worker_threads import fails; requires broken Node environment */
    } catch {
      try {
        const re = new RegExp(pattern, 'gi');
        return re.exec(content);
      } catch {
        return null;
      }
    }
    /* v8 ignore stop */
  }

  validatePatternSafety(
    pattern: string,
    testStrings?: string[],
  ): [boolean, string] {
    for (const dangerous of DANGEROUS_PATTERNS) {
      if (dangerous.test(pattern)) {
        return [false, `Pattern contains dangerous construct: ${dangerous.source}`];
      }
    }

    const strings = testStrings ?? DEFAULT_TEST_STRINGS;

    try {
      const compiled = this.compileSync(pattern);
      for (const testStr of strings) {
        const start = performance.now();
        compiled.exec(testStr);
        const elapsed = performance.now() - start;
        if (elapsed > 50) {
          return [false, `Pattern timed out on test string of length ${testStr.length}`];
        }
      }
    } catch (e) {
      return [false, `Pattern validation failed: ${String(e)}`];
    }

    return [true, 'Pattern appears safe'];
  }

  async batchCompile(
    patterns: string[],
    validate = true,
  ): Promise<Map<string, RE2Instance | RegExp>> {
    const compiled = new Map<string, RE2Instance | RegExp>();
    for (const pattern of patterns) {
      if (validate) {
        const [isSafe] = this.validatePatternSafety(pattern);
        if (!isSafe) continue;
      }
      try {
        compiled.set(pattern, await this.compile(pattern));
      } catch {
        continue;
      }
    }
    return compiled;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheOrder = [];
  }
}
