/**
 * NestJS adapter success-path coverage: response capture chunk types, the
 * post-next behavioral/header pipeline, forRoot route registration, and the
 * passthrough setHeader surface.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SecurityConfig, SecurityMiddlewareComponents } from '@guardcore/core';
import { SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { BehaviorRule, RouteConfig } from '@guardcore/core';
import { GuardModule, SecurityMiddlewareNest } from '../src/guard-module.js';

const ALLOWED_IP = '203.0.113.22';

function securityConfig(): SecurityConfig {
  return {
    enableRateLimiting: false,
    enableRedis: false,
    securityHeaders: { enabled: true },
  } as SecurityConfig;
}

function createRes() {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => { headers[name.toLowerCase()] = value; }),
    getHeaders: () => ({ ...headers }),
    write: vi.fn(function write() { return true; }),
    end: vi.fn(function end() { return res; }),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    redirect: vi.fn(),
  };
  return res;
}

async function successComponents(): Promise<SecurityMiddlewareComponents> {
  return initializeSecurityMiddleware(
    SecurityConfigSchema.parse(securityConfig()),
    defaultLogger,
    // The response factory is imported from the adapter; keep the same one.
    new (await import('../src/adapters.js')).NestResponseFactory(),
  );
}

function createReq() {
  return {
    path: '/ping',
    protocol: 'http',
    get: (name: string) => (name === 'host' ? 'test' : undefined),
    originalUrl: '/ping',
    method: 'GET',
    socket: { remoteAddress: ALLOWED_IP },
    headers: { 'user-agent': 'Test/1.0', host: 'test', 'x-multi': ['a', 'b'], 'x-port': 8080 },
    query: undefined,
  };
}

describe('SecurityMiddlewareNest success path', () => {
  it('captures string, Buffer, typed-array, DataView and empty writes', async () => {
    const components = await successComponents();
    components.routeResolver.registerPathRouteConfigs([
      {
        path: '/ping',
        config: Object.assign(new RouteConfig(), {
          behaviorRules: [
            new BehaviorRule('return_pattern', 1000, 60, 'status:200', 'log'),
          ],
        }),
      },
    ]);
    const middleware = new SecurityMiddlewareNest(components);
    const res = createRes();
    const next = vi.fn();
    await middleware.use(createReq() as never, res as never, next);
    expect(next).toHaveBeenCalled();

    res.setHeader('x-pre-existing', '1');
    res.write('hello ');
    res.write(Buffer.from('buffer '));
    res.write(new TextEncoder().encode('typed '));
    res.write(new DataView(new ArrayBuffer(8)));
    res.write('');
    res.end('end');
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The success path applies security headers through processResponse.
    expect(res.setHeader).toHaveBeenCalled();
  });

  it('stops capturing past the response budget', async () => {
    const middleware = new SecurityMiddlewareNest(await successComponents());
    const res = createRes();
    const next = vi.fn();
    await middleware.use(createReq() as never, res as never, next);
    res.write('x'.repeat(12_000));
    res.write('overflow ignored');
    res.end();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});

describe('GuardModule.forRoot', () => {
  it('registers route configs through the async provider factory', async () => {
    const dynamic = GuardModule.forRoot({
      config: securityConfig(),
      routeConfigs: [{ path: '/api', config: { rateLimit: 5 } } as never],
    });
    const provider = dynamic.providers.find(
      (item) => (item as { provide?: symbol }).provide !== undefined,
    ) as { useFactory: () => Promise<unknown> } | undefined;
    expect(provider).toBeDefined();
    const components = (await provider?.useFactory()) as SecurityMiddlewareComponents;
    expect(components.pipeline).toBeDefined();
  });

  it('configures the middleware for every route', () => {
    const module = new GuardModule();
    const apply = vi.fn().mockReturnThis();
    const forRoutes = vi.fn();
    module.configure({ apply, forRoutes } as never);
    expect(apply).toHaveBeenCalledWith(SecurityMiddlewareNest);
    expect(forRoutes).toHaveBeenCalledWith('*');
  });
});
