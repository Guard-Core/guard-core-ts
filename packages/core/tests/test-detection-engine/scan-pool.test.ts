import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ScanPoolSupervisor,
  SCAN_POOL_SIZE,
  DEFAULT_QUARANTINE_COOLDOWN_MS,
  performanceClock,
} from '../../src/detection-engine/scan-pool.js';
import type { ScanPoolClock, ScanPoolEvent } from '../../src/detection-engine/scan-pool.js';

/**
 * Deterministic clock: each call advances by stepMs, so any scan measured
 * between two clock reads overshoots a smaller deadline without doing real
 * waiting. Cooldown expiry is driven with vitest fake timers where the clock
 * is Date-based, per the deterministic-tests rule (no real sleeps).
 */
function callCountClock(stepMs: number): { clock: ScanPoolClock; calls: () => number } {
  let calls = 0;
  return { clock: () => (calls++) * stepMs, calls: () => calls };
}

describe('ScanPoolSupervisor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the reference pool size and cooldown defaults', () => {
    expect(SCAN_POOL_SIZE).toBe(4);
    expect(DEFAULT_QUARANTINE_COOLDOWN_MS).toBe(60_000);
    const supervisor = new ScanPoolSupervisor(2000);
    expect(supervisor.deadline).toBe(2000);
    expect(supervisor.cooldown).toBe(60_000);
    expect(performanceClock()).toBeTypeOf('number');
  });

  it('returns the scan verdict when it completes within the deadline', () => {
    const { clock } = callCountClock(1);
    const supervisor = new ScanPoolSupervisor(2000, 60_000, clock);
    const outcome = supervisor.run('p', () => ['match']);
    expect(outcome.status).toBe('completed');
    expect(outcome.value).toEqual(['match']);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
    expect(supervisor.isActive('p')).toBe(true);
  });

  it('discards the verdict and reports a timeout when the scan overshoots the deadline', () => {
    const { clock } = callCountClock(1000);
    const supervisor = new ScanPoolSupervisor(50, 60_000, clock);
    const outcome = supervisor.run('p', () => ['match']);
    expect(outcome.status).toBe('timeout');
    expect(outcome.value).toBeNull();
    expect(outcome.elapsedMs).toBe(1000);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(1);
    expect(supervisor.isActive('p')).toBe(true);
  });

  it('returns no verdict without touching the counter when the scan throws', () => {
    const { clock } = callCountClock(1000);
    const supervisor = new ScanPoolSupervisor(50, 60_000, clock);
    const outcome = supervisor.run('p', () => {
      throw new Error('boom');
    });
    expect(outcome.status).toBe('error');
    expect(outcome.value).toBeNull();
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
  });

  it('quarantines the pattern on the fourth consecutive timeout', () => {
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => 0);
    supervisor.reportTimeout('p');
    supervisor.reportTimeout('p');
    supervisor.reportTimeout('p');
    expect(supervisor.isActive('p')).toBe(true);
    expect(supervisor.quarantinedPatterns()).toEqual([]);

    expect(supervisor.reportTimeout('p')).toBe(true);
    expect(supervisor.isActive('p')).toBe(false);
    expect(supervisor.quarantinedPatterns()).toEqual(['p']);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
  });

  it('resets the consecutive counter on any successful scan', () => {
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => 0);
    for (let i = 0; i < 3; i++) supervisor.reportTimeout('p');
    supervisor.reportSuccess('p');
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
    for (let i = 0; i < 3; i++) supervisor.reportTimeout('p');
    expect(supervisor.isActive('p')).toBe(true);
    expect(supervisor.reportTimeout('p')).toBe(true);
    expect(supervisor.isActive('p')).toBe(false);
  });

  it('run() reports success and clears prior timeouts on a completed scan', () => {
    let now = 0;
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => now);
    const slowScan = () => {
      now += 1000;
      return null;
    };
    supervisor.run('p', slowScan);
    supervisor.run('p', slowScan);
    supervisor.run('p', slowScan);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(3);
    const ok = supervisor.run('p', () => 'verdict');
    expect(ok.status).toBe('completed');
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
  });

  it('skips the scan for a quarantined pattern', () => {
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => 0);
    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('p');
    const scan = vi.fn(() => 'verdict');
    const outcome = supervisor.run('p', scan);
    expect(outcome.status).toBe('quarantined');
    expect(outcome.value).toBeNull();
    expect(outcome.elapsedMs).toBe(0);
    expect(scan).not.toHaveBeenCalled();
  });

  it('releases the pattern after the cooldown window under fake timers', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const supervisor = new ScanPoolSupervisor(50, 1000, () => Date.now());
    const events: ScanPoolEvent[] = [];
    supervisor.onPoolEvent((event) => events.push(event));

    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('p');
    expect(supervisor.isActive('p')).toBe(false);

    vi.advanceTimersByTime(999);
    expect(supervisor.isActive('p')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(supervisor.isActive('p')).toBe(true);
    expect(supervisor.quarantinedPatterns()).toEqual([]);

    expect(events.map((event) => event.type)).toEqual(['pattern_quarantined', 'pattern_released']);
    expect(events[0]).toMatchObject({
      type: 'pattern_quarantined',
      pattern: 'p',
      consecutiveTimeouts: SCAN_POOL_SIZE,
      cooldownMs: 1000,
    });
    expect(events[1]).toMatchObject({
      type: 'pattern_released',
      pattern: 'p',
      consecutiveTimeouts: 0,
      cooldownMs: 0,
    });
  });

  it('tracks patterns independently', () => {
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => 0);
    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('slow');
    expect(supervisor.isActive('slow')).toBe(false);
    expect(supervisor.isActive('other')).toBe(true);
    const outcome = supervisor.run('other', () => 'verdict');
    expect(outcome.status).toBe('completed');
  });

  it('keeps counting after release and quarantines again on four more timeouts', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const supervisor = new ScanPoolSupervisor(50, 1000, () => Date.now());
    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('p');
    vi.advanceTimersByTime(1001);
    expect(supervisor.isActive('p')).toBe(true);
    for (let i = 0; i < SCAN_POOL_SIZE - 1; i++) supervisor.reportTimeout('p');
    expect(supervisor.isActive('p')).toBe(true);
    expect(supervisor.reportTimeout('p')).toBe(true);
    expect(supervisor.isActive('p')).toBe(false);
  });

  it('emits events to every listener and survives listener errors', () => {
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => 0);
    const seen: string[] = [];
    supervisor.onPoolEvent((event) => {
      throw new Error('listener boom');
    });
    const unsubscribe = supervisor.onPoolEvent((event) => seen.push(event.type));
    supervisor.onPoolEvent((event) => seen.push(event.type));

    supervisor.reportTimeout('p');
    supervisor.reportTimeout('p');
    expect(seen).toEqual([]);

    for (let i = 0; i < SCAN_POOL_SIZE - 1; i++) supervisor.reportTimeout('p');
    expect(seen).toEqual(['pattern_quarantined', 'pattern_quarantined']);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    supervisor.reset();
    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('p');
    // One more quarantine, seen only by the listener that stayed subscribed.
    expect(seen).toEqual(['pattern_quarantined', 'pattern_quarantined', 'pattern_quarantined']);
  });

  it('reset clears counters and quarantines', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const supervisor = new ScanPoolSupervisor(50, 60_000, () => Date.now());
    for (let i = 0; i < SCAN_POOL_SIZE; i++) supervisor.reportTimeout('p');
    supervisor.reportTimeout('q');
    supervisor.reset();
    expect(supervisor.quarantinedPatterns()).toEqual([]);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(0);
    expect(supervisor.consecutiveTimeoutCount('q')).toBe(0);
    expect(supervisor.isActive('p')).toBe(true);
  });

  it('times out a genuinely catastrophic regex against a near-zero deadline on the real clock', () => {
    const supervisor = new ScanPoolSupervisor(0.01, 60_000, performanceClock);
    const outcome = supervisor.run('p', () => /(?:a+)+b/.exec('a'.repeat(22) + 'c'));
    expect(outcome.status).toBe('timeout');
    expect(outcome.value).toBeNull();
    expect(outcome.elapsedMs).toBeGreaterThan(0.01);
    expect(supervisor.consecutiveTimeoutCount('p')).toBe(1);
  });
});
