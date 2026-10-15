/**
 * Real-instance integration tests for the passthrough and bypass paths: the
 * bypass handler is NOT mocked, so these fail when the plugin answers an
 * excluded path, a bypass route or an addressless request itself instead of
 * continuing the lifecycle to the route handler, and when blocked requests
 * still reach the pass-through response processing.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { BehaviorRule, RouteConfig, type SecurityConfig } from '@guardcore/core';
import { guardPlugin } from '../src/index.js';

const XSS = '<script>alert(1)</script>';
const apps: FastifyInstance[] = [];

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

async function build(
  config: Partial<SecurityConfig>,
  opts: { routeConfigs?: Array<{ path: string; config: RouteConfig }>; agentHandler?: unknown; noAddress?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify();
  if (opts.noAddress) {
    /* light-my-request always reports 127.0.0.1, so blank the peer address
       before the guard hooks run (a Unix socket looks like this). */
    app.addHook('onRequest', async (request) => {
      Object.defineProperty(request.raw.socket, 'remoteAddress', { get: () => undefined, configurable: true });
    });
  }
  await app.register(guardPlugin, {
    config: { enableRedis: false, enableRateLimiting: false, ...config } as SecurityConfig,
    routeConfigs: opts.routeConfigs,
    agentHandler: opts.agentHandler as never,
  });
  app.get('/health', async () => 'handler-ran');
  app.get('/other', async () => 'handler-ran');
  app.get('/open', async () => 'handler-ran');
  app.get('/leak', async (_req, reply) => reply.send(Buffer.from('secret-token')));
  app.get('/big', async (_req, reply) => reply.type('text/plain').send('a'.repeat(30_000) + 'secret-token'));
  app.get('/stream', async (_req, reply) => reply.type('text/plain').send(Readable.from(['secret-token'])));
  app.get('/leak-string', async (_req, reply) => reply.type('text/plain').send('secret-token'));
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe('excluded path (scoped exclusion)', () => {
  it('runs the real route handler', async () => {
    const app = await build({ excludePaths: ['/health'] });
    const res = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.1' });
    expect(res.payload).toBe('handler-ran');
    expect((await app.inject({ method: 'GET', url: '/other', remoteAddress: '10.0.0.1' })).payload).toBe('handler-ran');
  });

  it('skips the penetration scan on the excluded path only', async () => {
    const app = await build({ excludePaths: ['/health'] });
    const ok = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.1', query: { q: XSS } });
    expect(ok.statusCode).toBe(200);
    const blocked = await app.inject({ method: 'GET', url: '/other', remoteAddress: '10.0.0.1', query: { q: XSS } });
    expect(blocked.statusCode).toBe(400);
  });

  it('still enforces the ip blacklist on the excluded path', async () => {
    const app = await build({ excludePaths: ['/health'], blacklist: ['10.0.0.1'] });
    const res = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.1' });
    expect(res.statusCode).toBe(403);
  });

  it('runs the response pass: security headers and metrics', async () => {
    const metrics: Metric[] = [];
    const app = await build(
      { excludePaths: ['/health'], securityHeaders: { enabled: true }, enableAgent: true, agentApiKey: 'k', agentEnableMetrics: true },
      { agentHandler: agentStub(metrics) },
    );
    const res = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.1' });
    expect(res.payload).toBe('handler-ran');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(metrics.some((m) => m.metricType === 'request_count')).toBe(true);
  });
});

describe('all-checks bypass route', () => {
  it('runs the real route handler and skips the scan', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const app = await build({}, { routeConfigs: [{ path: '/open', config: bypass }] });
    const res = await app.inject({ method: 'GET', url: '/open', remoteAddress: '10.0.0.1', query: { q: XSS } });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toBe('handler-ran');
  });

  it('applies the response modifier to the real response', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const app = await build(
      { customResponseModifier: async (r: { setHeader(n: string, v: string): void }) => { r.setHeader('x-mod', '1'); return r; } } as never,
      { routeConfigs: [{ path: '/open', config: bypass }] },
    );
    const res = await app.inject({ method: 'GET', url: '/open', remoteAddress: '10.0.0.1' });
    expect(res.payload).toBe('handler-ran');
    expect(res.headers['x-mod']).toBe('1');
  });
});

describe('request without a client address', () => {
  it('is rejected with 403 under the default failSecure', async () => {
    const app = await build({}, { noAddress: true });
    const res = await app.inject({ method: 'GET', url: '/other' });
    expect(res.statusCode).toBe(403);
    expect(res.payload).not.toBe('handler-ran');
  });

  it('continues to the route handler when failSecure is false', async () => {
    const app = await build({ failSecure: false }, { noAddress: true });
    const res = await app.inject({ method: 'GET', url: '/other' });
    expect(res.payload).toBe('handler-ran');
  });
});

describe('blocked requests', () => {
  it('emit no request metrics, while allowed requests do', async () => {
    const metrics: Metric[] = [];
    const app = await build(
      { enableAgent: true, agentApiKey: 'k', agentEnableMetrics: true, securityHeaders: { enabled: true } },
      { agentHandler: agentStub(metrics) },
    );
    const blocked = await app.inject({ method: 'GET', url: '/other', remoteAddress: '10.0.0.1', query: { q: XSS } });
    expect(blocked.statusCode).toBe(400);
    expect(metrics.filter((m) => m.metricType === 'request_count')).toHaveLength(0);

    await app.inject({ method: 'GET', url: '/other', remoteAddress: '10.0.0.1' });
    expect(metrics.filter((m) => m.metricType === 'request_count')).toHaveLength(1);
  });
});

describe('body-based return rule', () => {
  for (const url of ['/leak', '/leak-string']) {
    it(`fires on the response body of ${url}`, async () => {
      const fired: unknown[][] = [];
      const rule = new RouteConfig();
      rule.behaviorRules = [
        new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
      ];
      const app = await build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: url, config: rule }] });
      const res = await app.inject({ method: 'GET', url, remoteAddress: '10.0.0.1' });
      expect(res.payload).toBe('secret-token');
      expect(fired.length).toBe(1);
    });
  }

  it('inspects only the capped prefix of a large body and serves it whole', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const app = await build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/big', config: rule }] });
    const res = await app.inject({ method: 'GET', url: '/big', remoteAddress: '10.0.0.1' });
    expect(res.payload.length).toBe(30_012);
    expect(fired).toHaveLength(0);
  });

  it('never consumes a stream payload for body patterns', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const app = await build({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/stream', config: rule }] });
    const res = await app.inject({ method: 'GET', url: '/stream', remoteAddress: '10.0.0.1' });
    expect(res.payload).toBe('secret-token');
    expect(fired).toHaveLength(0);
  });
});
