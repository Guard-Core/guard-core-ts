/**
 * Real dual-stack listener: Node's default `listen(port)` binds `::`, so an
 * IPv4 client connects as `::ffff:127.0.0.1`. The Nest guard middleware
 * resolves the client to its canonical IPv4 identity, so an IPv4 blacklist
 * entry applies.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { SecurityConfig } from '@guardcore/core';
import { SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { NestResponseFactory } from '../src/adapters.js';
import { SecurityMiddlewareNest } from '../src/guard-module.js';

const servers: http.Server[] = [];

async function listen(config: Partial<SecurityConfig>): Promise<{ port: number; seen: string[] }> {
  const seen: string[] = [];
  const components = await initializeSecurityMiddleware(
    SecurityConfigSchema.parse({ enableRedis: false, enableRateLimiting: false, ...config }),
    defaultLogger,
    new NestResponseFactory(),
  );
  const guard = new SecurityMiddlewareNest(components);
  const app = express();
  app.use((req, res, next) => { void guard.use(req, res, next); });
  app.get('/other', (req, res) => {
    seen.push(req.socket.remoteAddress ?? '');
    res.status(200).send('ok');
  });
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return { port: (server.address() as AddressInfo).port, seen };
}

function get(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/other' }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    }).on('error', reject);
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

describe('nestjs on a dual-stack listener', () => {
  it('blocks an IPv4 blacklist entry for an IPv4-mapped client', async () => {
    const { port } = await listen({ blacklist: ['127.0.0.1'] });
    expect(await get(port)).toBe(403);
  });

  it('blocks an IPv4 CIDR blacklist entry for an IPv4-mapped client', async () => {
    const { port } = await listen({ blacklist: ['127.0.0.0/8'] });
    expect(await get(port)).toBe(403);
  });

  it('lets an unlisted client through and sees the mapped socket address', async () => {
    const { port, seen } = await listen({ blacklist: ['203.0.113.9'] });
    expect(await get(port)).toBe(200);
    expect(seen).toEqual(['::ffff:127.0.0.1']);
  });
});
