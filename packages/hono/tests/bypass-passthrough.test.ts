/**
 * Real-app integration tests for the passthrough and bypass paths: the bypass
 * handler is NOT mocked, so these fail when the middleware answers an excluded
 * path, a bypass route or an addressless request itself instead of awaiting
 * the downstream handler.
 */
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { BehaviorRule, RouteConfig, type SecurityConfig } from '@guardcore/core';
import { createGuardMiddleware } from '../src/index.js';

const XSS = encodeURIComponent('<script>alert(1)</script>');
const IP = '203.0.113.9';

type Metric = { metricType: string };

function agentStub(metrics: Metric[]) {
  return {
    initializeRedis: async () => {},
    sendEvent: async () => {},
    sendMetric: async (m: Metric) => { metrics.push(m); },
    start: async () => {},
    stop: async () => {},
    flushBuffer: async () => {},
    getDynamicRules: async () => null,
    healthCheck: async () => true,
  };
}

function build(
  config: Partial<SecurityConfig>,
  opts: {
    routeConfigs?: Array<{ path: string; config: RouteConfig }>;
    agentHandler?: unknown;
    connectingIpResolver?: (c: never) => string | null;
  } = {},
): Hono {
  const app = new Hono();
  app.use('*', createGuardMiddleware({
    config: { enableRedis: false, enableRateLimiting: false, ...config } as SecurityConfig,
    routeConfigs: opts.routeConfigs,
    agentHandler: opts.agentHandler as never,
    connectingIpResolver: (opts.connectingIpResolver ?? (() => IP)) as never,
  }));
  app.get('/health', (c) => c.text('handler-ran'));
  app.get('/other', (c) => c.text('handler-ran'));
  app.get('/open', (c) => c.text('handler-ran'));
  app.get('/leak', (c) => c.text('secret-token'));
  app.get('/big', (c) => c.text('a'.repeat(30_000) + 'secret-token'));
  app.get('/sse', (c) => c.body('secret-token', 200, { 'content-type': 'text/event-stream' }));
  return app;
}

describe('excluded path (scoped exclusion)', () => {
  it('runs the real downstream handler', async () => {
    const app = build({ excludePaths: ['/health'] });
    expect(await (await app.request('/health')).text()).toBe('handler-ran');
    expect(await (await app.request('/other')).text()).toBe('handler-ran');
  });

  it('skips the penetration scan on the excluded path only', async () => {
    const app = build({ excludePaths: ['/health'] });
    expect((await app.request(`/health?q=${XSS}`)).status).toBe(200);
    expect((await app.request(`/other?q=${XSS}`)).status).toBe(400);
  });

  it('still enforces the ip blacklist on the excluded path', async () => {
    const app = build({ excludePaths: ['/health'], blacklist: [IP] });
    expect((await app.request('/health')).status).toBe(403);
  });

  it('runs the response pass: security headers and metrics', async () => {
    const metrics: Metric[] = [];
    const app = build(
      { excludePaths: ['/health'], securityHeaders: { enabled: true }, enableAgent: true, agentApiKey: 'k', agentEnableMetrics: true },
      { agentHandler: agentStub(metrics) },
    );
    const res = await app.request('/health');
    expect(await res.text()).toBe('handler-ran');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(metrics.some((m) => m.metricType === 'request_count')).toBe(true);
  });
});

describe('all-checks bypass route', () => {
  it('runs the real downstream handler and skips the scan', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const app = build({}, { routeConfigs: [{ path: '/open', config: bypass }] });
    const res = await app.request(`/open?q=${XSS}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('handler-ran');
  });
});

describe('response modifier on a bypass route', () => {
  it('is applied to the real downstream response', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const app = build(
      { customResponseModifier: async (r: { setHeader(n: string, v: string): void }) => { r.setHeader('x-mod', '1'); return r; } } as never,
      { routeConfigs: [{ path: '/open', config: bypass }] },
    );
    const res = await app.request('/open');
    expect(await res.text()).toBe('handler-ran');
    expect(res.headers.get('x-mod')).toBe('1');
  });
});

describe('request without a client address', () => {
  it('is rejected with 403 under the default failSecure', async () => {
    const app = build({}, { connectingIpResolver: () => null });
    const res = await app.request('/other');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toBe('handler-ran');
  });

  it('continues to the handler when failSecure is false', async () => {
    const app = build({ failSecure: false }, { connectingIpResolver: () => null });
    expect(await (await app.request('/other')).text()).toBe('handler-ran');
  });
});

describe('body-based return rule', () => {
  it('fires on the downstream response body', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const app = build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/leak', config: rule }] });
    expect(await (await app.request('/leak')).text()).toBe('secret-token');
    expect(fired.length).toBe(1);
  });

  it('fires a global rule on the response body without a route config', async () => {
    const app = build({
      behaviorScanResponseBody: true,
      globalBehaviorRules: [{ ruleType: 'return_pattern', threshold: 1, window: 60, pattern: 'secret-token', action: 'ban', banDuration: 60 }],
    } as never);
    expect((await app.request('/leak')).status).toBe(200);
    expect((await app.request('/leak')).status).toBe(200);
    expect((await app.request('/leak')).status).toBe(403);
  });

  it('inspects only the capped prefix of a large body and still serves it whole', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const app = build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/big', config: rule }] });
    const res = await app.request('/big');
    expect((await res.text()).length).toBe(30_012);
    expect(fired).toHaveLength(0);
  });

  it('never reads an event-stream body', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const app = build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/sse', config: rule }] });
    expect(await (await app.request('/sse')).text()).toBe('secret-token');
    expect(fired).toHaveLength(0);
  });
});
