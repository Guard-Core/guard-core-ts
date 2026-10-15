/**
 * Real dual-stack listener (`::`): an IPv4 client connects as
 * `::ffff:127.0.0.1`. The guard resolves the client to its canonical IPv4
 * identity, so an IPv4 blacklist entry applies.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { SecurityConfig } from '@guardcore/core';
import { guardPlugin } from '../src/index.js';

const apps: FastifyInstance[] = [];

async function listen(config: Partial<SecurityConfig>): Promise<{ port: number; seen: string[] }> {
  const seen: string[] = [];
  const app = Fastify();
  apps.push(app);
  await app.register(guardPlugin, {
    config: { enableRedis: false, enableRateLimiting: false, ...config } as SecurityConfig,
  });
  app.get('/other', async (request) => {
    seen.push(request.raw.socket.remoteAddress ?? '');
    return 'ok';
  });
  await app.listen({ port: 0, host: '::' });
  return { port: (app.server.address() as AddressInfo).port, seen };
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
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe('fastify on a dual-stack listener', () => {
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
