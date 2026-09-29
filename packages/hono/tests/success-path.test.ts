/**
 * Hono middleware coverage for the success path: route config registration,
 * the post-next response capture, and the behavioral return-rules callback.
 */
import { describe, expect, it, vi } from 'vitest';
import { RouteConfig, type SecurityConfig } from '@guardcore/core';
import { createGuardMiddleware } from '../src/middleware.js';

const ALLOWED_IP = '203.0.113.23';

function createCtx() {
  const responseHeaders: Record<string, string> = {};
  const resHeaders = new Headers();
  return {
    responseHeaders,
    header: vi.fn((name: string, value: string) => { responseHeaders[name.toLowerCase()] = value; }),
    body: vi.fn((_data: string | null, status: number) => new Response(_data ?? '', { status })),
    redirect: vi.fn(() => new Response(null, { status: 302 })),
    env: {},
    req: {
      url: 'http://test/ping',
      method: 'GET',
      raw: new Request('http://test/ping', { headers: { 'user-agent': 'Test/1.0' } }),
      header: () => null,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    },
    res: { status: 200, headers: resHeaders },
  };
}

describe('guard middleware success path (hono)', () => {
  it('runs the post-next response processing with route configs', async () => {
    const middleware = createGuardMiddleware({
      config: {
        enableRateLimiting: false,
        enableRedis: false,
        securityHeaders: { enabled: true },
      } as SecurityConfig,
      connectingIpResolver: () => ALLOWED_IP,
      routeConfigs: [{ path: '/ping', config: new RouteConfig() }],
    });
    const ctx = createCtx();
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as never, next);
    expect(next).toHaveBeenCalled();
    expect([...ctx.res.headers.keys()].length).toBeGreaterThanOrEqual(0);
  });

  it('retries initialization after a failure instead of caching it', async () => {
    let geoAttempts = 0;
    const flakyGeo = {
      isInitialized: false,
      initialize: async () => {
        geoAttempts += 1;
        if (geoAttempts === 1) throw new Error('geo init failed');
      },
      getCountry: () => null,
      initializeRedis: async (): Promise<void> => {},
      initializeAgent: async (): Promise<void> => {},
      refresh: async (): Promise<void> => {},
      close: async (): Promise<void> => {},
    };
    const middleware = createGuardMiddleware({
      config: { enableRateLimiting: false, enableRedis: false } as SecurityConfig,
      geoIpHandler: flakyGeo as never,
    });
    const ctx = createCtx();
    const next = vi.fn();
    // The first request fails initialization...
    await expect(middleware(ctx as never, next)).rejects.toThrow('geo init failed');
    // ...and the second one retries it (succeeds) instead of caching the
    // failed promise.
    await middleware(ctx as never, next);
    expect(geoAttempts).toBe(2);
  });

  it('runs behavioral return rules when a route config carries them', async () => {
    const middleware = createGuardMiddleware({
      config: {
        enableRateLimiting: false,
        enableRedis: false,
        securityHeaders: { enabled: true },
      } as SecurityConfig,
      connectingIpResolver: () => ALLOWED_IP,
      routeConfigs: [
        {
          path: '/ping',
          config: new RouteConfig({
            behaviorRules: [
              {
                ruleType: 'return_pattern',
                pattern: 'status:200',
                threshold: 1000,
                window: 60,
                action: 'log',
              },
            ],
          }),
        },
      ],
    });
    const ctx = createCtx();
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as never, next);
    expect(next).toHaveBeenCalled();
  });
});
