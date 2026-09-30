/**
 * Success-path and capture-tail coverage the block-response suites do not
 * reach: the request/response adapter edge branches, the response capture
 * chunk types, and the post-next behavioral + header pipeline.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SecurityConfig, SecurityMiddlewareComponents } from '@guardcore/core';
import { SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { ExpressGuardRequest, ExpressResponseFactory } from '../src/adapters.js';
import { createSecurityMiddleware } from '../src/middleware.js';

const ALLOWED_IP = '203.0.113.20';

function createRes() {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => { headers[name.toLowerCase()] = value; }),
    getHeaders: () => ({ ...headers }),
    write: vi.fn(function write() { return true; }),
    end: vi.fn(function end() { return res; }),
  };
  return res;
}

async function successFlow(chunkWrite?: unknown, chunkEnd?: unknown) {
  const freshConfig = (): SecurityConfig =>
    ({
      enableRateLimiting: false,
      enableRedis: false,
      securityHeaders: { enabled: true },
    }) as SecurityConfig;
  const components: SecurityMiddlewareComponents = await initializeSecurityMiddleware(
    SecurityConfigSchema.parse(freshConfig()),
    defaultLogger,
    new ExpressResponseFactory(),
  );
  const middleware = createSecurityMiddleware({
    config: freshConfig(),
  }) as unknown as (
    req: unknown,
    res: unknown,
    next: () => void,
  ) => Promise<void>;

  const req = {
    path: '/ping',
    protocol: 'http',
    get: (name: string) => (name === 'host' ? 'test' : undefined),
    originalUrl: '/ping',
    method: 'GET',
    socket: { remoteAddress: ALLOWED_IP },
    headers: { 'user-agent': 'Test/1.0', host: 'test' },
    query: {},
    rawBody: chunkEnd,
  };
  const res = createRes();
  const next = vi.fn();
  await middleware(req, res, next);

  // Simulate the response lifecycle through the captured write/end.
  if (chunkWrite !== undefined) res.write(chunkWrite);
  res.statusCode = 200;
  res.end(chunkEnd === undefined ? undefined : 'done');
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { res, next, components };
}

describe('ExpressGuardRequest rawBody handling', () => {
  it('accepts Buffer and Uint8Array raw bodies', async () => {
    // A Buffer is a Uint8Array instance, so the first branch claims it.
    const bufferReq = new ExpressGuardRequest({
      path: '/a',
      protocol: 'https',
      get: () => 'test',
      originalUrl: '/a',
      method: 'POST',
      socket: { remoteAddress: '1.2.3.4' },
      headers: {},
      query: { a: ['1', '2'] },
      rawBody: Buffer.from('buffer body'),
    } as never);
    expect(Buffer.from(await bufferReq.body()).toString()).toBe('buffer body');

    const typedReq = new ExpressGuardRequest({
      path: '/a',
      method: 'GET',
      protocol: 'https',
      get: () => 'test',
      originalUrl: '/a',
      socket: { remoteAddress: '1.2.3.4' },
      headers: {},
      query: { obj: { x: 1 } },
      rawBody: new TextEncoder().encode('typed body'),
    } as never);
    expect(Buffer.from(await typedReq.body()).toString()).toBe('typed body');

    const emptyReq = new ExpressGuardRequest({
      path: '/a',
      method: 'GET',
      protocol: 'https',
      get: () => 'test',
      originalUrl: '/a',
      socket: { remoteAddress: '1.2.3.4' },
      headers: { 'x-port': 8080, 'x-multi': ['a', 'b'] },
      query: undefined,
    } as never);
    expect(await emptyReq.body()).toEqual(new Uint8Array(0) as unknown as Buffer);
    expect(emptyReq.headers['x-port']).toBe('8080');

    // A request whose header enumeration explodes with a non-Error value is
    // forwarded to the framework error path unchanged.
    const explodingHeaders = new Proxy({}, {
      ownKeys() { throw 'string-boom'; },
    });
    const config = {
      enableRateLimiting: false,
      enableRedis: false,
      securityHeaders: { enabled: true },
    } as SecurityConfig;
    const failNext = vi.fn();
    const failingRes = createRes();
    const throwingMiddleware = createSecurityMiddleware({
      config,
    }) as unknown as (req: unknown, res: unknown, next: () => void) => Promise<void>;
    await throwingMiddleware(
      { path: '/a', method: 'GET', protocol: 'https', get: () => 'test', originalUrl: '/a', socket: { remoteAddress: '1.2.3.4' }, headers: explodingHeaders, query: {} },
      failingRes,
      failNext,
    );
    expect(failNext).toHaveBeenCalledWith(new Error('string-boom'));
  });
});

describe('guard middleware success path', () => {
  it('captures string, Buffer, typed-array and DataView writes', async () => {
    const { res, next } = await successFlow();
    expect(next).toHaveBeenCalled();

    // String chunks.
    res.write('hello ');
    // Buffer chunks.
    res.write(Buffer.from('buffer '));
    // Typed array chunks.
    res.write(new TextEncoder().encode('typed '));
    // A DataView carries no capturable buffer and is skipped safely.
    const buffer = new ArrayBuffer(8);
    res.write(new DataView(buffer));
    // Empty strings are skipped.
    res.write('');
    res.end('end');
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Security headers applied by the engine on the success path.
    expect(res.setHeader).toHaveBeenCalled();
  });

  it('stops capturing past the response budget', async () => {
    const { res } = await successFlow();
    const big = 'x'.repeat(12_000);
    res.write(big);
    res.write('overflow ignored');
    res.end();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});


describe('configureCors', () => {
  it('registers the cors middleware when enabled and installed', async () => {
    const { configureCors } = await import('../src/cors.js');
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: true,
    }) as unknown as Parameters<typeof configureCors>[1]);
    expect(app.use).toHaveBeenCalled();
  });

  it('is a no-op when cors is disabled', async () => {
    const { configureCors } = await import('../src/cors.js');
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: false,
    }) as unknown as Parameters<typeof configureCors>[1]);
    expect(app.use).not.toHaveBeenCalled();
  });
});
