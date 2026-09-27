import { describe, it, expect, vi } from 'vitest';
import { SecurityConfigSchema } from '@guardcore/core';
import type { SecurityMiddlewareComponents } from '@guardcore/core';
import { defaultLogger, initializeSecurityMiddleware, RouteConfig } from '@guardcore/core';
import { NestResponseFactory } from '../src/adapters.js';
import { SecurityMiddlewareNest } from '../src/guard-module.js';

const XSS = '<script>alert(1)</script>';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

const mutedBodyConfig = new RouteConfig();
mutedBodyConfig.detectionScanBody = false;

async function buildComponents(): Promise<SecurityMiddlewareComponents> {
  const resolved = SecurityConfigSchema.parse({ enableRedis: false });
  const components = await initializeSecurityMiddleware(
    resolved, defaultLogger, new NestResponseFactory(),
  );
  components.routeResolver.registerPathRouteConfigs([
    { path: '/api/open', config: openConfig },
    { method: 'POST', path: '/api/mute', config: mutedBodyConfig },
  ]);
  return components;
}

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    path: '/api/other',
    protocol: 'https',
    get: (name: string) => name === 'host' ? 'example.com' : undefined,
    originalUrl: '/api/other?q=1',
    method: 'GET',
    socket: { remoteAddress: '10.0.0.1' },
    headers: { 'user-agent': 'Test/1.0', host: 'example.com' },
    query: {},
    ...overrides,
  } as never;
}

function createMockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    headers,
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
    getHeaders: vi.fn(() => ({ ...headers })),
    status: vi.fn(function status(code: number) { this.statusCode = code; return this; }),
    send: vi.fn(function send(body: unknown) { this._body = body; return this; }),
    end: vi.fn(),
    write: vi.fn(),
    redirect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    json: vi.fn(),
  } as never;
}

describe('per-route detection exclusions through the nestjs middleware', () => {
  it('a route-excluded query param passes while the same payload blocks on another path', async () => {
    const middleware = new SecurityMiddlewareNest(await buildComponents());

    const nextExcluded = vi.fn();
    const resExcluded = createMockRes();
    await middleware.use(
      createMockReq({ path: '/api/open', originalUrl: `/api/open?q=${encodeURIComponent(XSS)}`, query: { q: XSS } }),
      resExcluded, nextExcluded,
    );
    expect(nextExcluded).toHaveBeenCalled();
    expect(resExcluded.status).not.toHaveBeenCalled();

    const nextBlocked = vi.fn();
    const resBlocked = createMockRes();
    await middleware.use(
      createMockReq({ originalUrl: `/api/other?q=${encodeURIComponent(XSS)}`, query: { q: XSS } }),
      resBlocked, nextBlocked,
    );
    expect(nextBlocked).not.toHaveBeenCalled();
    expect(resBlocked.status).toHaveBeenCalledWith(403);
    const sent = (resBlocked.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(Buffer.from(sent as Uint8Array).toString('utf-8')).toBe('Suspicious activity detected');
  });

  it('a POST route with detectionScanBody=false mutes the body but not the query', async () => {
    const middleware = new SecurityMiddlewareNest(await buildComponents());
    const body = JSON.stringify({ comment: XSS });
    const jsonHeaders = { 'content-type': 'application/json', host: 'example.com' };

    const nextMuted = vi.fn();
    const resMuted = createMockRes();
    await middleware.use(
      createMockReq({
        path: '/api/mute', method: 'POST',
        originalUrl: '/api/mute?q=benign', query: { q: 'benign' },
        headers: jsonHeaders,
        rawBody: new TextEncoder().encode(body),
      }),
      resMuted, nextMuted,
    );
    expect(nextMuted).toHaveBeenCalled();

    const nextScan = vi.fn();
    const resScan = createMockRes();
    await middleware.use(
      createMockReq({
        path: '/api/scan', method: 'POST',
        originalUrl: '/api/scan', query: {},
        headers: jsonHeaders,
        rawBody: new TextEncoder().encode(body),
      }),
      resScan, nextScan,
    );
    expect(nextScan).not.toHaveBeenCalled();
    expect(resScan.status).toHaveBeenCalledWith(403);

    // The body toggle does not mute the query surface on the same route.
    const nextQuery = vi.fn();
    const resQuery = createMockRes();
    await middleware.use(
      createMockReq({
        path: '/api/mute', method: 'POST',
        originalUrl: `/api/mute?q=${encodeURIComponent(XSS)}`, query: { q: XSS },
        headers: jsonHeaders,
        rawBody: new TextEncoder().encode('{"comment":"benign"}'),
      }),
      resQuery, nextQuery,
    );
    expect(nextQuery).not.toHaveBeenCalled();
    expect(resQuery.status).toHaveBeenCalledWith(403);
  });
});
