import { describe, it, expect, afterEach } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import fastify from 'fastify';
import { attachWebSocketGuard, guardPlugin } from '../src/index.js';

/* M2: the fastify adapter's WebSocket guard re-exports the core node
   upgrade guard; this proves the seam end to end on a real fastify-mounted
   http server: a blacklisted peer is rejected at the handshake (403) and a
   clean peer reaches the ws listener (101). */

const servers: Server[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function upgrade(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/ws',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });
    req.on('upgrade', (res, socket) => {
      resolve({ status: res.statusCode ?? 101, body: '' });
      socket.end();
    });
    req.on('response', (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('attachWebSocketGuard (fastify seam)', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  });

  it('rejects a blacklisted peer before the ws listener runs', async () => {
    const app = fastify();
    await app.register(guardPlugin, { config: { enableRedis: false } });
    await app.ready();
    const server = createServer(app.server);
    servers.push(server);

    attachWebSocketGuard(server, { config: { enableRedis: false, blacklist: ['127.0.0.1'] } });

    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.end();
    });

    await listen(server);
    const result = await upgrade((server.address() as AddressInfo).port);
    expect(result.status).toBe(403);
    expect(accepted).toBe(false);
  });

  it('lets a clean peer reach the ws listener', async () => {
    const app = fastify();
    await app.register(guardPlugin, { config: { enableRedis: false } });
    await app.ready();
    const server = createServer(app.server);
    servers.push(server);

    attachWebSocketGuard(server, { config: { enableRedis: false } });

    server.on('upgrade', (_req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });

    await listen(server);
    const result = await upgrade((server.address() as AddressInfo).port);
    expect(result.status).toBe(101);
  });
});
