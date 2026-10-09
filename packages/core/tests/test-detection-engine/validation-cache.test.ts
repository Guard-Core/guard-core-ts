/* The detection_pattern_validation_cache_path suite: the disk-backed cache
   for the pattern-safety validator's empirical cost-verdict layer, plus the
   fault-injection harness (real temp dirs, injected rename/mkdir failures,
   corrupt payloads) mirroring tests/test_pattern_validation_cache.py. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync as fsMkdir, readFileSync as fsRead, renameSync as fsRename } from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn((...args: Parameters<typeof actual.mkdirSync>) => actual.mkdirSync(...args)),
    renameSync: vi.fn((...args: [string, string]) => actual.renameSync(...args)),
    readFileSync: vi.fn((...args: [string, ...unknown[]]) => actual.readFileSync(...args)),
  };
});

import { PatternCompiler } from '../../src/detection-engine/compiler.js';
import {
  PatternValidationCache,
  ENGINE_VERSION,
  engineVersion,
} from '../../src/detection-engine/validation-cache.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { createTestConfig } from '../helpers.js';
import type { Logger } from '../../src/models/logger.js';

function captureLogger(): Logger & { warns: string[] } {
  const warns: string[] = [];
  return {
    info: () => {},
    warn: (m: string) => { warns.push(m); },
    error: () => {},
    debug: () => {},
    warns,
  };
}

function entry(safe: boolean, reason: string): Record<string, unknown> {
  return { safe, reason, version: ENGINE_VERSION };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'guard-validation-cache-'));
  vi.mocked(fsRename).mockClear();
  vi.mocked(fsMkdir).mockClear();
  vi.mocked(fsRead).mockClear();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('PatternValidationCache', () => {
  it('put then get round-trips', () => {
    const cache = new PatternValidationCache(join(tempDir, 'cache.json'));
    cache.put('a+', 0, true, 'Pattern appears safe');
    expect(cache.get('a+', 0)).toEqual([true, 'Pattern appears safe']);
    expect(cache.size).toBe(1);
  });

  it('the persisted file survives a new instance', async () => {
    const path = join(tempDir, 'cache.json');
    new PatternValidationCache(path).put('(x+x+)+y', 0, false, 'over budget');
    const reopened = new PatternValidationCache(path);
    expect(reopened.get('(x+x+)+y', 0)).toEqual([false, 'over budget']);
  });

  it('a get miss returns null', () => {
    const cache = new PatternValidationCache(join(tempDir, 'cache.json'));
    expect(cache.get('never-seen', 0)).toBeNull();
  });

  it('flags are part of the key', () => {
    const cache = new PatternValidationCache(join(tempDir, 'cache.json'));
    cache.put('x', 0, true, 'safe under flag 0');
    expect(cache.get('x', 8)).toBeNull();
  });

  it('stale engine-version entries are dropped', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, JSON.stringify({ k: { safe: true, reason: 'stale', version: '0.0.1' } }), 'utf-8');
    const cache = new PatternValidationCache(path);
    expect(cache.size).toBe(0);
    expect(cache.get('anything', 0)).toBeNull();
  });

  it('entries carry the current engine version', async () => {
    const path = join(tempDir, 'cache.json');
    new PatternValidationCache(path).put('v+', 0, true, 'ok');
    const stored = JSON.parse(await readFile(path, 'utf-8')) as Record<string, { version: string }>;
    const values = Object.values(stored);
    expect(values.length).toBe(1);
    expect(values[0]['version']).toBe(ENGINE_VERSION);
    expect(engineVersion()).toBe('4.3.2');
  });

  it('a corrupt cache starts empty and recovers', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, '{not json', 'utf-8');
    const logger = captureLogger();
    const cache = new PatternValidationCache(path, logger);
    expect(cache.size).toBe(0);
    cache.put('b+', 0, true, 'ok');
    expect(cache.get('b+', 0)).toEqual([true, 'ok']);
    const reopened = new PatternValidationCache(path);
    expect(reopened.get('b+', 0)).toEqual([true, 'ok']);
    expect(logger.warns.some((m) => m.includes('Pattern validation cache corrupt, starting empty'))).toBe(true);
  });

  it('a non-object cache root starts empty', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, '[1, 2]', 'utf-8');
    const cache = new PatternValidationCache(path);
    expect(cache.size).toBe(0);
  });

  it('an entry without a boolean verdict starts the cache empty', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, JSON.stringify({ k: { safe: 'yes', reason: 'x', version: ENGINE_VERSION } }), 'utf-8');
    const cache = new PatternValidationCache(path);
    expect(cache.size).toBe(0);
  });

  it('an entry without a reason string starts the cache empty', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, JSON.stringify({ k: { safe: true, version: ENGINE_VERSION } }), 'utf-8');
    const cache = new PatternValidationCache(path);
    expect(cache.size).toBe(0);
  });

  it('a non-object cache entry starts the cache empty', async () => {
    const path = join(tempDir, 'cache.json');
    await writeFile(path, JSON.stringify({ k: 'not-an-entry' }), 'utf-8');
    const cache = new PatternValidationCache(path);
    expect(cache.size).toBe(0);
  });

  it('an unreadable cache file (non-ENOENT) is a warning and an empty cache', async () => {
    const path = join(tempDir, 'cache.json');
    vi.mocked(fsRead).mockImplementationOnce(() => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    });
    const logger = captureLogger();
    const cache = new PatternValidationCache(path, logger);
    expect(cache.size).toBe(0);
    expect(logger.warns.some((m) => m.includes('Pattern validation cache unreadable, ignoring'))).toBe(true);
  });

  it('an unreadable cache file is a warning and an empty cache', async () => {
    const path = join(tempDir, 'missing-dir', 'cache.json');
    vi.mocked(fsMkdir).mockImplementationOnce(() => {
      throw new Error('EACCES: read-only filesystem');
    });
    const logger = captureLogger();
    const cache = new PatternValidationCache(path, logger);
    cache.put('c+', 0, true, 'ok');
    expect(logger.warns.some((m) => m.includes('Pattern validation cache write failed'))).toBe(true);
  });

  it('the write is atomic with no tmp leftovers', async () => {
    const path = join(tempDir, 'cache.json');
    const cache = new PatternValidationCache(path);
    cache.put('c+', 0, true, 'ok');
    const leftovers = (await readdir(tempDir)).filter((n) => n !== 'cache.json');
    expect(leftovers).toEqual([]);
    expect(JSON.parse(await readFile(path, 'utf-8'))).toBeTruthy();
  });

  it('a failed atomic replace warns, cleans the temp file, and keeps the in-memory entry', async () => {
    const path = join(tempDir, 'cache.json');
    vi.mocked(fsRename).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const logger = captureLogger();
    const cache = new PatternValidationCache(path, logger);
    cache.put('c+', 0, true, 'ok');
    expect(cache.get('c+', 0)).toEqual([true, 'ok']);
    const leftovers = (await readdir(tempDir)).filter((n) => n.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    expect(logger.warns.some((m) => m.includes('Pattern validation cache write failed'))).toBe(true);
  });

  it('a later put persists entries the failed write dropped', async () => {
    const path = join(tempDir, 'cache.json');
    vi.mocked(fsRename).mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const cache = new PatternValidationCache(path);
    cache.put('first+', 0, true, 'ok');
    cache.put('second+', 0, true, 'ok');
    const reopened = new PatternValidationCache(path);
    expect(reopened.get('first+', 0)).toEqual([true, 'ok']);
    expect(reopened.get('second+', 0)).toEqual([true, 'ok']);
  });
});

describe('PatternCompiler validation-cache integration', () => {
  it('uses the cache and skips the cost verdict on a hit', () => {
    const path = join(tempDir, 'cache.json');
    const warm = new PatternValidationCache(path);
    warm.put('hello world', 'gi', true, 'Pattern appears safe');

    const compiler = new PatternCompiler(2000, 1000, warm);
    const probe = vi.spyOn(
      compiler as unknown as { probeCostVerdict: () => [boolean, string] },
      'probeCostVerdict',
    ).mockImplementation(() => {
      throw new Error('the empirical cost verdict must not run on a hit');
    });

    const [safe, reason] = compiler.validatePatternSafety('hello world');
    expect(safe).toBe(true);
    expect(reason).toBe('Pattern appears safe');
    expect(probe).not.toHaveBeenCalled();
  });

  it('populates the cache on a miss', async () => {
    const path = join(tempDir, 'cache.json');
    const cache = new PatternValidationCache(path);
    const compiler = new PatternCompiler(2000, 1000, cache);

    const [safe] = compiler.validatePatternSafety('\\d{3}-\\d{4}');
    expect(safe).toBe(true);
    expect(cache.size).toBe(1);
    const reopened = new PatternValidationCache(path);
    expect(reopened.get('\\d{3}-\\d{4}', 'gi')).not.toBeNull();
  });

  it('the deterministic layers always re-run, even on a warm cache', () => {
    const path = join(tempDir, 'cache.json');
    // An over-length pattern exercises the deterministic layer without
    // synthesizing a catastrophic regex (CodeQL js/regular-expressions).
    const oversized = 'a'.repeat(2000);
    const warm = new PatternValidationCache(path);
    warm.put(oversized, 'gi', true, 'stale certification');

    const compiler = new PatternCompiler(2000, 1000, warm);
    const [safe, reason] = compiler.validatePatternSafety(oversized);
    expect(safe).toBe(false);
    expect(reason).toContain('exceeds maximum validated length');
  });

  it('caller-supplied probes run live and bypass the cache', () => {
    const path = join(tempDir, 'cache.json');
    const cache = new PatternValidationCache(path);
    cache.put('hello', 'gi', false, 'would be wrong to trust here');
    const compiler = new PatternCompiler(2000, 1000, cache);

    const [safe, reason] = compiler.validatePatternSafety('hello', ['hello world']);
    expect(safe).toBe(true);
    expect(reason).toBe('Pattern appears safe');
    expect(cache.size).toBe(1);
  });

  it('a compile failure is deterministic and never cached', () => {
    const path = join(tempDir, 'cache.json');
    const cache = new PatternValidationCache(path);
    const compiler = new PatternCompiler(2000, 1000, cache);
    const [safe, reason] = compiler.validatePatternSafety('([)');
    expect(safe).toBe(false);
    expect(reason).toContain('Pattern validation failed');
    expect(cache.size).toBe(0);
  });

  it('works without a cache (the previous behavior)', () => {
    const compiler = new PatternCompiler();
    const [safe] = compiler.validatePatternSafety('a+');
    expect(safe).toBe(true);
  });
});

describe('SusPatternsManager validation-cache wiring', () => {
  it('addPattern populates the disk cache when the path is configured', async () => {
    const path = join(tempDir, 'cache.json');
    const config = createTestConfig({ detectionPatternValidationCachePath: path });
    const manager = new SusPatternsManager(config, captureLogger());

    await manager.addPattern('\\d{3}-\\d{4}');

    const reopened = new PatternValidationCache(path);
    expect(reopened.get('\\d{3}-\\d{4}', 'gi')).not.toBeNull();
  });

  it('a warm cache entry short-circuits the cost verdict for addPattern', async () => {
    const path = join(tempDir, 'cache.json');
    const warm = new PatternValidationCache(path);
    warm.put('\\d{3}-\\d{4}', 'gi', true, 'Pattern appears safe');

    const config = createTestConfig({ detectionPatternValidationCachePath: path });
    const manager = new SusPatternsManager(config, captureLogger());
    const compiler = (manager as unknown as { compiler: PatternCompiler }).compiler;
    const probe = vi.spyOn(
      compiler as unknown as { probeCostVerdict: () => [boolean, string] },
      'probeCostVerdict',
    ).mockImplementation(() => {
      throw new Error('the empirical cost verdict must not run on a hit');
    });

    await manager.addPattern('\\d{3}-\\d{4}');

    expect(probe).not.toHaveBeenCalled();
  });

  it('no disk cache without the config path (the default)', () => {
    const config = createTestConfig();
    const manager = new SusPatternsManager(config, captureLogger());
    const compiler = (manager as unknown as { compiler: PatternCompiler }).compiler;
    expect((compiler as unknown as { validationCache: unknown }).validationCache).toBeNull();
  });
});
