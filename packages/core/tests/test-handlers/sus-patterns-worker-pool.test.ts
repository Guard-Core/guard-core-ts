import { afterAll, describe, expect, test } from 'vitest';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';

/* Real-worker integration for the detectionScanWorkerPool knob: verdict
 * parity between the inline (default) path and the opt-in worker path over
 * threat and benign content. The workers are real node:worker_threads
 * workers; the pool is closed through reset() so the test process can exit. */

describe('detectionScanWorkerPool verdict parity', () => {
  const configs = [
    { name: 'inline', config: SecurityConfigSchema.parse({}) },
    { name: 'worker', config: SecurityConfigSchema.parse({ detectionScanWorkerPool: true }) },
  ];
  const managers = new Map<string, SusPatternsManager>(
    configs.map(({ name, config }) => [name, new SusPatternsManager(config, defaultLogger)]),
  );

  afterAll(async () => {
    for (const manager of managers.values()) {
      await manager.reset();
    }
  });

  const contents: Array<{ content: string; context: string; threat: boolean }> = [
    { content: '<script>alert(1)</script>', context: 'request_body', threat: true },
    { content: "1' OR '1'='1", context: 'query_param', threat: true },
    /* Single sqli row hit: weight 0.5 is below detectionThreatScoreThreshold
       (1.0), so the verdict stays no-threat on both paths. */
    { content: 'SELECT password FROM users', context: 'request_body', threat: false },
    { content: 'attack-test-string-123', context: 'request_body', threat: false },
    { content: 'The quick brown fox jumps over the lazy dog', context: 'request_body', threat: false },
  ];

  for (const { content, context, threat } of contents) {
    test(`worker path matches the inline verdict for ${JSON.stringify(content.slice(0, 30))}`, async () => {
      const inline = await (managers.get('inline') as SusPatternsManager).detect(content, '203.0.113.7', context);
      const worker = await (managers.get('worker') as SusPatternsManager).detect(content, '203.0.113.7', context);
      expect(worker.isThreat).toBe(inline.isThreat);
      expect(worker.isThreat).toBe(threat);
      expect(worker.threatScore).toBeCloseTo(inline.threatScore, 6);
      expect(worker.threats.map((t) => [t.pattern, t.matchedContent])).toEqual(
        inline.threats.map((t) => [t.pattern, t.matchedContent]),
      );
      expect(worker.timeouts).toEqual([]);
    });
  }

  test('the worker pool terminates with the manager reset', async () => {
    const manager = managers.get('worker') as SusPatternsManager;
    await manager.detect('ping', '203.0.113.7', 'request_body');
    /* reset() closes the pool; a second reset is a no-op on the pool. */
    await manager.reset();
    const result = await manager.detect('ping', '203.0.113.7', 'request_body');
    expect(result.isThreat).toBe(false);
  });
});
