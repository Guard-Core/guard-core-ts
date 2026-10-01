import { describe, expect, test, vi } from 'vitest';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { createWorkerScanPool } from '../../src/detection-engine/scan-worker-pool.js';

/* The worker-threads-unavailable fallback: when the runtime has no
 * worker_threads, createWorkerScanPool returns null and the SusPatternsManager
 * stays on the inline deadline path with a single warning. The module mock
 * makes the dynamic import fail exactly like an edge runtime would. */

vi.mock('node:worker_threads', () => {
  throw new Error('worker_threads unavailable in this runtime');
});

describe('worker pool unavailability fallback', () => {
  test('createWorkerScanPool returns null when worker_threads cannot load', async () => {
    const pool = await createWorkerScanPool(1000);
    expect(pool).toBeNull();
  });

  test('an enabled manager falls back to the inline path with one warning', async () => {
    const warn = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
    const config = SecurityConfigSchema.parse({ detectionScanWorkerPool: true });
    const manager = new SusPatternsManager(config, defaultLogger);
    const result = await manager.detect('<script>alert(1)</script>', '203.0.113.7', 'request_body');
    expect(result.isThreat).toBe(true);
    expect(result.threats.length).toBeGreaterThan(0);
    expect(result.timeouts).toEqual([]);
    const fallbackWarnings = warn.mock.calls.filter((call) =>
      String(call[0]).includes('worker threads are unavailable'),
    );
    expect(fallbackWarnings).toHaveLength(1);
    warn.mockRestore();
    await manager.reset();
  });
});
