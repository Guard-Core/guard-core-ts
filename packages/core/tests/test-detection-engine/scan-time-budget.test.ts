import { describe, it, expect, vi } from 'vitest';

import { ScanTimeBudget, cpuSeconds, yieldToEventLoop } from '../../src/detection-engine/scan-pool.js';
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

  it('names the budget in the trigger when it tips the request over the threshold', { timeout: 60_000 }, async () => {
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

  it('the request scan stops once the configured cap is spent by padded values', { timeout: 60_000 }, async () => {
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

describe('the budget counts CPU time, not wall time', () => {
  it('a wall-slow but CPU-cheap scan does not exhaust the budget', async () => {
    const m = manager();
    // Each pattern scan takes ~1 ms of wall time but the injected CPU clock never moves.
    vi.spyOn(m as unknown as { checkRegexPattern: () => null }, 'checkRegexPattern').mockImplementation(() => {
      const end = performance.now() + 1;
      while (performance.now() < end) { /* busy wait */ }
      return null;
    });
    const scanTime = new ScanTimeBudget(0.05, () => 0);
    const wallStart = performance.now();
    const result = await m.detect('hello world', '127.0.0.1', 'query_param:q', null, { scanTime });
    expect(performance.now() - wallStart).toBeGreaterThan(50);
    expect(result.threats.some((t) => t.pattern === BUDGET_PATTERN)).toBe(false);
    expect(result.isThreat).toBe(false);
  });

  it('CPU-heavy scanning still exhausts the budget', async () => {
    const m = manager();
    // Charged at slice boundaries now, so make each scan wall-slow (1 ms) to
    // cross them; the injected CPU clock jumps 1 s on every read.
    vi.spyOn(m as unknown as { checkRegexPattern: () => null }, 'checkRegexPattern').mockImplementation(() => {
      const end = performance.now() + 1;
      while (performance.now() < end) { /* busy wait */ }
      return null;
    });
    let cpu = 0;
    const scanTime = new ScanTimeBudget(0.1, () => (cpu += 1));
    const result = await m.detect('hello world', '127.0.0.1', 'query_param:q', null, { scanTime });
    expect(result.threats.some((t) => t.pattern === BUDGET_PATTERN)).toBe(true);
  });

  it('a pass charges the clock delta at close even when the scan throws', async () => {
    let cpu = 0;
    const scanTime = new ScanTimeBudget(1.0, () => (cpu += 0.6));
    scanTime.openPass();
    try {
      throw new Error('boom');
    } catch {
      // the engine closes the pass from a finally block
    } finally {
      scanTime.closePass();
    }
    expect(scanTime.exhausted).toBe(false);
    scanTime.openPass();
    scanTime.closePass();
    expect(scanTime.exhausted).toBe(true);
  });

  it('never reads the CPU clock without a cap', async () => {
    const clock = vi.fn(() => 0);
    const scanTime = new ScanTimeBudget(Infinity, clock);
    scanTime.openPass();
    await scanTime.suspended(Promise.resolve());
    scanTime.closePass();
    expect(clock).not.toHaveBeenCalled();
  });

  it('reads the CPU clock a few times per pass, not per pattern', async () => {
    const m = manager();
    const scanned = vi.spyOn(m as unknown as { checkRegexPattern: () => null }, 'checkRegexPattern');
    const clock = vi.fn(() => 0);
    const scanTime = new ScanTimeBudget(5, clock);
    await m.detect('hello world', '127.0.0.1', 'query_param:q', null, { scanTime });
    expect(scanned.mock.calls.length).toBeGreaterThan(100);
    expect(clock.mock.calls.length).toBeLessThanOrEqual(2 * 4 + 2 * 4);
    expect(clock.mock.calls.length * 10).toBeLessThan(scanned.mock.calls.length);
  });

  it('a long pass stops within about one slice of the budget', async () => {
    const m = manager();
    let cpu = 0;
    // Each pattern costs 0.5 ms of wall and of fake CPU.
    vi.spyOn(m as unknown as { checkRegexPattern: () => null }, 'checkRegexPattern').mockImplementation(() => {
      const end = performance.now() + 0.5;
      while (performance.now() < end) { /* busy wait */ }
      cpu += 0.0005;
      return null;
    });
    const cap = 0.02;
    const scanTime = new ScanTimeBudget(cap, () => cpu);
    const result = await m.detect('hello world', '127.0.0.1', 'query_param:q', null, { scanTime });
    expect(result.threats.some((t) => t.pattern === BUDGET_PATTERN)).toBe(true);
    // One slice (2 ms) plus one pattern (0.5 ms) of lag, with slack for timer jitter.
    expect(cpu - cap).toBeGreaterThanOrEqual(0);
    expect(cpu - cap).toBeLessThan(0.008);
  });

  it('does not charge another task\'s CPU burned while the pass is suspended', async () => {
    const burn = (ms: number): Promise<void> => new Promise((resolve) => {
      setImmediate(() => {
        const end = performance.now() + ms;
        while (performance.now() < end) { /* busy wait */ }
        resolve();
      });
    });
    const suspendedBudget = new ScanTimeBudget(0.03);
    suspendedBudget.openPass();
    await suspendedBudget.suspended(burn(120));
    suspendedBudget.closePass();
    expect(suspendedBudget.exhausted).toBe(false);

    // Control: the same burn awaited without suspended() is charged.
    const plainBudget = new ScanTimeBudget(0.03);
    plainBudget.openPass();
    await burn(120);
    plainBudget.closePass();
    expect(plainBudget.exhausted).toBe(true);
  });

  it('cpuSeconds reads process CPU time and falls back to wall time without process', () => {
    expect(cpuSeconds()).toBeGreaterThan(0);
    vi.stubGlobal('process', undefined);
    try {
      expect(cpuSeconds()).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
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
