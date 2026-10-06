import { describe, it, expect, vi } from 'vitest';
import { CompositeAgentHandler } from '../../src/core/events/composite-handler.js';
import { EventFilter } from '../../src/core/events/event-filter.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { RedisHandlerProtocol } from '../../src/protocols/redis.js';
import { defaultLogger } from '../../src/models/logger.js';

function fakeHandler(name = 'FakeHandler'): AgentHandlerProtocol & {
  events: unknown[];
  metrics: unknown[];
  failSendEvent: boolean;
  failStart: boolean;
  healthResult: boolean;
} {
  /* Named class so constructor.name (the composite's failure label) is the
     per-sink name, mirroring Python's type(handler).__name__. */
  const SinkClass = class {
    events: unknown[] = [];
    metrics: unknown[] = [];
    failSendEvent = false;
    failStart = false;
    healthResult = true;

    async initializeRedis(_redis: RedisHandlerProtocol): Promise<void> {}
    async sendEvent(event: unknown): Promise<void> {
      if (this.failSendEvent) throw new Error(`sink ${name} down`);
      this.events.push(event);
    }
    async sendMetric(metric: unknown): Promise<void> {
      if (this.failSendEvent) throw new Error(`sink ${name} metric down`);
      this.metrics.push(metric);
    }
    async start(): Promise<void> {
      if (this.failStart) throw new Error(`sink ${name} cannot start`);
    }
    async stop(): Promise<void> {}
    async flushBuffer(): Promise<void> {}
    async getDynamicRules(): Promise<unknown | null> { return null; }
    async healthCheck(): Promise<boolean> { return this.healthResult; }
  };
  Object.defineProperty(SinkClass, 'name', { value: name });
  return new SinkClass() as unknown as AgentHandlerProtocol & {
    events: unknown[];
    metrics: unknown[];
    failSendEvent: boolean;
    failStart: boolean;
    healthResult: boolean;
  };
}

function redisStub(): RedisHandlerProtocol {
  return { async getKey() { return null; }, async setKey() {}, async deleteKey() {} } as unknown as RedisHandlerProtocol;
}

describe('CompositeAgentHandler', () => {
  it('fans events and metrics out to every sink', async () => {
    const a = fakeHandler('a');
    const b = fakeHandler('b');
    const composite = new CompositeAgentHandler([a, b]);

    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4' };
    await composite.sendEvent(event);
    const metric = { metricType: 'request_count', value: 1, tags: {} };
    await composite.sendMetric(metric);

    expect(a.events).toEqual([event]);
    expect(b.events).toEqual([event]);
    expect(a.metrics).toEqual([metric]);
    expect(b.metrics).toEqual([metric]);
  });

  it('drops events and metrics muted by the event filter', async () => {
    const a = fakeHandler('a');
    const composite = new CompositeAgentHandler([a], {
      eventFilter: new EventFilter(['cloud_blocked'], ['error_rate']),
    });

    await composite.sendEvent({ eventType: 'cloud_blocked' });
    await composite.sendEvent({ eventType: 'ip_blocked' });
    await composite.sendMetric({ metricType: 'error_rate', value: 1 });
    await composite.sendMetric({ metricType: 'request_count', value: 1 });

    expect(a.events.map((e) => (e as { eventType: string }).eventType)).toEqual(['ip_blocked']);
    expect(a.metrics.map((m) => (m as { metricType: string }).metricType)).toEqual(['request_count']);
  });

  it('runs the enricher before fanning out', async () => {
    const a = fakeHandler('a');
    const enrichEvents: unknown[] = [];
    const enrichMetrics: unknown[] = [];
    const composite = new CompositeAgentHandler([a], {
      enricher: {
        async enrichEvent(event) { enrichEvents.push(event); },
        async enrichMetric(metric) { enrichMetrics.push(metric); },
      },
    });

    await composite.sendEvent({ eventType: 'pattern_detected' });
    await composite.sendMetric({ metricType: 'response_time', value: 0.2 });

    expect(enrichEvents).toHaveLength(1);
    expect(enrichMetrics).toHaveLength(1);
    expect(a.events).toHaveLength(1);
  });

  it('isolates sink failures: one throwing sink never blocks the others', async () => {
    const broken = fakeHandler('broken');
    const healthy = fakeHandler('healthy');
    broken.failSendEvent = true;
    const errors: string[] = [];
    const composite = new CompositeAgentHandler([broken, healthy], {
      logger: { ...defaultLogger, error: (m: string) => errors.push(m) },
    });

    await composite.sendEvent({ eventType: 'ip_banned' });
    await composite.sendMetric({ metricType: 'request_count', value: 1 });

    expect(healthy.events).toHaveLength(1);
    expect(healthy.metrics).toHaveLength(1);
    expect(errors.length).toBe(2);
    expect(errors[0]).toContain('handler.sendEvent failed');
    expect(errors[1]).toContain('handler.sendMetric failed');
  });

  it('tracks sinks that fail to start (degraded)', async () => {
    const good = fakeHandler('good');
    const bad = fakeHandler('bad');
    bad.failStart = true;
    const composite = new CompositeAgentHandler([good, bad]);

    expect(composite.isStarted).toBe(false);
    await composite.start();
    expect(composite.isStarted).toBe(true);
    expect(composite.isDegraded).toBe(true);
    expect(composite.getFailedHandlers()).toEqual(['bad']);
  });

  it('is not degraded when every sink starts', async () => {
    const composite = new CompositeAgentHandler([fakeHandler('a'), fakeHandler('b')]);
    await composite.start();
    expect(composite.isDegraded).toBe(false);
    expect(composite.getFailedHandlers()).toEqual([]);
  });

  it('stops and flushes every sink even when one throws', async () => {
    const broken = fakeHandler('broken');
    const healthy = fakeHandler('healthy');
    const stopped: string[] = [];
    const flushed: string[] = [];
    broken.stop = async () => { stopped.push('broken'); throw new Error('stop failed'); };
    healthy.stop = async () => { stopped.push('healthy'); };
    broken.flushBuffer = async () => { flushed.push('broken'); throw new Error('flush failed'); };
    healthy.flushBuffer = async () => { flushed.push('healthy'); };
    const composite = new CompositeAgentHandler([broken, healthy]);

    await composite.stop();
    await composite.flushBuffer();
    expect(stopped).toEqual(['broken', 'healthy']);
    expect(flushed).toEqual(['broken', 'healthy']);
  });

  it('initializeRedis fans out and swallows failures', async () => {
    const broken = fakeHandler('broken');
    const healthy = fakeHandler('healthy');
    broken.initializeRedis = async () => { throw new Error('redis init failed'); };
    const initialized: string[] = [];
    healthy.initializeRedis = async () => { initialized.push('healthy'); };
    const composite = new CompositeAgentHandler([broken, healthy]);

    await composite.initializeRedis(redisStub());
    expect(initialized).toEqual(['healthy']);
  });

  it('getDynamicRules returns the first non-null result across sinks', async () => {
    const empty = fakeHandler('empty');
    const provider = fakeHandler('provider');
    provider.getDynamicRules = async () => ({ rules: [{ id: 'r1' }] });
    const later = fakeHandler('later');
    later.getDynamicRules = async () => ({ rules: [{ id: 'r2' }] });
    const composite = new CompositeAgentHandler([empty, provider, later]);

    const rules = await composite.getDynamicRules();
    expect(rules).toEqual({ rules: [{ id: 'r1' }] });
  });

  it('getDynamicRules returns null when every sink fails or returns null', async () => {
    const broken = fakeHandler('broken');
    broken.getDynamicRules = async () => { throw new Error('down'); };
    const composite = new CompositeAgentHandler([broken, fakeHandler('empty')]);
    expect(await composite.getDynamicRules()).toBeNull();
  });

  it('healthCheck is true for zero sinks and requires every sink healthy', async () => {
    expect(await new CompositeAgentHandler([]).healthCheck()).toBe(true);

    const healthy = fakeHandler('healthy');
    const sick = fakeHandler('sick');
    sick.healthResult = false;
    expect(await new CompositeAgentHandler([healthy, sick]).healthCheck()).toBe(false);
    expect(await new CompositeAgentHandler([healthy]).healthCheck()).toBe(true);
  });

  it('healthCheck treats a throwing sink as unhealthy', async () => {
    const broken = fakeHandler('broken');
    broken.healthCheck = async () => { throw new Error('boom'); };
    const composite = new CompositeAgentHandler([broken]);
    expect(await composite.healthCheck()).toBe(false);
  });

  it('uses the EventFilter default (everything allowed) when none given', async () => {
    const a = fakeHandler('a');
    const composite = new CompositeAgentHandler([a]);
    await composite.sendEvent({ eventType: 'anything' });
    await composite.sendMetric({ metricType: 'anything' });
    expect(a.events).toHaveLength(1);
    expect(a.metrics).toHaveLength(1);
  });
});
