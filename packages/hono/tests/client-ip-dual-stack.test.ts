/**
 * Real dual-stack listener (`::`) bridged to the Hono app the way
 * @hono/node-server does (the Node request rides `env.incoming`): an IPv4
 * client connects as `::ffff:127.0.0.1`. The guard resolves the client to its
 * canonical IPv4 identity, so an IPv4 blacklist entry applies.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Hono } from 'hono';
import type { SecurityConfig } from '@guardcore/core';
import { createGuardMiddleware } from '../src/middleware.js';

const servers: http.Server[] = [];

async function listen(config: Partial<SecurityConfig>): Promise<{ port: number; seen: string[] }> {
  const seen: string[] = [];
  const app = new Hono();
  app.use('*', createGuardMiddleware({
    config: { enableRedis: false, enableRateLimiting: false, ...config } as SecurityConfig,
  }));
  app.get('/other', (c) => {
    seen.push((c.env as { incoming: http.IncomingMessage }).incoming.socket.remoteAddress ?? '');
    return c.text('ok');
  });
  const server = http.createServer(async (incoming, outgoing) => {
    const request = new Request(`http://localhost${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers as Record<string, string>,
    });
    const response = await app.fetch(request, { incoming });
    outgoing.statusCode = response.status;
    outgoing.end(await response.text());
  });
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

describe('hono on a dual-stack listener', () => {
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
