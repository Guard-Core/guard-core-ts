import { describe, it, expect, afterAll } from 'vitest';
import express, { type Express } from 'express';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  SecurityDecorator,
  SecurityConfigSchema,
  initializeSecurityMiddleware,
  resolveConfiguredLogger,
} from '@guardcore/core';
import { NestResponseFactory } from '../src/adapters.js';
import { SecurityMiddlewareNest } from '../src/index.js';

/* W3: the NestJS adapter runs on Express under the hood, so the decorated
   handler's `_guardRouteId` resolves through the same lazy router-stack
   scan. This drives a real Nest + express http server: a controller method
   decorated through the core decorator gets its route config applied at
   request time (rate limit), and an undecorated route stays on the global
   config. */

let server: Server | null = null;

async function start(app: Express): Promise<number> {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => resolve());
  });
  return (server.address() as AddressInfo).port;
}

async function get(port: number, path: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    httpRequest({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers as Record<string, string> }));
    }).on('error', reject).end();
  });
}

describe('nestjs decorator route adoption (W3)', () => {
  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  });

  it('applies a decorator route config to the decorated controller method', async () => {
    const app = express();
    const decorator = new SecurityDecorator(
      SecurityConfigSchema.parse({ enableRedis: false, enableRateLimiting: true, rateLimit: 1000, rateLimitWindow: 60 }),
    );
    const decorated = decorator.rateLimit(1, 60)(
      async function decoratedHandler(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
        res.status(200).json({ ok: true });
      },
    );

    // Drive the real middleware (the same use() the Nest DI factory wires),
    // with the components built the way GuardModule.forRoot builds them.
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      enableRateLimiting: true,
      rateLimit: 1000,
      rateLimitWindow: 60,
    });
    const logger = await resolveConfiguredLogger(config);
    const components = await initializeSecurityMiddleware(
      config, logger, new NestResponseFactory(), null, null, decorator,
    );
    const middleware = new SecurityMiddlewareNest(components as never);
    app.use((req, res, next) => { void middleware.use(req, res, next); });
    app.get('/limited', decorated);
    app.get('/open', async (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
      res.status(200).json({ ok: true });
    });

    const port = await start(app);

    // First request on the decorated route passes.
    const first = await get(port, '/limited');
    expect(first.status).toBe(200);
    // The decorator's per-route limit (1/60s) trips the second request even
    // though the global limit is 1000.
    const second = await get(port, '/limited');
    expect(second.status).toBe(429);
    // The undecorated route keeps the global limit.
    const open = await get(port, '/open');
    expect(open.status).toBe(200);
  });
});
