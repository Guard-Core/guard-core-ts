/**
 * Real-server integration tests for the passthrough and bypass paths: the
 * bypass handler is NOT mocked, so these fail when the middleware answers an
 * excluded path, a bypass route or an addressless request itself instead of
 * continuing to the downstream handler (the reference dispatch).
 */
import { afterEach, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BehaviorRule, RouteConfig, type SecurityConfig } from '@guardcore/core';
import { GuardModule, SecurityMiddlewareNest } from '../src/index.js';

const XSS = encodeURIComponent('<script>alert(1)</script>');
const servers: Server[] = [];

async function start(
  config: Partial<SecurityConfig>,
  opts: {
    routeConfigs?: Array<{ path: string; config: RouteConfig }>;
    agentHandler?: unknown;
    noAddress?: boolean;
  } = {},
): Promise<string> {
  const app = express();
  if (opts.noAddress) {
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', { get: () => undefined, configurable: true });
      next();
    });
  }
  const mod = GuardModule.forRoot({
    config: { enableRedis: false, enableRateLimiting: false, ...config } as SecurityConfig,
    routeConfigs: opts.routeConfigs,
    agentHandler: opts.agentHandler as never,
  });
  const provider = (mod.providers as Array<{ useFactory?: () => Promise<unknown> }>)[0];
  const guard = new SecurityMiddlewareNest((await provider.useFactory!()) as never);
  app.use((req, res, next) => { void guard.use(req, res, next); });
  app.get('/health', (_req, res) => { res.send('handler-ran'); });
  app.get('/other', (_req, res) => { res.send('handler-ran'); });
  app.get('/open', (_req, res) => { res.send('handler-ran'); });
  app.get('/leak', (_req, res) => { res.send('secret-token'); });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function get(url: string): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await fetch(url);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

describe('excluded path (scoped exclusion)', () => {
  it('runs the real downstream handler', async () => {
    const base = await start({ excludePaths: ['/health'] });
    expect((await get(`${base}/health`)).text).toBe('handler-ran');
    expect((await get(`${base}/other`)).text).toBe('handler-ran');
  });

  it('skips the penetration scan on the excluded path only', async () => {
    const base = await start({ excludePaths: ['/health'] });
    expect((await get(`${base}/health?q=${XSS}`)).status).toBe(200);
    expect((await get(`${base}/other?q=${XSS}`)).status).toBe(400);
  });

  it('still enforces the ip blacklist on the excluded path', async () => {
    const base = await start({ excludePaths: ['/health'], blacklist: ['127.0.0.1'] });
    expect((await get(`${base}/health`)).status).toBe(403);
  });

  it('runs the response pass: security headers and metrics', async () => {
    const metrics: Array<{ metricType: string }> = [];
    const base = await start(
      { excludePaths: ['/health'], securityHeaders: { enabled: true }, enableAgent: true, agentApiKey: 'k', agentEnableMetrics: true },
      { agentHandler: agentStub(metrics) },
    );
    const res = await get(`${base}/health`);
    expect(res.text).toBe('handler-ran');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(metrics.some((m) => m.metricType === 'request_count')).toBe(true);
  });
});

describe('all-checks bypass route', () => {
  it('runs the real downstream handler and skips the scan', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const base = await start({}, { routeConfigs: [{ path: '/open', config: bypass }] });
    const res = await get(`${base}/open?q=${XSS}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('handler-ran');
  });
});

describe('response modifier on a bypass route', () => {
  it('is applied to the real downstream response', async () => {
    const bypass = new RouteConfig();
    bypass.bypassedChecks = new Set(['all']);
    const base = await start(
      { customResponseModifier: async (r: { setHeader(n: string, v: string): void }) => { r.setHeader('x-mod', '1'); return r; } } as never,
      { routeConfigs: [{ path: '/open', config: bypass }] },
    );
    const res = await get(`${base}/open`);
    expect(res.text).toBe('handler-ran');
    expect(res.headers.get('x-mod')).toBe('1');
  });
});

describe('request without a client address', () => {
  it('is rejected with 403 under the default failSecure and never reaches the handler', async () => {
    const blocks: Array<{ checkName?: string }> = [];
    const base = await start(
      { onBlock: (p: never) => { blocks.push(p); } } as never,
      { noAddress: true },
    );
    const res = await get(`${base}/other`);
    expect(res.status).toBe(403);
    expect(res.text).not.toBe('handler-ran');
    expect(blocks.length).toBe(1);
  });

  it('continues to the handler when failSecure is false', async () => {
    const base = await start({ failSecure: false }, { noAddress: true });
    expect((await get(`${base}/other`)).text).toBe('handler-ran');
  });
});

describe('body-based return rule', () => {
  it('fires on the captured response body', async () => {
    const fired: unknown[][] = [];
    const rule = new RouteConfig();
    rule.behaviorRules = [
      new BehaviorRule('return_pattern', 0, 60, 'secret-token', 'log', (...args) => { fired.push(args); }),
    ];
    const base = await start({ behaviorScanResponseBody: true }, { routeConfigs: [{ path: '/leak', config: rule }] });
    expect((await get(`${base}/leak`)).text).toBe('secret-token');
    await new Promise((r) => setTimeout(r, 50));
    expect(fired.length).toBe(1);
  });
});

function agentStub(metrics: Array<{ metricType: string }>) {
  return {
    initializeRedis: async () => {},
    sendEvent: async () => {},
    sendMetric: async (m: { metricType: string }) => { metrics.push(m); },
    start: async () => {},
    stop: async () => {},
    flushBuffer: async () => {},
    getDynamicRules: async () => null,
    healthCheck: async () => true,
  };
}
