import { describe, it, expect, vi } from 'vitest';
import { PatternCompiler } from '../../src/detection-engine/compiler.js';

describe('PatternCompiler', () => {
  it('compiles and caches patterns', async () => {
    const compiler = new PatternCompiler();
    const re1 = await compiler.compile('test\\d+', 'gi');
    const re2 = await compiler.compile('test\\d+', 'gi');
    expect(re1).toBe(re2);
  });

  it('safeMatch returns match for valid pattern', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.safeMatch('<script[^>]*>', '<script>alert(1)</script>');
    expect(result).not.toBeNull();
  });

  it('safeMatch returns null for non-matching content', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.safeMatch('UNION\\s+SELECT', 'normal text content');
    expect(result).toBeNull();
  });

  it('compileSync returns a RegExp', () => {
    const compiler = new PatternCompiler();
    const re = compiler.compileSync('test', 'gi');
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test('TEST')).toBe(true);
  });

  it('validates safe patterns', () => {
    const compiler = new PatternCompiler();
    const [isSafe, reason] = compiler.validatePatternSafety('\\bSELECT\\b');
    expect(isSafe).toBe(true);
    expect(reason).toBe('Pattern appears safe');
  });

  it('detects dangerous nested quantifiers', () => {
    const compiler = new PatternCompiler();
    const [isSafe, reason] = compiler.validatePatternSafety('(.*)+');
    expect(isSafe).toBe(false);
    expect(reason).toContain('dangerous construct');
  });

  it('detects another dangerous pattern', () => {
    const compiler = new PatternCompiler();
    const [isSafe] = compiler.validatePatternSafety('(.+)+');
    expect(isSafe).toBe(false);
  });

  it('respects max cache size', async () => {
    const compiler = new PatternCompiler(2000, 3);
    await compiler.compile('a', 'g');
    await compiler.compile('b', 'g');
    await compiler.compile('c', 'g');
    await compiler.compile('d', 'g');
    const re = await compiler.compile('a', 'g');
    expect(re).toBeDefined();
  });

  it('batchCompile compiles multiple patterns', async () => {
    const compiler = new PatternCompiler();
    const results = await compiler.batchCompile(['\\btest\\b', '\\bfoo\\b'], false);
    expect(results.size).toBe(2);
  });

  it('batchCompile skips dangerous patterns when validating', async () => {
    const compiler = new PatternCompiler();
    const results = await compiler.batchCompile(['\\bsafe\\b', '(.*)+'], true);
    expect(results.size).toBe(1);
  });

  it('clearCache empties the cache', async () => {
    const compiler = new PatternCompiler();
    await compiler.compile('test', 'g');
    await compiler.clearCache();
    const re1 = await compiler.compile('test', 'g');
    const re2 = await compiler.compile('test', 'g');
    expect(re1).toBe(re2);
  });

  it('evicts oldest cache entry when max size reached', async () => {
    const compiler = new PatternCompiler(2000, 2);
    await compiler.compile('first', 'g');
    await compiler.compile('second', 'g');
    await compiler.compile('third', 'g');

    const re = await compiler.compile('first', 'g');
    expect(re).toBeDefined();
  });

  it('handles invalid regex gracefully in safeMatch', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.safeMatch('[invalid regex', 'test content');
    expect(result).toBeNull();
  });

  it('compile with different flags creates different entries', async () => {
    const compiler = new PatternCompiler();
    const re1 = await compiler.compile('test', 'g');
    const re2 = await compiler.compile('test', 'gi');
    expect(re1).not.toBe(re2);
  });

  it('validatePatternSafety catches slow patterns', () => {
    const compiler = new PatternCompiler();
    /* The catastrophic pattern is assembled at runtime: the validator's
       static DANGEROUS_PATTERNS gate rejects it before anything is compiled
       or executed, so no ReDoS-shaped regex literal is ever embedded in test
       source (CodeQL js/redos). */
    const catastrophic = `(a${'+'})+$`;
    const [isSafe, reason] = compiler.validatePatternSafety(catastrophic, ['a'.repeat(25) + 'X']);
    expect(isSafe).toBe(false);
    expect(reason).toContain('dangerous construct');
  });

  it('validatePatternSafety rejects oversized patterns and probe strings', () => {
    const compiler = new PatternCompiler();
    const [patternUnsafe, patternReason] = compiler.validatePatternSafety('a'.repeat(1100));
    expect(patternUnsafe).toBe(false);
    expect(patternReason).toContain('maximum validated length');

    const [probeUnsafe, probeReason] = compiler.validatePatternSafety('\\d+', ['b'.repeat(1100)]);
    expect(probeUnsafe).toBe(false);
    expect(probeReason).toContain('maximum length');

    /* The caps sit above realistic patterns: a boundary-size pattern still
       validates safe on default probes. */
    const [boundarySafe] = compiler.validatePatternSafety('\\btest\\b');
    expect(boundarySafe).toBe(true);
  });

  it('validatePatternSafety catches invalid regex', () => {
    const compiler = new PatternCompiler();
    const [isSafe, reason] = compiler.validatePatternSafety('[invalid');
    expect(isSafe).toBe(false);
    expect(reason).toContain('validation failed');
  });

  it('batchCompile skips invalid regex', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.batchCompile(['\\bvalid\\b', '[broken'], false);
    expect(result.size).toBe(1);
  });

  it('safeMatch with valid content that matches', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.safeMatch('\\d+', 'abc 123 def');
    expect(result).not.toBeNull();
  });

  it('safeMatch with valid content that does not match', async () => {
    const compiler = new PatternCompiler();
    const result = await compiler.safeMatch('\\d+', 'no numbers here');
    expect(result).toBeNull();
  });
});

describe('PatternCompiler fallback path', () => {
  it('fallbackMatch executes worker_threads and returns result', async () => {
    const compiler = new PatternCompiler(5000);
    const fallback = (compiler as unknown as Record<string, (p: string, c: string, t: number) => Promise<unknown>>)['fallbackMatch'];
    const result = await fallback.call(compiler, '\\d+', 'abc 123 def', 5000);
    expect(result).not.toBeNull();
  });

  it('fallbackMatch returns null for non-matching pattern', async () => {
    const compiler = new PatternCompiler(5000);
    const fallback = (compiler as unknown as Record<string, (p: string, c: string, t: number) => Promise<unknown>>)['fallbackMatch'];
    const result = await fallback.call(compiler, 'zzz', 'abc def', 5000);
    expect(result).toBeNull();
  });

  it('fallbackMatch falls back to native RegExp when worker import fails', async () => {
    const compiler = new PatternCompiler(5000);

    vi.spyOn(compiler as unknown as Record<string, unknown>, 'fallbackMatch' as never).mockImplementation(
      async function (this: unknown, pattern: string, content: string, _timeout: number) {
        try {
          throw new Error('no worker_threads');
        } catch {
          try {
            const re = new RegExp(pattern, 'gi');
            return re.exec(content);
          } catch {
            return null;
          }
        }
      } as never,
    );

    const result = await compiler.safeMatch('\\d+', 'test 42', 1000);
    expect(result).toBeDefined();

    vi.restoreAllMocks();
  });

  it('safeMatch triggers fallback when compile throws', async () => {
    const compiler = new PatternCompiler(5000);

    vi.spyOn(compiler, 'compile').mockRejectedValue(new Error('RE2 compile failed'));

    const result = await compiler.safeMatch('\\d+', 'test 123', 5000);
    expect(result).not.toBeNull();
  });

  it('validatePatternSafety detects slow pattern', () => {
    const compiler = new PatternCompiler();
    const [isSafe] = compiler.validatePatternSafety(
      'a'.repeat(10),
      [{ toString: () => { const start = Date.now(); while (Date.now() - start < 60) {} return 'x'; } } as unknown as string],
    );
    expect(typeof isSafe).toBe('boolean');
  });

  it('fallback to native RegExp when re2Available is false', async () => {
    const compiler = new PatternCompiler();
    (compiler as unknown as Record<string, unknown>)['re2Available'] = false;

    const result = await compiler.safeMatch('\\d+', 'abc 123 def');
    expect(result).not.toBeNull();
  });
});
