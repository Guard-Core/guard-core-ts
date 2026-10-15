import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GuardResponse, SecurityMiddlewareComponents } from '@guardcore/core';
import {
  FastifyGuardRequest,
  FastifyGuardResponse,
  FastifyResponseFactory,
} from '../src/adapters.js';
import { configureCors } from '../src/cors.js';

function createMockFastifyRequest(overrides = {}) {
  return {
    url: '/api/test?q=1',
    protocol: 'https',
    hostname: 'example.com',
    method: 'GET',
    ip: '1.2.3.4',
    headers: { 'user-agent': 'Test/1.0' },
    query: { q: '1' },
    body: undefined,
    ...overrides,
  } as never;
}

describe('FastifyGuardRequest', () => {
  let request: FastifyGuardRequest;

  beforeEach(() => {
    request = new FastifyGuardRequest(createMockFastifyRequest());
  });

  it('returns correct urlPath without query string', () => {
    expect(request.urlPath).toBe('/api/test');
  });

  it('returns correct urlScheme', () => {
    expect(request.urlScheme).toBe('https');
  });

  it('returns correct urlFull', () => {
    expect(request.urlFull).toBe('https://example.com/api/test?q=1');
  });

  it('replaces scheme with urlReplaceScheme', () => {
    expect(request.urlReplaceScheme('http')).toBe('http://example.com/api/test?q=1');
  });

  it('returns correct method', () => {
    expect(request.method).toBe('GET');
  });

  it('returns correct clientHost', () => {
    expect(request.clientHost).toBe('1.2.3.4');
  });

  it('returns null clientHost when ip is undefined', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({ ip: undefined }));
    expect(req.clientHost).toBeNull();
  });

  it('prefers the raw socket peer address over request.ip', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({
      raw: { socket: { remoteAddress: '10.1.1.1' } },
      ip: '4.4.4.4',
    }));
    expect(req.clientHost).toBe('10.1.1.1');
  });

  it('falls back to request.socket then request.ip for clientHost', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({
      socket: { remoteAddress: '10.2.2.2' },
      ip: '4.4.4.4',
    }));
    expect(req.clientHost).toBe('10.2.2.2');
  });

  it('joins array-valued headers into a single string', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({
      headers: { 'set-cookie': ['a=1', 'b=2'], 'user-agent': 'Test/1.0' },
    }));
    expect(req.headers['set-cookie']).toBe('a=1, b=2');
  });

  it('flattens array and nested query params into strings', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({
      query: { tags: ['a', 'b'], nested: { x: 1 }, flag: 1 },
    }));
    expect(req.queryParams).toEqual({ tags: 'a, b', nested: '{"x":1}', flag: '1' });
  });

  it('returns correct headers', () => {
    expect(request.headers).toEqual({ 'user-agent': 'Test/1.0' });
  });

  it('returns correct queryParams', () => {
    expect(request.queryParams).toEqual({ q: '1' });
  });

  it('returns empty object for queryParams when query is undefined', () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({ query: undefined }));
    expect(req.queryParams).toEqual({});
  });

  it('returns empty state object', () => {
    expect(request.state).toEqual({});
  });

  it('returns empty scope object', () => {
    expect(request.scope).toEqual({});
  });

  it('state is mutable', () => {
    request.state['key'] = 'value';
    expect(request.state['key']).toBe('value');
  });
});

describe('FastifyGuardRequest.body()', () => {
  it('returns Uint8Array from Buffer body', async () => {
    const buf = Buffer.from('hello');
    const req = new FastifyGuardRequest(createMockFastifyRequest({ body: buf }));
    const body = await req.body();
    expect(body).toEqual(new Uint8Array(buf));
  });

  it('returns encoded string body', async () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({ body: 'hello' }));
    const body = await req.body();
    expect(body).toEqual(new TextEncoder().encode('hello'));
  });

  it('returns JSON-encoded object body', async () => {
    const obj = { key: 'value' };
    const req = new FastifyGuardRequest(createMockFastifyRequest({ body: obj }));
    const body = await req.body();
    expect(body).toEqual(new TextEncoder().encode(JSON.stringify(obj)));
  });

  it('returns empty Uint8Array for undefined body', async () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({ body: undefined }));
    const body = await req.body();
    expect(body).toEqual(new Uint8Array(0));
  });

  it('returns empty Uint8Array for null body', async () => {
    const req = new FastifyGuardRequest(createMockFastifyRequest({ body: null }));
    const body = await req.body();
    expect(body).toEqual(new Uint8Array(0));
  });
});

describe('FastifyGuardResponse', () => {
  it('sets statusCode and encodes content', () => {
    const response = new FastifyGuardResponse(200, '{"ok":true}');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Uint8Array);
    expect(response.bodyText).toBe('{"ok":true}');
  });

  it('sets content-type header to text/plain', () => {
    const response = new FastifyGuardResponse(200, 'test');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('setHeader adds headers', () => {
    const response = new FastifyGuardResponse(200, 'test');
    response.setHeader('x-custom', 'value');
    expect(response.headers['x-custom']).toBe('value');
  });

  it('returns null bodyText when body is empty', () => {
    const response = new FastifyGuardResponse(200, '');
    expect(response.bodyText).toBe('');
  });
});

describe('FastifyResponseFactory', () => {
  let factory: FastifyResponseFactory;

  beforeEach(() => {
    factory = new FastifyResponseFactory();
  });

  it('creates a plain-text response carrying the message itself', () => {
    const response = factory.createResponse('Forbidden', 403);
    expect(response.statusCode).toBe(403);
    expect(response.bodyText).toBe('Forbidden');
  });

  it('creates a redirect response with location header', () => {
    const response = factory.createRedirectResponse('https://example.com', 302);
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe('https://example.com');
  });
});

const { mockComponents, mockInitialize } = vi.hoisted(() => {
  const components = {
    pipeline: { execute: vi.fn().mockResolvedValue(null), getCheckNames: () => [] },
    bypassHandler: {
      handlePassthrough: vi.fn().mockResolvedValue(null),
      handleSecurityBypass: vi.fn().mockResolvedValue(null),
      beginSecurityBypass: vi.fn().mockResolvedValue(false),
    },
    routeResolver: { getRouteConfig: vi.fn().mockReturnValue(null) },
    behavioralProcessor: { processUsageRules: vi.fn(), processReturnRules: vi.fn() },
    errorResponseFactory: {
      processResponse: vi.fn().mockImplementation((_: unknown, r: unknown) => Promise.resolve(r)),
      applyModifier: vi.fn().mockImplementation((r: unknown) => Promise.resolve(r)),
    },
    middlewareProtocol: {},
    registry: {},
    eventBus: {},
    metricsCollector: {},
    validator: {},
  } as unknown as SecurityMiddlewareComponents;
  const init = vi.fn();
  return { mockComponents: components, mockInitialize: init };
});

vi.mock('@guardcore/core', async () => {
  const actual = await vi.importActual('@guardcore/core');
  return {
    ...(actual as Record<string, unknown>),
    initializeSecurityMiddleware: mockInitialize,
  };
});

mockInitialize.mockResolvedValue(mockComponents);

describe('guardPlugin', () => {
  async function createPlugin() {
    const { guardPlugin } = await import('../src/plugin.js');
    const hooks: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    const mockFastify = {
      addHook: vi.fn((name: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        hooks[name] = handler;
      }),
    } as never;

    await guardPlugin(mockFastify, { config: {} });

    return { hooks, mockFastify };
  }

  function createMockRequest(overrides = {}) {
    return {
      url: '/api/test?q=1',
      protocol: 'https',
      hostname: 'example.com',
      method: 'GET',
      ip: '10.0.0.1',
      headers: {},
      query: {},
      body: undefined,
      ...overrides,
    };
  }

  function createMockReply() {
    return {
      statusCode: 200,
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      redirect: vi.fn(),
      getHeaders: vi.fn(() => ({ 'content-type': 'application/json', 'x-powered-by': 'Fastify' })),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialize.mockResolvedValue(mockComponents);
    (mockComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockComponents.bypassHandler.handleSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValue(null);
(mockComponents.bypassHandler.beginSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (mockComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (mockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation((_: unknown, r: unknown) => Promise.resolve(r));
  });

  it('registers onRequest, preValidation and onSend hooks', async () => {
    const { mockFastify } = await createPlugin();
    const typedFastify = mockFastify as unknown as { addHook: ReturnType<typeof vi.fn> };
    expect(typedFastify.addHook).toHaveBeenCalledWith('onRequest', expect.anything());
    expect(typedFastify.addHook).toHaveBeenCalledWith('preValidation', expect.anything());
    expect(typedFastify.addHook).toHaveBeenCalledWith('onSend', expect.anything());
  });

  it('onRequest passes the request through when no passthrough or bypass applies', async () => {
    const { hooks } = await createPlugin();
    const request = createMockRequest();
    const reply = createMockReply();

    await hooks['onRequest'](request, reply);

    expect(reply.send).not.toHaveBeenCalled();
    expect((request as unknown as Record<string, unknown>)['_guardRequest']).toBeDefined();
    expect((request as unknown as Record<string, unknown>)['_guardStartTime']).toBeTypeOf('number');
  });

  it('onRequest sends an empty body when the passthrough response has no body text', async () => {
    const { hooks } = await createPlugin();
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => ({ statusCode: 403, headers: {}, setHeader() {}, body: null, bodyText: null }),
    );

    const reply = createMockReply();
    await hooks['onRequest'](createMockRequest(), reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith('');
  });

  it('onRequest sends response when passthrough returns', async () => {
    const { hooks } = await createPlugin();
    const passthroughResponse: GuardResponse = {
      statusCode: 200,
      headers: { 'x-test': 'yes' },
      setHeader() {},
      body: null,
      bodyText: 'ok',
    };
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => passthroughResponse,
    );

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith('ok');
  });

  it('onRequest stamps an all-checks bypass route and skips the pipeline', async () => {
    const { hooks } = await createPlugin();
    (mockComponents.bypassHandler.beginSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(reply.send).not.toHaveBeenCalled();
    expect(mockComponents.pipeline.execute).not.toHaveBeenCalled();
  });

  it('preValidation runs the pipeline after onRequest has stamped the request', async () => {
    const { hooks } = await createPlugin();
    const request = createMockRequest();
    const reply = createMockReply();

    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(mockComponents.pipeline.execute).toHaveBeenCalledTimes(1);
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('preValidation sends response when pipeline blocks', async () => {
    const { hooks } = await createPlugin();
    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode('blocked'),
      bodyText: 'blocked',
    };
    (mockComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith('blocked');
  });

  it('preValidation exposes the parsed request body to the engine', async () => {
    const { hooks } = await createPlugin();
    const payload = Buffer.from('{"q":"<script>alert(1)</script>"}');
    const request = createMockRequest({ method: 'POST', body: payload });
    const reply = createMockReply();

    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(mockComponents.pipeline.execute).toHaveBeenCalledTimes(1);
    const guardReq = (mockComponents.pipeline.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as FastifyGuardRequest;
    expect(Buffer.from(await guardReq.body()).toString()).toBe(payload.toString());
  });

  it('preValidation skips the pipeline when passthrough already answered', async () => {
    const { hooks } = await createPlugin();
    const passthroughResponse: GuardResponse = {
      statusCode: 200,
      headers: {},
      setHeader() {},
      body: null,
      bodyText: 'ok',
    };
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValueOnce(passthroughResponse);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(mockComponents.pipeline.execute).not.toHaveBeenCalled();
  });

  it('preValidation processes usage rules when routeConfig has behaviorRules', async () => {
    const { hooks } = await createPlugin();
    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (mockComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(mockComponents.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), '10.0.0.1', routeConfig,
    );
  });

  it('preValidation uses unknown when ip is undefined', async () => {
    const { hooks } = await createPlugin();
    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (mockComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const request = createMockRequest({ ip: undefined });
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);
    await hooks['preValidation'](request, reply);

    expect(mockComponents.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), 'unknown', routeConfig,
    );
  });

  it('onRequest redirects when location header present', async () => {
    const { hooks } = await createPlugin();
    const redirectResponse: GuardResponse = {
      statusCode: 302,
      headers: { location: 'https://example.com' },
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValueOnce(redirectResponse);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    expect(reply.redirect).toHaveBeenCalledWith('https://example.com', 302);
  });

  it('onRequest preserves a 301 redirect status from the engine', async () => {
    const { hooks } = await createPlugin();
    const redirectResponse: GuardResponse = {
      statusCode: 301,
      headers: { location: 'https://example.com/login' },
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (mockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValueOnce(redirectResponse);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    expect(reply.redirect).toHaveBeenCalledWith('https://example.com/login', 301);
  });

  it('onSend returns payload when no guard request stored', async () => {
    const { hooks } = await createPlugin();
    const request = {};
    const reply = createMockReply();
    const result = await hooks['onSend'](request, reply, 'payload');
    expect(result).toBe('payload');
  });

  it('onSend returns payload when startTime is undefined', async () => {
    const { hooks } = await createPlugin();
    const request = { _guardRequest: {}, _guardRouteConfig: null };
    const reply = createMockReply();
    const result = await hooks['onSend'](request, reply, 'payload');
    expect(result).toBe('payload');
  });

  it('onSend calls processResponse with string payload', async () => {
    (mockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        capturedRes.setHeader('x-guard', 'done');
        return capturedRes;
      },
    );
    const { hooks } = await createPlugin();

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    const reply2 = createMockReply();
    const result = await hooks['onSend'](request, reply2, 'response body');
    expect(result).toBe('response body');
    expect(reply2.header).toHaveBeenCalledWith('x-guard', 'done');
  });

  it('onSend handles non-string payload', async () => {
    const { hooks } = await createPlugin();

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    const reply2 = createMockReply();
    const result = await hooks['onSend'](request, reply2, Buffer.from('binary'));
    expect(result).toEqual(Buffer.from('binary'));
  });

  it('onSend passes behavioral callback when routeConfig exists', async () => {
    const { hooks } = await createPlugin();

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (mockComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    const reply2 = createMockReply();
    await hooks['onSend'](request, reply2, 'body');

    const lastCall = (mockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[
      (mockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ];
    const callback = lastCall[4] as ((...args: unknown[]) => Promise<void>) | undefined;
    expect(callback).toBeDefined();
    if (callback) {
      await callback({} as never, {} as never, '10.0.0.1', routeConfig as never);
      expect(mockComponents.behavioralProcessor.processReturnRules).toHaveBeenCalled();
    }
  });

  it('onSend does not pass behavioral callback when no routeConfig', async () => {
    const { hooks } = await createPlugin();

    const request = createMockRequest();
    const reply = createMockReply();
    await hooks['onRequest'](request, reply);

    const reply2 = createMockReply();
    await hooks['onSend'](request, reply2, 'body');

    const lastCall = (mockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(lastCall[4]).toBeUndefined();
  });
});

describe('configureCors for Fastify', () => {
  it('does nothing when enableCors is false', async () => {
    const mockFastify = { register: vi.fn() } as never;
    await configureCors(mockFastify, { enableCors: false } as never);
    const typed = mockFastify as unknown as { register: ReturnType<typeof vi.fn> };
    expect(typed.register).not.toHaveBeenCalled();
  });

  it('throws when @fastify/cors is not installed', async () => {
    const mockFastify = {
      register: vi.fn().mockRejectedValue(new Error('not found')),
    } as never;
    await expect(configureCors(mockFastify, {
      enableCors: true,
      corsAllowOrigins: ['*'],
      corsAllowMethods: ['GET'],
      corsAllowHeaders: ['*'],
      corsAllowCredentials: false,
      corsExposeHeaders: [],
      corsMaxAge: 600,
    } as never)).rejects.toThrow('@guardcore/fastify: CORS is enabled but "@fastify/cors" is not installed');
  });
});

describe('FastifyGuardResponse bodyText null branch', () => {
  it('returns null bodyText when body is null', () => {
    const response = new FastifyGuardResponse(200, 'content');
    (response as unknown as Record<string, unknown>)['_body'] = null;
    expect(response.bodyText).toBeNull();
  });
});
