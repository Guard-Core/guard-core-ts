import { describe, it, expect, afterEach } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { attachWebSocketGuard } from '../src/index.js';

/* M2: Nest WS gateways attach their upgrade listener to the app's underlying
   HTTP server; attachWebSocketGuard gates that event (the framework exposes
   no upgrade-phase middleware). This proves the seam on a Nest-shaped
   http.Server: a blacklisted peer is rejected at the handshake (403) before
   any gateway listener runs; a clean peer gets 101. */

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
      path: '/gateway',
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

describe('attachWebSocketGuard (nestjs gateway seam)', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  });

  it('rejects a blacklisted peer before the gateway listener runs', async () => {
    const server = createServer();
    servers.push(server);

    attachWebSocketGuard(server, { config: { enableRedis: false, blacklist: ['127.0.0.1'] } });

    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgrade(port);
    expect(result.status).toBe(403);
    expect(accepted).toBe(false);
  });

  it('lets a clean peer reach the gateway listener', async () => {
    const server = createServer();
    servers.push(server);

    attachWebSocketGuard(server, { config: { enableRedis: false } });

    server.on('upgrade', (_req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgrade(port);
    expect(result.status).toBe(101);
  });
});
