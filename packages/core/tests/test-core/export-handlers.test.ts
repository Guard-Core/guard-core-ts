import { describe, it, expect, vi } from 'vitest';
import { OtelHandler } from '../../src/core/events/otel-handler.js';
import { LogfireHandler } from '../../src/core/events/logfire-handler.js';
import type { OtelInstrumentation } from '../../src/core/events/otel-handler.js';
import type { LogfireClient } from '../../src/core/events/logfire-handler.js';
import { defaultLogger } from '../../src/models/logger.js';

const sampleEvent = {
  timestamp: new Date(),
  eventType: 'penetration_attempt',
  ipAddress: '9.9.9.9',
  actionTaken: 'request_blocked',
  reason: 'SQLi pattern',
  endpoint: '/login',
  method: 'POST',
  metadata: {
    'guard.threat_score': 0.9,
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    tracestate: 'vendor=1',
    notGuard: 'skip me',
  },
};

describe('OtelHandler', () => {
  function fakeInstrumentation() {
    const spans: Array<{ name: string; attributes: Record<string, string | number>; parent?: unknown }> = [];
    const histograms: Array<{ name: string; value: number; attributes: Record<string, string> }> = [];
    const counters: Array<{ name: string; value: number; attributes: Record<string, string> }> = [];
    let shutdowns = 0;
    const instrumentation: OtelInstrumentation = {
      startSpan(name, attributes, parent) {
        spans.push({ name, attributes, parent });
      },
      recordHistogram(name, value, attributes) {
        histograms.push({ name, value, attributes });
      },
      addCounter(name, value, attributes) {
        counters.push({ name, value, attributes });
      },
      async shutdown() { shutdowns++; },
    };
    return { instrumentation, spans, histograms, counters, get shutdowns() { return shutdowns; } };
  }

  it('maps an event to a guard.event span with the reference attribute set', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent(sampleEvent);

    expect(fake.spans).toHaveLength(1);
    const span = fake.spans[0];
    expect(span.name).toBe('guard.event.penetration_attempt');
    expect(span.attributes).toMatchObject({
      'guard.event_type': 'penetration_attempt',
      'guard.ip_address': '9.9.9.9',
      'guard.action_taken': 'request_blocked',
      'guard.reason': 'SQLi pattern',
      'guard.endpoint': '/login',
      'guard.method': 'POST',
      'guard.threat_score': 0.9,
    });
    expect(span.attributes['notGuard']).toBeUndefined();
  });

  it('extracts the parent trace context from metadata', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent(sampleEvent);
    expect(fake.spans[0].parent).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=1',
    });
  });

  it('omits the parent when metadata has no trace context', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent({ eventType: 'ip_blocked', metadata: { 'guard.rule.id': 'r1' } });
    expect(fake.spans[0].parent).toBeUndefined();
  });

  it('maps metrics by type: response_time histogram, request/error counters', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);

    await handler.sendMetric({ metricType: 'response_time', value: 0.5, tags: { endpoint: '/a', method: 'GET' } });
    await handler.sendMetric({ metricType: 'request_count', value: 1, tags: { endpoint: '/a' } });
    await handler.sendMetric({ metricType: 'error_rate', value: 1, tags: { endpoint: '/a', status: '500' } });

    expect(fake.histograms).toEqual([
      { name: 'guard.request.duration', value: 0.5, attributes: { endpoint: '/a', method: 'GET' } },
    ]);
    expect(fake.counters).toEqual([
      { name: 'guard.request.count', value: 1, attributes: { endpoint: '/a' } },
      { name: 'guard.error.count', value: 1, attributes: { endpoint: '/a', status: '500' } },
    ]);
  });

  it('warns on unknown metric types', async () => {
    const fake = fakeInstrumentation();
    const errors: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => errors.push(m) };
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, logger);
    await handler.sendMetric({ metricType: 'mystery', value: 1 });
    expect(errors.some((m) => m.includes('Unknown OTEL metric type mystery'))).toBe(true);
    expect(fake.counters).toHaveLength(0);
  });

  it('is disabled without instrumentation and start warns', async () => {
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const handler = new OtelHandler({ serviceName: 'svc' }, logger);
    expect(await handler.healthCheck()).toBe(false);
    await handler.start();
    expect(warns.some((m) => m.includes('opentelemetry SDK not wired'))).toBe(true);

    await handler.sendEvent(sampleEvent);
    await handler.sendMetric({ metricType: 'request_count', value: 1 });
    await handler.stop(); // no-op without instrumentation
    expect(await handler.getDynamicRules()).toBeNull();
    await expect(handler.initializeRedis({} as never)).resolves.toBeUndefined();
    await expect(handler.flushBuffer()).resolves.toBeUndefined();
  });

  it('healthCheck is true with instrumentation and stop shuts it down', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.start();
    expect(await handler.healthCheck()).toBe(true);
    await handler.stop();
    expect(fake.shutdowns).toBe(1);
  });

  it('carries guard.status_code only when the event has one', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent({ eventType: 'ip_blocked', statusCode: 403 });
    expect(fake.spans[0].attributes['guard.status_code']).toBe(403);
    await handler.sendEvent({ eventType: 'ip_blocked' });
    expect(fake.spans[1].attributes['guard.status_code']).toBeUndefined();
  });

  it('builds the parent context from traceparent-only and tracestate-only metadata', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent({ eventType: 'ip_blocked', metadata: { traceparent: '00-abc-def-01' } });
    expect(fake.spans[0].parent).toEqual({ traceparent: '00-abc-def-01' });
    await handler.sendEvent({ eventType: 'ip_blocked', metadata: { tracestate: 'vendor=1' } });
    expect(fake.spans[1].parent).toEqual({ tracestate: 'vendor=1' });
  });

  it('treats non-object metadata as absent and tolerates null payloads', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent({ eventType: 'ip_blocked', metadata: 'not-an-object' });
    await handler.sendEvent(null);
    await handler.sendMetric(null);
    expect(fake.spans[0].parent).toBeUndefined();
    expect(fake.spans[1].name).toBe('guard.event.unknown');
    expect(fake.counters).toHaveLength(0);
  });

  it('forwards enrichment metadata as string or number', async () => {
    const fake = fakeInstrumentation();
    const handler = new OtelHandler({ serviceName: 'svc', instrumentation: fake.instrumentation }, defaultLogger);
    await handler.sendEvent({
      eventType: 'pattern_detected',
      metadata: { 'guard.rule.id': 'r-7', 'guard.threat_score': 0.5 },
    });
    expect(fake.spans[0].attributes['guard.rule.id']).toBe('r-7');
    expect(fake.spans[0].attributes['guard.threat_score']).toBe(0.5);
  });

  it('exposes its config for diagnostics', () => {
    const handler = new OtelHandler({
      serviceName: 'svc',
      resourceAttributes: { 'deployment.environment': 'prod' },
      exporterEndpoint: 'http://collector:4318',
    }, defaultLogger);
    expect(handler.config.serviceName).toBe('svc');
    expect(handler.config.resourceAttributes).toEqual({ 'deployment.environment': 'prod' });
    expect(handler.config.exporterEndpoint).toBe('http://collector:4318');
  });
});

describe('LogfireHandler', () => {
  function fakeClient() {
    const spans: Array<{ name: string; attributes: Record<string, unknown> }> = [];
    const infos: Array<{ message: string; attributes: Record<string, unknown> }> = [];
    let configured = 0;
    let shutdowns = 0;
    let configuredState = false;
    const client: LogfireClient = {
      isConfigured() { return configuredState; },
      configure(serviceName: string) {
        configured++;
        configuredState = true;
        void serviceName;
      },
      span(name, attributes) { spans.push({ name, attributes }); },
      info(message, attributes) { infos.push({ message, attributes }); },
      async shutdown() { shutdowns++; configuredState = false; },
    };
    return { client, spans, infos, get configured() { return configured; }, get shutdowns() { return shutdowns; } };
  }

  it('maps an event to a guard.event span with the reference attributes', async () => {
    const fake = fakeClient();
    const handler = new LogfireHandler({ serviceName: 'svc', client: fake.client }, defaultLogger);
    await handler.sendEvent(sampleEvent);

    expect(fake.spans).toHaveLength(1);
    const span = fake.spans[0];
    expect(span.name).toBe('guard.event.penetration_attempt');
    expect(span.attributes).toMatchObject({
      event_type: 'penetration_attempt',
      ip_address: '9.9.9.9',
      action_taken: 'request_blocked',
      reason: 'SQLi pattern',
      endpoint: '/login',
      method: 'POST',
      status_code: 0,
      'guard.threat_score': 0.9,
    });
    expect(span.attributes['notGuard']).toBeUndefined();
  });

  it('maps metrics to guard.metric info calls, stripping value collisions', async () => {
    const fake = fakeClient();
    const handler = new LogfireHandler({ serviceName: 'svc', client: fake.client }, defaultLogger);
    await handler.sendMetric({ metricType: 'response_time', value: 0.3, tags: { endpoint: '/a', value: 'nope' } });
    expect(fake.infos).toHaveLength(1);
    expect(fake.infos[0].message).toBe('guard.metric.response_time');
    expect(fake.infos[0].attributes).toEqual({ value: 0.3, endpoint: '/a' });
  });

  it('configures logfire once when unconfigured', async () => {
    const fake = fakeClient();
    const handler = new LogfireHandler({ serviceName: 'guard-svc', client: fake.client }, defaultLogger);
    await handler.start();
    await handler.start(); // idempotent
    expect(fake.configured).toBe(1);
    expect(await handler.healthCheck()).toBe(true);

    await handler.stop(); // configured by guard: shutdown runs
    expect(fake.shutdowns).toBe(1);
  });

  it('adopts an already-configured logfire without reconfiguring and never shuts it down', async () => {
    const fake = fakeClient();
    /* Simulate the host application having configured logfire. */
    fake.client.configure('host-svc');
    const configuredBefore = fake.configured;

    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const handler = new LogfireHandler({ serviceName: 'guard-svc', client: fake.client }, logger);
    await handler.start();

    expect(fake.configured).toBe(configuredBefore);
    expect(warns.some((m) => m.includes('already configured for this process'))).toBe(true);

    await handler.stop();
    expect(fake.shutdowns).toBe(0);
  });

  it('is disabled without a client and start warns', async () => {
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const handler = new LogfireHandler({ serviceName: 'svc' }, logger);
    expect(await handler.healthCheck()).toBe(false);
    await handler.start();
    expect(warns.some((m) => m.includes('logfire not wired'))).toBe(true);

    await handler.sendEvent(sampleEvent);
    await handler.sendMetric({ metricType: 'request_count', value: 1 });
    await handler.stop();
    await expect(handler.getDynamicRules()).resolves.toBeNull();
    await expect(handler.initializeRedis({} as never)).resolves.toBeUndefined();
    await expect(handler.flushBuffer()).resolves.toBeUndefined();
  });

  it('handles malformed event payloads without throwing', async () => {
    const fake = fakeClient();
    const handler = new LogfireHandler({ serviceName: 'svc', client: fake.client }, defaultLogger);
    await handler.sendEvent(null);
    await handler.sendMetric(undefined);
    expect(fake.spans[0].name).toBe('guard.event.unknown');
    expect(fake.infos[0].message).toBe('guard.metric.unknown');
  });
});
