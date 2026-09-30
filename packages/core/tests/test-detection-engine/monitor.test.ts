import { describe, it, expect, vi } from 'vitest';
import { PerformanceMonitor } from '../../src/detection-engine/monitor.js';

describe('PerformanceMonitor', () => {
  it('records and retrieves metrics', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('test-pattern', 0.05, 100, true);

    const report = monitor.getPatternReport('test-pattern');
    expect(report).not.toBeNull();
    expect(report!.totalExecutions).toBe(1);
    expect(report!.totalMatches).toBe(1);
    expect(report!.totalTimeouts).toBe(0);
  });

  it('tracks timeouts separately', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('slow-pattern', 2.0, 500, false, true);

    const report = monitor.getPatternReport('slow-pattern');
    expect(report!.totalTimeouts).toBe(1);
    expect(report!.totalMatches).toBe(0);
  });

  it('calculates average execution time', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('p1', 0.01, 100, true);
    await monitor.recordMetric('p1', 0.03, 100, false);
    await monitor.recordMetric('p1', 0.02, 100, true);

    const report = monitor.getPatternReport('p1');
    expect(report!.avgExecutionTime).toBeCloseTo(0.02, 2);
    expect(report!.maxExecutionTime).toBeCloseTo(0.03, 2);
    expect(report!.minExecutionTime).toBeCloseTo(0.01, 2);
  });

  it('getSlowPatterns returns sorted by avg time', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('fast', 0.001, 100, false);
    await monitor.recordMetric('slow', 0.5, 100, false);
    await monitor.recordMetric('medium', 0.05, 100, false);

    const slow = monitor.getSlowPatterns(2);
    expect(slow).toHaveLength(2);
    expect(slow[0].avgExecutionTime).toBeGreaterThan(slow[1].avgExecutionTime);
  });

  it('getProblematicPatterns detects high timeout rate', async () => {
    const monitor = new PerformanceMonitor();
    for (let i = 0; i < 10; i++) {
      await monitor.recordMetric('timeout-pattern', 0.01, 100, false, i < 5);
    }

    const problematic = monitor.getProblematicPatterns();
    expect(problematic.some(p => p.issue === 'high_timeout_rate')).toBe(true);
  });

  it('getSummaryStats returns aggregate stats', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('p1', 0.01, 100, true);
    await monitor.recordMetric('p2', 0.02, 200, false);

    const summary = monitor.getSummaryStats();
    expect(summary['totalExecutions']).toBe(2);
    expect(summary['matchRate']).toBe(0.5);
    expect(summary['timeoutRate']).toBe(0);
  });

  it('returns empty summary when no metrics', () => {
    const monitor = new PerformanceMonitor();
    const summary = monitor.getSummaryStats();
    expect(summary['totalExecutions']).toBe(0);
  });

  it('registers and calls anomaly callbacks', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.001);
    const callback = vi.fn();
    monitor.registerAnomalyCallback(callback);

    await monitor.recordMetric('p1', 1.0, 100, false, true);
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0]['type']).toBe('timeout');
  });

  it('detects slow execution anomaly', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.05);
    const callback = vi.fn();
    monitor.registerAnomalyCallback(callback);

    await monitor.recordMetric('p1', 0.1, 100, false);
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0]['type']).toBe('slow_execution');
  });

  it('clearStats resets all data', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('p1', 0.01, 100, true);
    await monitor.clearStats();

    expect(monitor.getPatternReport('p1')).toBeNull();
    expect(monitor.getSummaryStats()['totalExecutions']).toBe(0);
  });

  it('removePatternStats removes specific pattern', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('p1', 0.01, 100, true);
    await monitor.recordMetric('p2', 0.01, 100, true);
    await monitor.removePatternStats('p1');

    expect(monitor.getPatternReport('p1')).toBeNull();
    expect(monitor.getPatternReport('p2')).not.toBeNull();
  });

  it('caps tracked patterns at max limit', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.1, 100, 3);
    for (let i = 0; i < 10; i++) {
      await monitor.recordMetric(`pattern-${i}`, 0.01, 100, true);
    }

    const summary = monitor.getSummaryStats();
    expect(Number(summary['totalPatterns'])).toBeLessThanOrEqual(10);
    expect(monitor.getPatternReport('pattern-9')).not.toBeNull();
  });

  it('truncates long pattern names', async () => {
    const monitor = new PerformanceMonitor();
    const longPattern = 'x'.repeat(200);
    await monitor.recordMetric(longPattern, 0.01, 100, true);

    const report = monitor.getPatternReport(longPattern);
    expect(report).not.toBeNull();
    expect(report!.pattern.length).toBeLessThanOrEqual(53);
  });

  it('detects statistical anomaly after enough samples', async () => {
    const monitor = new PerformanceMonitor(2.0, 0.1);
    const callback = vi.fn();
    monitor.registerAnomalyCallback(callback);

    for (let i = 0; i < 20; i++) {
      await monitor.recordMetric('pattern-x', 0.01, 100, false);
    }

    await monitor.recordMetric('pattern-x', 5.0, 100, false);

    const statisticalCalls = callback.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>)['type'] === 'statistical_anomaly',
    );
    expect(statisticalCalls.length).toBeGreaterThan(0);
  });

  it('sends anomaly event to agent handler', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.001);
    const agent = { sendEvent: vi.fn() };

    await monitor.recordMetric('slow', 1.0, 100, false, true, agent as never);
    expect(agent.sendEvent).toHaveBeenCalled();
  });

  it('catches agent error in anomaly dispatch', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.001);
    const agent = { sendEvent: vi.fn().mockRejectedValue(new Error('fail')) };

    await monitor.recordMetric('slow', 1.0, 100, false, true, agent as never);
  });

  it('callback error does not throw', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.001);
    monitor.registerAnomalyCallback(() => { throw new Error('callback fail'); });
    await monitor.recordMetric('p', 1.0, 100, false, true);
  });

  it('getProblematicPatterns finds consistently slow patterns', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.05);
    for (let i = 0; i < 5; i++) {
      await monitor.recordMetric('slow-consistent', 0.1, 100, false);
    }
    const problematic = monitor.getProblematicPatterns();
    expect(problematic.some((p) => p.issue === 'consistently_slow')).toBe(true);
  });

  it('getSlowPatterns returns empty for no metrics', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.getSlowPatterns()).toHaveLength(0);
  });

  it('getProblematicPatterns skips zero-execution patterns', async () => {
    const monitor = new PerformanceMonitor();
    const problematic = monitor.getProblematicPatterns();
    expect(problematic).toHaveLength(0);
  });

  it('records with correlation ID', async () => {
    const monitor = new PerformanceMonitor();
    const agent = { sendEvent: vi.fn() };
    await monitor.recordMetric('p', 0.5, 100, false, true, agent as never, 'corr-123');
    expect(agent.sendEvent).toHaveBeenCalled();
  });

  it('prunes recentTimes when exceeding 100 entries', async () => {
    const monitor = new PerformanceMonitor();
    for (let i = 0; i < 105; i++) {
      await monitor.recordMetric('overflow-pattern', 0.01, 100, false);
    }
    const report = monitor.getPatternReport('overflow-pattern');
    expect(report!.totalExecutions).toBe(105);
  });

  it('creates PatternStats on first record', async () => {
    const monitor = new PerformanceMonitor();
    await monitor.recordMetric('brand-new', 0.05, 200, true);
    const report = monitor.getPatternReport('brand-new');
    expect(report!.totalExecutions).toBe(1);
    expect(report!.avgExecutionTime).toBeCloseTo(0.05, 2);
  });

  describe('recordPoolEvent', () => {
    it('sends the quarantine agent event and sanitized callback data', async () => {
      const monitor = new PerformanceMonitor();
      const agent = { sendEvent: vi.fn() };
      const callback = vi.fn();
      monitor.registerAnomalyCallback(callback);

      await monitor.recordPoolEvent('quarantined', 'p', agent as never, 'corr-1');

      expect(agent.sendEvent).toHaveBeenCalledTimes(1);
      const event = agent.sendEvent.mock.calls[0][0] as Record<string, unknown>;
      expect(event['eventType']).toBe('pattern_pool_quarantined');
      expect(event['actionTaken']).toBe('pool_replaced');
      expect(event['ipAddress']).toBe('system');
      expect((event['metadata'] as Record<string, unknown>)['correlationId']).toBe('corr-1');

      expect(callback).toHaveBeenCalledTimes(1);
      const safe = callback.mock.calls[0][0] as Record<string, unknown>;
      expect(safe['type']).toBe('quarantined');
      expect(safe['pattern']).toBe('p');
      expect(typeof safe['patternHash']).toBe('string');
    });

    it('sends the released agent event', async () => {
      const monitor = new PerformanceMonitor();
      const agent = { sendEvent: vi.fn() };
      await monitor.recordPoolEvent('released', 'p', agent as never);
      const event = agent.sendEvent.mock.calls[0][0] as Record<string, unknown>;
      expect(event['eventType']).toBe('pattern_pool_released');
      expect(event['actionTaken']).toBe('pool_released');
    });

    it('notifies callbacks without an agent handler', async () => {
      const monitor = new PerformanceMonitor();
      const callback = vi.fn();
      monitor.registerAnomalyCallback(callback);
      await monitor.recordPoolEvent('quarantined', 'p');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('swallows agent handler failures', async () => {
      const monitor = new PerformanceMonitor();
      const agent = { sendEvent: vi.fn().mockRejectedValue(new Error('down')) };
      const callback = vi.fn();
      monitor.registerAnomalyCallback(callback);
      await expect(monitor.recordPoolEvent('quarantined', 'p', agent as never)).resolves.toBeUndefined();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('swallows callback failures', async () => {
      const monitor = new PerformanceMonitor();
      monitor.registerAnomalyCallback(() => {
        throw new Error('callback boom');
      });
      await expect(monitor.recordPoolEvent('released', 'p')).resolves.toBeUndefined();
    });
  });
});
