import { PatternValidationCache } from './validation-cache.js';

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

/* Explicit bounds for the safety probe. validatePatternSafety executes a
   library-supplied pattern synchronously, and CodeQL (js/polynomial-redos)
   flags an unbounded exec() of non-literal regex source. Both inputs are
   capped far above any realistic detection pattern (the sus-pattern corpus
   peaks well under 200 chars; the longest default probe is 1000), which
   bounds the probe's worst case to a constant and keeps the timing
   heuristic meaningful. */
const MAX_VALIDATED_PATTERN_LENGTH = 1024;
const MAX_PROBE_STRING_LENGTH = 1000;

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
  /* The optional disk-backed cost-verdict cache (the reference
     _validation_cache constructor seam): consulted by validatePatternSafety
     on the default empirical layer, never on caller-supplied probes. */
  private readonly validationCache: PatternValidationCache | null;

  constructor(
    private readonly defaultTimeoutMs = 2000,
    private readonly maxCacheSize = 1000,
    validationCache: PatternValidationCache | null = null,
  ) {
    this.maxCacheSize = Math.min(maxCacheSize, 5000);
    this.validationCache = validationCache;
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
    flags = 'gi',
  ): [boolean, string] {
    /* The deterministic layers (the reference dangerous-construct + compile
       checks) are pure syntax analysis and always re-run, cache or no
       cache. */
    if (pattern.length > MAX_VALIDATED_PATTERN_LENGTH) {
      return [false, `Pattern exceeds maximum validated length of ${MAX_VALIDATED_PATTERN_LENGTH}`];
    }

    for (const dangerous of DANGEROUS_PATTERNS) {
      if (dangerous.test(pattern)) {
        return [false, `Pattern contains dangerous construct: ${dangerous.source}`];
      }
    }

    try {
      this.compileSync(pattern, flags);
    } catch (e) {
      return [false, `Pattern validation failed: ${String(e)}`];
    }

    /* Caller-supplied probes run live and bypass the cache (the reference
       test_strings arm); the default empirical cost verdict consults the
       disk cache first so a boot reuses prior certifications. */
    if (testStrings !== undefined) {
      return this.probeCostVerdict(pattern, flags, testStrings);
    }

    if (this.validationCache !== null) {
      const cached = this.validationCache.get(pattern, flags);
      if (cached !== null) return cached;
    }

    const verdict = this.probeCostVerdict(pattern, flags, DEFAULT_TEST_STRINGS);
    if (this.validationCache !== null) {
      this.validationCache.put(pattern, flags, verdict[0], verdict[1]);
    }
    return verdict;
  }

  /* The empirical cost-verdict layer (the reference probe synthesis + timed
     probes): the timed exec loop over the probe strings. Kept a private
     seam so tests can prove the cache short-circuits it. */
  private probeCostVerdict(
    pattern: string,
    flags: string,
    strings: string[],
  ): [boolean, string] {
    try {
      const compiled = this.compileSync(pattern, flags);
      for (const testStr of strings) {
        if (testStr.length > MAX_PROBE_STRING_LENGTH) {
          return [false, `Probe test string exceeds maximum length of ${MAX_PROBE_STRING_LENGTH}`];
        }
        const start = performance.now();
        compiled.exec(testStr);
        const elapsed = performance.now() - start;
        if (elapsed > 50) {
          return [false, `Pattern timed out on test string of length ${testStr.length}`];
        }
      }
    /* v8 ignore start -- defensive arm: validatePatternSafety gates compile
       success before the probe, and a compiled RegExp exec answers null
       rather than throwing, so this catch is measured-unreachable (kept for
       the reference's probe-failure contract). */
    } catch (e) {
      return [false, `Pattern validation failed: ${String(e)}`];
    }
    /* v8 ignore stop */

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
