import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createSecurityMiddleware } from '../src/index.js';
import { resolveExpressRouteId } from '../src/route-id.js';
import {
  BaseSecurityDecorator,
  SecurityConfigSchema,
  defaultLogger,
} from '@guardcore/core';
import type { GuardRequest, GuardResponse } from '@guardcore/core';

/* W3: the decorated handler's `_guardRouteId` must reach the guard request
   state so the decorator's RouteConfig applies at request time. The proof:
   a custom validator on the decorated route's config answers 418; a
   non-decorated route never sees it. */

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

async function jsonHandler(_req: GuardRequest, res: { status(n: number): unknown; json(b: unknown): unknown }) {
  res.status(200).json({ ok: true });
}

describe('express decorator route config wiring (W3)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const decorator = new BaseSecurityDecorator(resolvedConfig, defaultLogger);

    const decoratedHandler = async (
      _req: GuardRequest,
      res: { status(n: number): unknown; json(b: unknown): unknown },
    ) => { await jsonHandler(_req, res); };
    decorator.applyRouteConfig(decoratedHandler);
    const routeConfig = decorator.ensureRouteConfig(decoratedHandler);
    routeConfig.customValidators.push(async () => teapotResponse());

    const app = express();
    app.use(createSecurityMiddleware({
      config: { enableRedis: false },
      guardDecorator: decorator,
    }));
    app.get('/decorated', decoratedHandler);
    app.get('/plain', jsonHandler);

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => {
      server.once('listening', () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('applies the decorated handler route config at request time', async () => {
    const response = await fetch(`${baseUrl}/decorated`);
    expect(response.status).toBe(418);
    expect(response.headers.get('x-guard-proof')).toBe('route-config');
    expect(await response.text()).toBe("I'm a teapot");
  });

  it('does not apply the decorator config to undecorated routes', async () => {
    const response = await fetch(`${baseUrl}/plain`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('resolveExpressRouteId layer matching (unit)', () => {
  function decoratedHandle(id: string): Record<string, unknown> {
    const handle = () => {};
    handle['_guardRouteId'] = id;
    return handle;
  }

  function reqWith(overrides: Record<string, unknown>): Parameters<typeof resolveExpressRouteId>[0] {
    return { method: 'GET', path: '/decorated', url: '/decorated', ...overrides } as never;
  }

  it('prefers the direct route match (route-level mounting)', () => {
    const req = reqWith({ route: { stack: [{ handle: {} }, { handle: decoratedHandle('gw:direct') }], methods: { get: true } } });
    expect(resolveExpressRouteId(req)).toBe('gw:direct');
  });

  it('returns null when the direct route declares a different method', () => {
    const req = reqWith({ route: { stack: [{ handle: decoratedHandle('gw:direct') }], methods: { post: true } } });
    expect(resolveExpressRouteId(req)).toBeNull();
  });

  it('scans the app router stack and matches express 5 matcher arrays', () => {
    const req = reqWith({
      app: { _router: { stack: [
        { handle: {} },
        { route: { stack: [{ handle: decoratedHandle('gw:scan') }], methods: { get: true } }, matchers: [(p: string) => p === '/decorated'] },
      ] } },
    });
    expect(resolveExpressRouteId(req)).toBe('gw:scan');
  });

  it('matches express 4 stateful match() layers', () => {
    const req = reqWith({
      app: { router: { stack: [
        { route: { stack: [{ handle: decoratedHandle('gw:scan4') }] }, match: (p: string) => p === '/decorated' },
      ] } },
    });
    expect(resolveExpressRouteId(req)).toBe('gw:scan4');
  });

  it('treats a throwing matcher, a throwing match(), and bare layers as non-matches', () => {
    const req = reqWith({
      app: { _router: { stack: [
        { route: { stack: [{ handle: () => {} }] }, matchers: [() => { throw new Error('boom'); }] },
        { route: { stack: [{ handle: () => {} }] }, match: () => { throw new Error('boom'); } },
        { route: { stack: [{ handle: () => {} }] } },
      ] } },
    });
    expect(resolveExpressRouteId(req)).toBeNull();
  });

  it('returns null without an app router', () => {
    expect(resolveExpressRouteId(reqWith({}))).toBeNull();
  });

  it('returns null for routes without a usable stack', () => {
    expect(resolveExpressRouteId(reqWith({ route: {} }))).toBeNull();
    expect(resolveExpressRouteId(reqWith({ route: { stack: [] } }))).toBeNull();
  });

  it('returns null when the app has no usable router stack', () => {
    expect(resolveExpressRouteId(reqWith({ app: {} }))).toBeNull();
    expect(resolveExpressRouteId(reqWith({ app: { router: { stack: 42 } } }))).toBeNull();
  });

  it('falls back to the raw url when req.path is missing', () => {
    const req = {
      method: 'GET',
      url: '/decorated',
      app: { _router: { stack: [
        { route: { stack: [{ handle: decoratedHandle('gw:nopath') }], methods: { get: true } }, matchers: [(p: string) => p === '/decorated'] },
      ] } },
    } as never;
    expect(resolveExpressRouteId(req)).toBe('gw:nopath');
  });

  it('endpoint id falls back to url and skips handle-less stack entries', async () => {
    const { resolveExpressEndpointId } = await import('../src/route-id.js');
    const req = {
      method: 'GET',
      url: '/decorated',
      app: { _router: { stack: [
        { route: { stack: [undefined, { handle: undefined }, { handle: decoratedHandle('gw:endpoint') }], methods: { get: true } }, matchers: [(p: string) => p === '/decorated'] },
      ] } },
    } as never;
    expect(resolveExpressEndpointId(req)).toBe('handle');
    expect(resolveExpressEndpointId(reqWith({ route: {} }))).toBeNull();
  });
});
