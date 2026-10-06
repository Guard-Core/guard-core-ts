import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createGuardMiddleware } from '../src/index.js';
import {
  BaseSecurityDecorator,
  SecurityConfigSchema,
  defaultLogger,
} from '@guardcore/core';
import type { GuardRequest, GuardResponse } from '@guardcore/core';

/* W3: Hono composes [middleware..., handler] per request and exposes the
   composed routes on c.req.matchedRoutes; the middleware copies the matched
   handler's `_guardRouteId` onto the guard request state, so the decorator's
   RouteConfig applies at request time (custom validator = 418 proof; a
   non-decorated route never sees it). */

const resolvedConfig = SecurityConfigSchema.parse({ enableRedis: false });

function teapotResponse(): GuardResponse {
  return {
    statusCode: 418,
    headers: { 'x-guard-proof': 'route-config' },
    setHeader() {},
    body: new TextEncoder().encode("I'm a teapot"),
    bodyText: "I'm a teapot",
  };
}

async function jsonHandler(): Promise<Response> {
  return Response.json({ ok: true });
}

describe('hono decorator route config wiring (W3)', () => {
  it('applies the decorated handler route config at request time', async () => {
    const decorator = new BaseSecurityDecorator(resolvedConfig, defaultLogger);

    const decoratedHandler = async (_req: GuardRequest) => Response.json({ ok: true });
    decorator.applyRouteConfig(decoratedHandler);
    const routeConfig = decorator.ensureRouteConfig(decoratedHandler);
    routeConfig.customValidators.push(async () => teapotResponse());

    const app = new Hono();
    app.use('*', createGuardMiddleware({
      config: { enableRedis: false },
      guardDecorator: decorator,
      connectingIpResolver: () => '8.8.4.4',
    }));
    app.get('/decorated', decoratedHandler);
    app.get('/plain', jsonHandler);

    const decorated = await app.request('/decorated');
    expect(decorated.status).toBe(418);
    expect(decorated.headers.get('x-guard-proof')).toBe('route-config');
    expect(await decorated.text()).toBe("I'm a teapot");

    const plain = await app.request('/plain');
    expect(plain.status).toBe(200);
    expect(await plain.json()).toEqual({ ok: true });
  });

  it('resolves the route id through the matchedRoutes surface (unit)', async () => {
    const { resolveHonoRouteId } = await import('../src/route-id.js');
    const handler = (() => Response.json({})) as unknown as Record<string, unknown>;
    handler['_guardRouteId'] = 'guard_route_42';

    const ctx = {
      req: {
        matchedRoutes: [
          { handler: function middleware() {}, method: 'GET', path: '/decorated' },
          { handler, method: 'GET', path: '/decorated' },
        ],
      },
    } as never;

    expect(resolveHonoRouteId(ctx)).toBe('guard_route_42');
  });

  it('returns null when no matched route carries a guard route id', async () => {
    const { resolveHonoRouteId, resolveHonoEndpointId } = await import('../src/route-id.js');
    const ctx = {
      req: { matchedRoutes: [{ handler: function plain() {}, method: 'GET', path: '/x' }] },
    } as never;
    expect(resolveHonoRouteId(ctx)).toBeNull();
    expect(resolveHonoEndpointId(ctx)).toBe('plain');
  });

  it('returns null on non-hono mock contexts (feature detection)', async () => {
    const { resolveHonoRouteId, resolveHonoEndpointId } = await import('../src/route-id.js');
    const ctx = { req: {} } as never;
    expect(resolveHonoRouteId(ctx)).toBeNull();
    expect(resolveHonoEndpointId(ctx)).toBeNull();
  });
});
