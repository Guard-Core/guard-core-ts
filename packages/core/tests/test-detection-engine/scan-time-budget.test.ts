import { describe, it, expect, vi } from 'vitest';

import { ScanTimeBudget, yieldToEventLoop } from '../../src/detection-engine/scan-pool.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockRequest, createTestConfig } from '../helpers.js';
import { scanRequestWithManager } from '../../src/utils.js';

const BUDGET_PATTERN = 'scan_time_budget_exhausted';

function manager(overrides: Record<string, unknown> = {}): SusPatternsManager {
  return new SusPatternsManager(createTestConfig(overrides), defaultLogger);
}

describe('detectionMaxScanSeconds config field', () => {
  it('defaults to 10 and enforces the 0.1 to 60 bounds', () => {
    expect(createTestConfig().detectionMaxScanSeconds).toBe(10.0);
    expect(createTestConfig({ detectionMaxScanSeconds: 0.1 }).detectionMaxScanSeconds).toBe(0.1);
    expect(createTestConfig({ detectionMaxScanSeconds: 60 }).detectionMaxScanSeconds).toBe(60);
    for (const bad of [0, 0.09, 60.1]) {
      expect(() => createTestConfig({ detectionMaxScanSeconds: bad })).toThrow();
    }
  });
});

describe('ScanTimeBudget', () => {
  it('is unbounded without a cap', () => {
    const budget = new ScanTimeBudget();
    budget.record(1e6);
    expect(budget.exhausted).toBe(false);
  });

  it('tracks recorded time against the cap', () => {
    const budget = new ScanTimeBudget(1.0);
    expect(budget.exhausted).toBe(false);
    budget.record(0.4);
    expect(budget.exhausted).toBe(false);
    budget.record(0.6);
    expect(budget.exhausted).toBe(true);
  });

  it('hands out the cap warning once', () => {
    const budget = new ScanTimeBudget(1.0);
    expect(budget.takeWarning()).toBe(true);
    expect(budget.takeWarning()).toBe(false);
  });

  it('yieldToEventLoop falls back to setTimeout where setImmediate is absent (edge runtimes)', async () => {
    vi.stubGlobal('setImmediate', undefined);
    try {
      await yieldToEventLoop();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('yieldToEventLoop lets a pending I/O-phase callback run', async () => {
    const order: string[] = [];
    setImmediate(() => order.push('immediate'));
    await yieldToEventLoop();
    order.push('after');
    expect(order).toEqual(['immediate', 'after']);
  });
});

describe('per-request scan time budget in the engine', () => {
  it('a spent budget stops the scan and flags the request fail-closed', async () => {
    const m = manager();
    const scanTime = new ScanTimeBudget(0.1);
    scanTime.record(1.0);
    const result = await m.detect('hello world', '127.0.0.1', 'query_param:q', null, { scanTime });

    const budgetThreats = result.threats.filter((t) => t.pattern === BUDGET_PATTERN);
    expect(budgetThreats.length).toBeGreaterThan(0);
    expect(budgetThreats[0]?.detectionMethod).toBe('pattern_timeout');
    expect(result.timeouts).toContain(BUDGET_PATTERN);
    expect(result.isThreat).toBe(true);
    expect(result.threatScore).toBeGreaterThanOrEqual(createTestConfig().detectionThreatScoreThreshold);
  });

  it('the budget is shared across the fields of one request', async () => {
    const m = manager();
    const scanTime = new ScanTimeBudget(0.1);
    const first = await m.detect('hello', '127.0.0.1', 'query_param:a', null, { scanTime });
    expect(first.threats.some((t) => t.pattern === BUDGET_PATTERN)).toBe(false);

    scanTime.record(1.0);
    const second = await m.detect('world', '127.0.0.1', 'query_param:b', null, { scanTime });
    expect(second.threats.some((t) => t.pattern === BUDGET_PATTERN)).toBe(true);
    expect(second.isThreat).toBe(true);
  });

  it('a request without a budget scans every pattern and is not flagged', async () => {
    const result = await manager().detect('hello world', '127.0.0.1', 'query_param:q');
    expect(result.isThreat).toBe(false);
    expect(result.timeouts).not.toContain(BUDGET_PATTERN);
  });

  it('names the budget in the trigger when it tips the request over the threshold', async () => {
    const cfg = createTestConfig({ detectionMaxScanSeconds: 0.1 });
    const m = new SusPatternsManager(cfg, defaultLogger);
    for (let i = 0; i < 150; i++) await m.addPattern(`[a-z ]+zzz${i}q`);
    const queryParams: Record<string, string> = {};
    for (let i = 0; i < 200; i++) queryParams[`p${i}`] = 'the quick brown fox jumps over the lazy dog '.repeat(2);
    const [isThreat, info] = await scanRequestWithManager(m, createMockRequest({ queryParams }), cfg);
    expect(isThreat).toBe(true);
    expect(info).toContain("Pattern exceeded scan time budget: 'scan_time_budget_exhausted'");
  });

  it('keeps a real match first and appends the timeout behind it', async () => {
    const cfg = createTestConfig();
    const m = new SusPatternsManager(cfg, defaultLogger);
    // Exhausted only after the main pass, so the raw-view pass adds the timeout.
    const allowed = m.getAllPatterns().length + 5;
    class LateBudget extends ScanTimeBudget {
      private checks = 0;
      override get exhausted(): boolean { return ++this.checks > allowed; }
    }
    const result = await m.detect('select name from users', '127.0.0.1', 'query_param:q', null, { scanTime: new LateBudget() });
    expect(result.threats[0]?.detectionMethod).toBe('regex');
    expect(result.threats.some((t) => t.detectionMethod === 'pattern_timeout')).toBe(true);

  });

  it('appends a later timeout to the first threat in the trigger text', async () => {
    const stub = {
      detect: async () => ({
        isThreat: true,
        threats: [
          { pattern: 'a', context: 'query_param', matchedContent: 'x', detectionMethod: 'regex' },
          { pattern: 'slow', context: 'query_param', matchedContent: '', detectionMethod: 'pattern_timeout' },
        ],
      }),
    } as unknown as SusPatternsManager;
    const [, info] = await scanRequestWithManager(stub, createMockRequest({ queryParams: { q: 'v' } }));
    expect(info).toBe("Query param name 'q': Value matched pattern 'a'; Pattern exceeded scan time budget: 'slow'");
  });

  it('the request scan stops once the configured cap is spent by padded values', async () => {
    const cfg = createTestConfig({ detectionMaxScanSeconds: 0.1 });
    const m = new SusPatternsManager(cfg, defaultLogger);
    // Slow custom patterns pad the per-pattern time until the cap is spent.
    for (let i = 0; i < 150; i++) await m.addPattern(`[a-z ]+zzz${i}q`);
    const queryParams: Record<string, string> = {};
    for (let i = 0; i < 200; i++) queryParams[`p${i}`] = 'the quick brown fox jumps over the lazy dog '.repeat(2);
    const [isThreat, info] = await scanRequestWithManager(m, createMockRequest({ queryParams }), cfg);
    expect(isThreat).toBe(true);
    expect(info).toContain(BUDGET_PATTERN);
  });
});

describe('event loop yielding during a scan', () => {
  it('other callbacks run while one request is still scanning', async () => {
    const cfg = createTestConfig();
    const m = new SusPatternsManager(cfg, defaultLogger);
    for (let i = 0; i < 100; i++) await m.addPattern(`[a-z ]+zzz${i}q`);
    const queryParams: Record<string, string> = {};
    for (let i = 0; i < 100; i++) queryParams[`p${i}`] = 'the quick brown fox jumps over the lazy dog '.repeat(3);

    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 1);
    const scan = scanRequestWithManager(m, createMockRequest({ queryParams }), cfg);
    let scanDone = false;
    void scan.then(() => { scanDone = true; });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const ticksWhileScanning = scanDone ? -1 : ticks;
    await scan;
    clearInterval(timer);

    expect(ticksWhileScanning).toBeGreaterThan(0);
  });
});
