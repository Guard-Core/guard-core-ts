import { describe, it, expect, afterEach } from 'vitest';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { attachNodeWebSocketGuard } from '../../src/core/node-websocket-guard.js';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockResponseFactory } from '../helpers.js';
import type { SecurityMiddlewareComponents } from '../../src/index.js';

async function buildComponents(configOverrides: Record<string, unknown> = {}): Promise<SecurityMiddlewareComponents> {
  const config = SecurityConfigSchema.parse({ enableRedis: false, ...configOverrides });
  return initializeSecurityMiddleware(config, defaultLogger, createMockResponseFactory());
}

function upgradeAgainst(server: Server, port: number, headers: Record<string, string> = {}): Promise<{
  status: number;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/ws?token=abc',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        ...headers,
      },
    });
    req.on('upgrade', (res, socket) => {
      /* Server accepted the upgrade (101). */
      let body = '';
      socket.on('data', (chunk) => { body += chunk; });
      socket.on('end', () => resolve({ status: res.statusCode ?? 101, body }));
      socket.on('error', () => resolve({ status: res.statusCode ?? 101, body }));
      socket.end();
      resolve({ status: res.statusCode ?? 101, body });
    });
    req.on('response', (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const servers: Server[] = [];

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

describe('attachNodeWebSocketGuard (node upgrade integration)', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  });

  it('rejects a blacklisted client with an HTTP 403 handshake response', async () => {
    const components = await buildComponents({ blacklist: ['127.0.0.1'] });
    const server = createServer();
    servers.push(server);
    attachNodeWebSocketGuard(server, { config: { enableRedis: false, blacklist: ['127.0.0.1'] }, components });
    /* A downstream listener that would accept everything: it must never run. */
    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgradeAgainst(server, port);
    expect(result.status).toBe(403);
    expect(result.body).toContain('WebSocket upgrade rejected');
    expect(accepted).toBe(false);
  });

  it('lets a clean upgrade reach the downstream listener (101)', async () => {
    const components = await buildComponents();
    const server = createServer();
    servers.push(server);
    attachNodeWebSocketGuard(server, { config: { enableRedis: false }, components });
    server.on('upgrade', (_req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgradeAgainst(server, port);
    expect(result.status).toBe(101);
  });

  it('gates listeners attached AFTER the guard (ws attach order does not matter)', async () => {
    const components = await buildComponents({ blacklist: ['127.0.0.1'] });
    const server = createServer();
    servers.push(server);
    attachNodeWebSocketGuard(server, { config: { enableRedis: false, blacklist: ['127.0.0.1'] }, components });
    /* Attached after the guard: still gated. */
    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgradeAgainst(server, port);
    expect(result.status).toBe(403);
    expect(accepted).toBe(false);
  });

  it('fails closed when the guard itself throws', async () => {
    const components = await buildComponents();
    /* A components seam that explodes on access: the attacher's catch must
       reject the handshake instead of waving it through. */
    const broken = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'middlewareProtocol') throw new Error('components exploded');
        return (components as unknown as Record<string | symbol, unknown>)[prop];
      },
    }) as unknown as SecurityMiddlewareComponents;
    const server = createServer();
    servers.push(server);
    attachNodeWebSocketGuard(server, { config: { enableRedis: false }, components: broken });
    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgradeAgainst(server, port);
    expect(result.status).toBe(403);
    expect(result.body).toContain('Security check failed');
    expect(accepted).toBe(false);
  });

  it('lazily initializes components when none are provided and blocks attacks', async () => {
    const server = createServer();
    servers.push(server);
    /* No components passed: the guard single-flight builds its own from the
       config, and a suspicious upgrade request blocks through the factory
       error-response surface. */
    attachNodeWebSocketGuard(server, { config: { enableRedis: false } });
    let accepted = false;
    server.on('upgrade', (_req, socket) => {
      accepted = true;
      socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
      socket.end();
    });

    const port = await listen(server);
    const result = await upgradeAgainst(server, port, { 'x-attack': "' OR '1'='1" });
    expect(result.status).toBe(403);
    expect(result.body).toContain('Suspicious activity detected');
    expect(accepted).toBe(false);
  });

  it('builds the GuardRequest view over a raw upgrade request (unit)', async () => {
    const { NodeUpgradeGuardRequest } = await import('../../src/core/node-websocket-guard.js');
    const req = {
      url: '/gateway?room=5&flag=a&flag=b',
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'sec-websocket-key': 'k', 'x-drop': undefined },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;

    const guardReq = new NodeUpgradeGuardRequest(req, '127.0.0.1');
    expect(guardReq.urlPath).toBe('/gateway');
    expect(guardReq.urlScheme).toBe('http');
    expect(guardReq.urlFull).toBe('http://localhost/gateway?room=5&flag=a&flag=b');
    expect(guardReq.urlReplaceScheme('wss')).toBe('wss://localhost/gateway?room=5&flag=a&flag=b');
    expect(guardReq.method).toBe('WEBSOCKET');
    expect(guardReq.clientHost).toBe('127.0.0.1');
    expect(guardReq.headers).toEqual({
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'sec-websocket-key': 'k',
    });
    /* URLSearchParams keeps the last value of repeated keys. */
    expect(guardReq.queryParams['flag']).toBe('b');
    expect(guardReq.queryParams['room']).toBe('5');
    expect(await guardReq.body()).toEqual(new Uint8Array(0));
    expect(guardReq.state).toEqual({});
    expect(guardReq.scope).toEqual({});
  });

  it('forwards non-upgrade emits untouched', async () => {
    const server = createServer();
    servers.push(server);
    attachNodeWebSocketGuard(server, { config: { enableRedis: false } });
    const seen: string[] = [];
    server.on('custom-event', (value: string) => seen.push(value));
    server.emit('custom-event', 'payload');
    expect(seen).toEqual(['payload']);
  });
});
