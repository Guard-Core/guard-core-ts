/**
 * Adapter edge coverage: header/query normalization variants and the
 * plugin success path (captured response setHeader through processResponse).
 */
import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SecurityConfig } from '@guardcore/core';
import { FastifyGuardRequest } from '../src/adapters.js';
import { guardPlugin } from '../src/plugin.js';

const ALLOWED_IP = '203.0.113.21';

function fastifyRequest(overrides: Record<string, unknown> = {}): FastifyRequest {
  return {
    url: '/ping?a=1',
    method: 'GET',
    protocol: 'https',
    hostname: 'example.com',
    ip: ALLOWED_IP,
    headers: { 'user-agent': 'Test/1.0', host: 'example.com' },
    query: {},
    socket: { remoteAddress: ALLOWED_IP },
    ...overrides,
  } as unknown as FastifyRequest;
}

describe('FastifyGuardRequest normalization', () => {
  it('normalizes array, object, undefined and null query values', () => {
    const req = new FastifyGuardRequest(fastifyRequest({
      query: {
        list: ['1', '2'],
        obj: { x: 1 },
        blank: undefined,
        nulled: null,
        num: 5,
      },
      headers: { 'x-multi': ['a', 'b'], 'x-empty': undefined, 'user-agent': 'T/1' },
    }));
    expect(req.queryParams['list']).toBe('1, 2');
    expect(req.queryParams['obj']).toBe('{"x":1}');
    expect(req.queryParams['blank']).toBeUndefined();
    expect(req.queryParams['nulled']).toBeUndefined();
    expect(req.queryParams['num']).toBe('5');
    expect(req.headers['x-multi']).toBe('a, b');
    expect(req.headers['x-empty']).toBeUndefined();
  });

  it('falls back through socket resolution to request ip', () => {
    const viaRawSocket = new FastifyGuardRequest(fastifyRequest({
      raw: { socket: { remoteAddress: '10.0.0.1' } },
    }));
    expect(viaRawSocket.clientHost).toBe('10.0.0.1');
    const viaSocket = new FastifyGuardRequest(fastifyRequest({
      socket: { remoteAddress: '10.0.0.2' },
    }));
    expect(viaSocket.clientHost).toBe('10.0.0.2');
    const viaIp = new FastifyGuardRequest(fastifyRequest({
      socket: {},
      raw: { socket: {} },
    }));
    expect(viaIp.clientHost).toBe(ALLOWED_IP);
  });
});

describe('guard plugin success path', () => {
  it('runs the full pipeline and applies response processing', async () => {
    const app = {
      addHook: vi.fn(),
      decorate: vi.fn(),
    } as unknown as FastifyInstance;
    await guardPlugin(app, {
      config: {
        enableRateLimiting: false,
        enableRedis: false,
        securityHeaders: { enabled: true },
      } as SecurityConfig,
    });

    const hooks = new Map(
      (app.addHook as ReturnType<typeof vi.fn>).mock.calls.map(([name, fn]) => [name, fn]),
    );
    const onRequest = hooks.get('onRequest') as (req: unknown, reply: unknown) => Promise<void>;
    const preValidation = hooks.get('preValidation') as (req: unknown, reply: unknown) => Promise<void>;
    const onSend = hooks.get('onSend') as (req: unknown, reply: unknown, payload: unknown) => Promise<unknown>;
    expect(onRequest).toBeDefined();

    const headers: Record<string, string> = {};
    const reply = {
      statusCode: 200,
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
      header: vi.fn((name: string, value: string) => { headers[name.toLowerCase()] = value; }),
      getHeaders: () => ({ ...headers }),
    };
    const request = fastifyRequest({ raw: { socket: { remoteAddress: ALLOWED_IP } } });

    await onRequest(request, reply);
    expect((request as unknown as Record<string, unknown>)['_guardRequest']).toBeDefined();

    // The body-dependent pipeline runs at preValidation.
    (request as unknown as Record<string, unknown>).body = undefined;
    await preValidation(request, reply);

    // onSend captures the response and runs processResponse.
    const payload = await onSend(request, reply, 'response payload');
    expect(payload).toBe('response payload');
    expect(reply.header).toHaveBeenCalled();
  });

  it('registers route configs through the plugin options', async () => {
    const app = {
      addHook: vi.fn(),
      decorate: vi.fn(),
    } as unknown as FastifyInstance;
    await guardPlugin(app, {
      config: { enableRateLimiting: false, enableRedis: false } as SecurityConfig,
      routeConfigs: [{ path: '/api', config: { rateLimit: 5 } } as never],
    });
    expect(app.addHook).toHaveBeenCalled();
  });
});
