import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { guardPlugin } from '../src/index.js';
import {
  BaseSecurityDecorator,
  SecurityConfigSchema,
  defaultLogger,
} from '@guardcore/core';
import type { GuardRequest, GuardResponse } from '@guardcore/core';

/* W3: routes registered after the plugin carry their handler's
   `_guardRouteId` from the onRoute hook into the guard request state, so the
   decorator's RouteConfig applies at request time (custom validator = 418
   proof; a non-decorated route never sees it). */

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

async function jsonHandler(): Promise<{ ok: boolean }> {
  return { ok: true };
}

describe('fastify decorator route config wiring (W3)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    const decorator = new BaseSecurityDecorator(resolvedConfig, defaultLogger);

    const decoratedHandler = async (
      _req: GuardRequest,
      reply: { status(n: number): { send(b: unknown): unknown } },
    ) => { void reply; return { ok: true }; };
    decorator.applyRouteConfig(decoratedHandler);
    const routeConfig = decorator.ensureRouteConfig(decoratedHandler);
    routeConfig.customValidators.push(async () => teapotResponse());

    const multiMethodHandler = async (
      _req: GuardRequest,
      reply: { status(n: number): { send(b: unknown): unknown } },
    ) => { void reply; return { ok: true }; };
    decorator.applyRouteConfig(multiMethodHandler);
    const multiConfig = decorator.ensureRouteConfig(multiMethodHandler);
    multiConfig.customValidators.push(async () => teapotResponse());

    app = Fastify();
    await app.register(guardPlugin, {
      config: { enableRedis: false },
      guardDecorator: decorator,
    });
    app.get('/decorated', decoratedHandler);
    app.get('/plain', jsonHandler);
    /* Multi-method registration: onRoute must file the route meta under
       every declared method. */
    app.route({ method: ['GET', 'POST'], url: '/multi', handler: multiMethodHandler });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the decorated handler route config at request time', async () => {
    const response = await app.inject({ method: 'GET', url: '/decorated' });
    expect(response.statusCode).toBe(418);
    expect(response.headers['x-guard-proof']).toBe('route-config');
    expect(response.body).toBe("I'm a teapot");
  });

  it('does not apply the decorator config to undecorated routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/plain' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('resolves the decorator config for every method of a multi-method route', async () => {
    for (const method of ['GET', 'POST'] as const) {
      const response = await app.inject({ method, url: '/multi' });
      expect(response.statusCode).toBe(418);
      expect(response.headers['x-guard-proof']).toBe('route-config');
    }
  });
});
