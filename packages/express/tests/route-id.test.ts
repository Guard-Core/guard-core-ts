import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createSecurityMiddleware } from '../src/index.js';
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
