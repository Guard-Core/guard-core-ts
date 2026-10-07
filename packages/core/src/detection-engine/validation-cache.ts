import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

import type { Logger } from '../models/logger.js';

/* Build-time engine version (the TS twin of ENGINE_VERSION in
   guard_core/detection_engine/_validation_cache.py, which reads the
   installed guard-core metadata): tsup and vitest inject the package
   version via `define`; an unbundled runtime falls back to 'unknown'. The
   version rides every cache entry so a boot on a new engine version never
   silently reuses verdicts certified by the old one. */
declare const __GUARDCORE_VERSION__: string | undefined;

export function engineVersion(): string {
  return typeof __GUARDCORE_VERSION__ === 'string'
    ? __GUARDCORE_VERSION__
    : 'unknown';
}

export const ENGINE_VERSION = engineVersion();

export interface ValidationCacheEntry {
  safe: boolean;
  reason: string;
  version: string;
}

/* Disk-backed cache for the pattern-safety validator's expensive layer.

   The deterministic layers (dangerous constructs, compile check) are pure
   syntax analysis and always re-run. Only the empirical cost-verdict
   outcome (probe synthesis + timed probes) is cached, keyed by pattern,
   flags, and engine version: a boot on a degraded host must not spend
   seconds re-timing the same patterns it already certified, and a pattern
   table must never silently reuse a verdict produced by a different engine
   version. Every put persists the whole entry map through an atomic
   same-directory tmp-plus-rename write; a failed write is a warning, never
   an error (the reference _save OSError arm). Corruption (a malformed
   root, a malformed entry, a missing verdict) starts the cache empty: the
   empirical verdict simply re-runs and re-persists. */

export class PatternValidationCache {
  private readonly entries = new Map<string, ValidationCacheEntry>();

  constructor(
    private readonly path: string,
    private readonly logger?: Logger,
  ) {
    this.load();
  }

  /* The sha256 of "pattern\\0flags" (the reference _key; a NUL separator
     keeps "ab"+"c" and "a"+"bc" distinct). */
  key(pattern: string, flags: string | number): string {
    return createHash('sha256').update(`${pattern}\x00${String(flags)}`).digest('hex');
  }

  get(pattern: string, flags: string | number): [boolean, string] | null {
    const entry = this.entries.get(this.key(pattern, flags));
    if (entry === undefined) return null;
    return [entry.safe, entry.reason];
  }

  put(pattern: string, flags: string | number, safe: boolean, reason: string): void {
    this.entries.set(this.key(pattern, flags), {
      safe, reason, version: ENGINE_VERSION,
    });
    this.save();
  }

  get size(): number {
    return this.entries.size;
  }

  /* The reference _load: a missing file is a silent empty cache; an
     unreadable file is a warning; a malformed root or entry starts the
     cache empty. Entries stamped by a different engine version are
     dropped (not an error). */
  private load(): void {
    let raw: string;
    try {
      raw = readFileSync(this.path, 'utf-8');
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return;
      this.warn(`Pattern validation cache unreadable, ignoring: ${String(e)}`);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('cache root is not an object');
      }
      const entries = new Map<string, ValidationCacheEntry>();
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new TypeError('cache entry is not an object');
        }
        const entry = value as Record<string, unknown>;
        if (entry['version'] !== ENGINE_VERSION) continue;
        if (typeof entry['safe'] !== 'boolean') {
          throw new TypeError('cache entry missing safe verdict');
        }
        if (typeof entry['reason'] !== 'string') {
          throw new TypeError('cache entry missing reason');
        }
        entries.set(String(key), {
          safe: entry['safe'],
          reason: entry['reason'],
          version: entry['version'],
        });
      }
      this.entries.clear();
      for (const [key, entry] of entries) this.entries.set(key, entry);
    } catch (e) {
      this.warn(`Pattern validation cache corrupt, starting empty: ${String(e)}`);
    }
  }

  /* The reference _save: the whole entry map lands through a
     same-directory temporary file and an atomic rename, so a crash
     mid-write never truncates the previous cache. Failures are warnings:
     the cache is a speed tier, never a correctness gate. */
  private save(): void {
    const payload = JSON.stringify(
      Object.fromEntries([...this.entries.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
    );
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tempPath = dirname(this.path)
        + `/.validation-cache-${randomUUID()}.tmp`;
      try {
        writeFileSync(tempPath, payload, 'utf-8');
        renameSync(tempPath, this.path);
      } catch (e) {
        try { unlinkSync(tempPath); } catch { /* best-effort cleanup */ }
        throw e;
      }
    } catch (e) {
      this.warn(`Pattern validation cache write failed: ${String(e)}`);
    }
  }

  private warn(message: string): void {
    this.logger?.warn(message);
  }
}
