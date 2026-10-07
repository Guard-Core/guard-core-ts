import { describe, it, expect, vi } from 'vitest';
import { SecurityEventBus } from '../../src/core/events/event-bus.js';
import { MetricsCollector } from '../../src/core/events/metrics.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import { defaultLogger } from '../../src/models/logger.js';

describe('SecurityEventBus', () => {
  it('no-ops when agent is null', async () => {
    const bus = new SecurityEventBus(null, createTestConfig(), defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason');
  });

  it('no-ops when events disabled', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: false });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason');
    expect(agent.sendEvent).not.toHaveBeenCalled();
  });

  it('sends event when agent and events enabled', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('ip_blocked', createMockRequest(), 'request_blocked', 'Blocked by policy');
    expect(agent.sendEvent).toHaveBeenCalledTimes(1);
    const event = agent.sendEvent.mock.calls[0][0];
    expect(event.eventType).toBe('ip_blocked');
    expect(event.actionTaken).toBe('request_blocked');
    expect(event.ipAddress).toBe('1.2.3.4');
  });

  it('catches agent errors without throwing', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn().mockRejectedValue(new Error('agent down')) };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason');
  });

  it('sends HTTPS violation event', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendHttpsViolationEvent(createMockRequest({ urlScheme: 'http' }), false);
    expect(agent.sendEvent).toHaveBeenCalled();
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('https_enforced');
  });

  it('sends route-specific HTTPS violation', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendHttpsViolationEvent(createMockRequest({ urlScheme: 'http' }), true);
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('decorator_violation');
  });

  it('sends cloud detection event', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    const sendCloudDetectionEvent = vi.fn();
    const cloudHandler = {
      agentHandler: agent,
      getCloudProviderDetails: () => ['AWS', '203.0.113.0/24'] as [string, string],
      sendCloudDetectionEvent,
    };
    await bus.sendCloudDetectionEvents(createMockRequest(), '1.2.3.4', ['AWS'], null, cloudHandler as never, false);
    expect(sendCloudDetectionEvent).toHaveBeenCalledWith('1.2.3.4', 'AWS', '203.0.113.0/24', 'request_blocked');
  });

  it('uses GeoIP handler for country if available', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const geoIp = { getCountry: () => 'US' };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger, geoIp as never);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason');
    expect(agent.sendEvent.mock.calls[0][0].country).toBe('US');
  });

  it('handles null clientHost', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest({ clientHost: null }), 'action', 'reason');
    expect(agent.sendEvent.mock.calls[0][0].ipAddress).toBe('unknown');
  });

  it('handles GeoIP error gracefully', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const geoIp = { getCountry: () => { throw new Error('geo fail'); } };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger, geoIp as never);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason');
    expect(agent.sendEvent.mock.calls[0][0].country).toBeNull();
  });

  it('includes metadata in event', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason', { custom: 'data' });
    expect(agent.sendEvent.mock.calls[0][0].metadata.custom).toBe('data');
  });

  it('missing user-agent coalesces to null', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const agent = { sendEvent: vi.fn() };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest({ headers: {} }), 'a', 'r');
    expect(agent.sendEvent.mock.calls[0][0].userAgent).toBeNull();
  });

  it('cloud detection with passiveMode=false', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableEvents: true });
    const events: Array<Record<string, unknown>> = [];
    const agent = { sendEvent: async (e: Record<string, unknown>) => { events.push(e); } };
    const bus = new SecurityEventBus(agent as never, config, defaultLogger);
    const cloudHandler = {
      agentHandler: agent,
      getCloudProviderDetails: () => ['AWS', '203.0.113.0/24'],
      async sendCloudDetectionEvent(_ip: string, provider: string, network: string, actionTaken?: string) {
        await agent.sendEvent({
          eventType: 'cloud_blocked',
          ipAddress: '1.2.3.4',
          actionTaken,
          reason: `IP belongs to blocked cloud provider: ${provider}`,
          handlerName: 'cloud',
          metadata: { cloudProvider: provider, network },
        });
      },
    };
    await bus.sendCloudDetectionEvents(createMockRequest(), '1.2.3.4', ['AWS'], null, cloudHandler as never, false);
    expect(events[0]?.['actionTaken']).toBe('request_blocked');
    expect(events[0]?.['reason']).toBe('IP belongs to blocked cloud provider: AWS');
  });
});

describe('MetricsCollector', () => {
  it('no-ops when agent is null', async () => {
    const collector = new MetricsCollector(null, createTestConfig(), defaultLogger);
    await collector.sendMetric('test', 1.0);
    await collector.collectRequestMetrics(createMockRequest(), 0.5, 200);
  });

  it('no-ops when metrics disabled', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableMetrics: false });
    const agent = { sendMetric: vi.fn() };
    const collector = new MetricsCollector(agent as never, config, defaultLogger);
    await collector.sendMetric('test', 1.0);
    expect(agent.sendMetric).not.toHaveBeenCalled();
  });

  it('sends metrics when enabled', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableMetrics: true });
    const agent = { sendMetric: vi.fn() };
    const collector = new MetricsCollector(agent as never, config, defaultLogger);
    await collector.sendMetric('response_time', 0.123, { endpoint: '/api' });
    expect(agent.sendMetric).toHaveBeenCalledTimes(1);
  });

  it('collects request metrics (response_time + count + error)', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableMetrics: true });
    const agent = { sendMetric: vi.fn() };
    const collector = new MetricsCollector(agent as never, config, defaultLogger);
    await collector.collectRequestMetrics(createMockRequest(), 0.5, 500);
    expect(agent.sendMetric).toHaveBeenCalledTimes(3);
  });

  it('sends only 2 metrics for success status', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableMetrics: true });
    const agent = { sendMetric: vi.fn() };
    const collector = new MetricsCollector(agent as never, config, defaultLogger);
    await collector.collectRequestMetrics(createMockRequest(), 0.1, 200);
    expect(agent.sendMetric).toHaveBeenCalledTimes(2);
  });

  it('catches agent errors', async () => {
    const config = createTestConfig({ enableAgent: true, agentApiKey: 'key', agentEnableMetrics: true });
    const agent = { sendMetric: vi.fn().mockRejectedValue(new Error('fail')) };
    const collector = new MetricsCollector(agent as never, config, defaultLogger);
    await collector.sendMetric('test', 1.0);
  });
});
