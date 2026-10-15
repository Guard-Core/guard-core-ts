import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GuardResponse, SecurityMiddlewareComponents } from '@guardcore/core';
import {
  NestGuardRequest,
  NestGuardResponse,
  NestResponseFactory,
} from '../src/adapters.js';

vi.mock('@guardcore/core', async () => {
  const actual = await vi.importActual('@guardcore/core');
  return {
    ...(actual as Record<string, unknown>),
    initializeSecurityMiddleware: vi.fn().mockResolvedValue({
      pipeline: { execute: vi.fn() },
      bypassHandler: { handlePassthrough: vi.fn(), handleSecurityBypass: vi.fn(), beginSecurityBypass: vi.fn() },
      routeResolver: { getRouteConfig: vi.fn() },
      behavioralProcessor: { processUsageRules: vi.fn(), processReturnRules: vi.fn() },
      errorResponseFactory: { processResponse: vi.fn(), applyModifier: vi.fn() },
      middlewareProtocol: {},
      registry: {},
      eventBus: {},
      metricsCollector: {},
      validator: {},
    }),
  };
});

function createMockExpressRequest(overrides = {}) {
  return {
    path: '/api/test',
    protocol: 'https',
    get: (name: string) => name === 'host' ? 'example.com' : undefined,
    originalUrl: '/api/test?q=1',
    method: 'GET',
    socket: { remoteAddress: '1.2.3.4' },
    headers: { 'user-agent': 'Test/1.0' },
    query: { q: '1' },
    ...overrides,
  } as never;
}

describe('NestGuardRequest', () => {
  let request: NestGuardRequest;

  beforeEach(() => {
    request = new NestGuardRequest(createMockExpressRequest());
  });

  it('returns correct urlPath', () => {
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

  it('returns null clientHost when remoteAddress is undefined', () => {
    const req = new NestGuardRequest(createMockExpressRequest({
      socket: { remoteAddress: undefined },
    }));
    expect(req.clientHost).toBeNull();
  });

  it('returns correct headers', () => {
    expect(request.headers).toEqual({ 'user-agent': 'Test/1.0' });
  });

  it('joins array-valued headers into a single string', () => {
    const req = new NestGuardRequest(createMockExpressRequest({
      headers: { 'set-cookie': ['a=1', 'b=2'], 'user-agent': 'Test/1.0' },
    }));
    expect(req.headers['set-cookie']).toBe('a=1, b=2');
  });

  it('drops undefined header values instead of leaking them to the engine', () => {
    const req = new NestGuardRequest(createMockExpressRequest({
      headers: { 'user-agent': 'Test/1.0', 'x-empty': undefined },
    }));
    expect(req.headers).toEqual({ 'user-agent': 'Test/1.0' });
  });

  it('flattens array and nested query params into strings', () => {
    const req = new NestGuardRequest(createMockExpressRequest({
      query: { tags: ['a', 'b'], nested: { x: 1 }, flag: 1 },
    }));
    expect(req.queryParams).toEqual({ tags: 'a, b', nested: '{"x":1}', flag: '1' });
  });

  it('drops null and undefined query params', () => {
    const req = new NestGuardRequest(createMockExpressRequest({
      query: { q: '1', gone: undefined, nulled: null },
    }));
    expect(req.queryParams).toEqual({ q: '1' });
  });

  it('returns correct queryParams', () => {
    expect(request.queryParams).toEqual({ q: '1' });
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

describe('NestGuardRequest.body()', () => {
  it('returns rawBody as Uint8Array when rawBody is Uint8Array', async () => {
    const rawBytes = new Uint8Array([72, 101, 108, 108, 111]);
    const req = new NestGuardRequest(createMockExpressRequest({ rawBody: rawBytes }));
    const body = await req.body();
    expect(body).toEqual(rawBytes);
  });

  it('returns rawBody as Uint8Array when rawBody is Buffer', async () => {
    const rawBuffer = Buffer.from('Hello');
    const req = new NestGuardRequest(createMockExpressRequest({ rawBody: rawBuffer }));
    const body = await req.body();
    expect(body).toBeInstanceOf(Uint8Array);
    expect(Array.from(body)).toEqual(Array.from(rawBuffer));
  });

  it('returns empty Uint8Array when no rawBody', async () => {
    const req = new NestGuardRequest(createMockExpressRequest());
    const body = await req.body();
    expect(body).toEqual(new Uint8Array(0));
  });
});

describe('NestGuardResponse', () => {
  it('sets statusCode and encodes content', () => {
    const response = new NestGuardResponse(200, '{"ok":true}');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Uint8Array);
    expect(response.bodyText).toBe('{"ok":true}');
  });

  it('sets content-type header to text/plain', () => {
    const response = new NestGuardResponse(200, 'test');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('setHeader adds headers', () => {
    const response = new NestGuardResponse(200, 'test');
    response.setHeader('x-custom', 'value');
    expect(response.headers['x-custom']).toBe('value');
  });
});

describe('NestResponseFactory', () => {
  let factory: NestResponseFactory;

  beforeEach(() => {
    factory = new NestResponseFactory();
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

describe('NestGuardResponse bodyText null branch', () => {
  it('returns null bodyText when body is null', () => {
    const response = new NestGuardResponse(200, 'content');
    (response as unknown as Record<string, unknown>)['_body'] = null;
    expect(response.bodyText).toBeNull();
  });
});

describe('SecurityMiddlewareNest', () => {
  function createMockComponents(): SecurityMiddlewareComponents {
    return {
      pipeline: { execute: vi.fn().mockResolvedValue(null), getCheckNames: () => [] },
      bypassHandler: {
        handlePassthrough: vi.fn().mockResolvedValue(null),
        handleSecurityBypass: vi.fn().mockResolvedValue(null),
      beginSecurityBypass: vi.fn().mockResolvedValue(false),
      },
      routeResolver: { getRouteConfig: vi.fn().mockReturnValue(null) },
      behavioralProcessor: { processUsageRules: vi.fn(), processReturnRules: vi.fn() },
      errorResponseFactory: { processResponse: vi.fn().mockResolvedValue(undefined), applyModifier: vi.fn().mockResolvedValue(undefined) },
      middlewareProtocol: {},
      registry: {},
      eventBus: {},
      metricsCollector: {},
      validator: {},
    } as unknown as SecurityMiddlewareComponents;
  }

  function createMockReq(overrides = {}) {
    return {
      path: '/api/test',
      protocol: 'https',
      get: (name: string) => name === 'host' ? 'example.com' : undefined,
      originalUrl: '/api/test',
      method: 'GET',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {},
      query: {},
      ...overrides,
    } as never;
  }

  function createMockRes() {
    const headers: Record<string, string> = {};
    return {
      statusCode: 200,
      setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
      getHeaders: vi.fn(() => ({ ...headers })),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      redirect: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      _headers: headers,
    };
  }

  it('calls next when pipeline allows request', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('sends an empty body when the passthrough response has no body', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);
    (components.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => ({ statusCode: 403, headers: {}, setHeader() {}, body: null, bodyText: null }),
    );

    const res = createMockRes();
    await middleware.use(createMockReq(), res as never, vi.fn());

    expect(res.send).toHaveBeenCalledWith('');
  });

  it('sends response when passthrough returns', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const passthroughResponse: GuardResponse = {
      statusCode: 200,
      headers: { 'x-pass': 'yes' },
      setHeader() {},
      body: null,
      bodyText: 'pass',
    };
    (components.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => passthroughResponse,
    );

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('pass');
  });

  it('continues to the downstream handler on an all-checks bypass route', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);
    (components.bypassHandler.beginSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(components.pipeline.execute).not.toHaveBeenCalled();
  });

  it('sends response when pipeline blocks', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode('blocked'),
      bodyText: 'blocked',
    };
    (components.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('sends the engine body without re-wrapping it in a detail envelope', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode(JSON.stringify({ detail: 'Blocked' })),
      bodyText: JSON.stringify({ detail: 'Blocked' }),
    };
    (components.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledTimes(1);
    expect((res.send as ReturnType<typeof vi.fn>).mock.calls[0][0].toString()).toBe(
      JSON.stringify({ detail: 'Blocked' }),
    );
  });

  it('redirects when location header present', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const redirectResponse: GuardResponse = {
      statusCode: 302,
      headers: { location: 'https://example.com' },
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (components.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValueOnce(redirectResponse);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(res.redirect).toHaveBeenCalledWith(302, 'https://example.com');
  });

  it('processes usage rules when routeConfig has behaviorRules', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (components.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(components.behavioralProcessor.processUsageRules).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('uses unknown when clientHost is null', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (components.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const req = createMockReq({ socket: { remoteAddress: undefined } });
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    expect(components.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), 'unknown', routeConfig,
    );
  });

  it('stores guard request data on the request object', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    const typedReq = req as unknown as Record<string, unknown>;
    expect(typedReq['_guardRequest']).toBeDefined();
    expect(typedReq['_guardRouteConfig']).toBeNull();
    expect(typeof typedReq['_guardStartTime']).toBe('number');
  });

  it('calls processResponse when the response ends and applies headers before end', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    const events: string[] = [];
    (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation(
      async (_req: unknown, capturedRes: GuardResponse) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        capturedRes.setHeader('x-guard', 'done');
        events.push('processResponse');
        return capturedRes;
      },
    );

    const req = createMockReq();
    const res = createMockRes();
    const originalEnd = res.end as ReturnType<typeof vi.fn>;
    originalEnd.mockImplementation(() => {
      events.push('end');
      return res;
    });
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    res.end('response body');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalled();
    });
    expect(events).toEqual(['processResponse', 'end']);
    expect(res._headers['x-guard']).toBe('done');
  });

  it('captures chunks written via res.write into the response body', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    let captured: GuardResponse | undefined;
    (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation(
      async (_req: unknown, capturedRes: GuardResponse) => {
        captured = capturedRes;
        return capturedRes;
      },
    );

    const req = createMockReq();
    const res = createMockRes();
    const originalEnd = res.end as ReturnType<typeof vi.fn>;
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    res.write('hello ');
    res.end('world');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalled();
    });
    expect(captured?.bodyText).toBe('hello world');
  });

  it('still ends the response when processResponse rejects', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('processing failed'),
    );

    const req = createMockReq();
    const res = createMockRes();
    const originalEnd = res.end as ReturnType<typeof vi.fn>;
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    res.end('data');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalled();
    });
    expect(next).toHaveBeenCalled();
  });

  it('caps the captured response body at the bounded read limit', async () => {
    const { SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const components = createMockComponents();
    const middleware = new SecurityMiddlewareNest(components);

    let captured: GuardResponse | undefined;
    (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation(
      async (_req: unknown, capturedRes: GuardResponse) => {
        captured = capturedRes;
        return capturedRes;
      },
    );

    const req = createMockReq();
    const res = createMockRes();
    const originalEnd = res.end as ReturnType<typeof vi.fn>;
    const next = vi.fn();

    await middleware.use(req, res as never, next);

    res.write('a'.repeat(50_000));
    res.end('');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalled();
    });
    expect(captured?.bodyText?.length).toBe(10_000);
  });
});

describe('GuardModule', () => {
  it('forRoot returns a DynamicModule with correct structure', async () => {
    const { GuardModule, GUARD_MIDDLEWARE_TOKEN, SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const result = GuardModule.forRoot({ config: {} });

    expect(result.module).toBe(GuardModule);
    expect(result.global).toBe(true);
    expect(result.exports).toContain(SecurityMiddlewareNest);
    expect(result.exports).toContain(GUARD_MIDDLEWARE_TOKEN);
    expect(result.providers).toBeDefined();
    expect(Array.isArray(result.providers)).toBe(true);
  });

  it('configure applies middleware to all routes', async () => {
    const { GuardModule, SecurityMiddlewareNest } = await import('../src/guard-module.js');
    const module = new GuardModule();
    const forRoutes = vi.fn();
    const apply = vi.fn().mockReturnValue({ forRoutes });
    const consumer = { apply } as never;

    module.configure(consumer);

    expect(apply).toHaveBeenCalledWith(SecurityMiddlewareNest);
    expect(forRoutes).toHaveBeenCalledWith('*');
  });

  it('forRoot useFactory initializes components', async () => {
    const { GuardModule } = await import('../src/guard-module.js');
    const result = GuardModule.forRoot({ config: {} });
    const providers = result.providers as Array<{ provide?: symbol; useFactory?: () => Promise<unknown> }>;
    const factoryProvider = providers.find(p => p.provide && p.useFactory);

    expect(factoryProvider).toBeDefined();
    if (factoryProvider?.useFactory) {
      const components = await factoryProvider.useFactory();
      expect(components).toBeDefined();
    }
  });
});
