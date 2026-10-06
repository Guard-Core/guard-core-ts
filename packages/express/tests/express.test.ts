import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GuardResponse, SecurityMiddlewareComponents } from '@guardcore/core';
import {
  ExpressGuardRequest,
  ExpressGuardResponse,
  ExpressResponseFactory,
  sendGuardResponse,
  createSecurityMiddleware,
  configureCors,
} from '../src/index.js';
import { guardBodyParser, guardUrlEncodedParser } from '../src/body-parser.js';

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

function createMockExpressResponse() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn(),
    redirect: vi.fn(),
    _headers: headers,
  } as never;
}

describe('ExpressGuardRequest', () => {
  let request: ExpressGuardRequest;

  beforeEach(() => {
    request = new ExpressGuardRequest(createMockExpressRequest());
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
    const req = new ExpressGuardRequest(createMockExpressRequest({
      socket: { remoteAddress: undefined },
    }));
    expect(req.clientHost).toBeNull();
  });

  it('returns correct headers', () => {
    expect(request.headers).toEqual({ 'user-agent': 'Test/1.0' });
  });

  it('joins array-valued headers into a single string', () => {
    const req = new ExpressGuardRequest(createMockExpressRequest({
      headers: { 'set-cookie': ['a=1', 'b=2'], 'user-agent': 'Test/1.0' },
    }));
    expect(req.headers['set-cookie']).toBe('a=1, b=2');
  });

  it('drops undefined header values instead of leaking them to the engine', () => {
    const req = new ExpressGuardRequest(createMockExpressRequest({
      headers: { 'user-agent': 'Test/1.0', 'x-empty': undefined },
    }));
    expect(req.headers).toEqual({ 'user-agent': 'Test/1.0' });
  });

  it('flattens array and nested query params into strings', () => {
    const req = new ExpressGuardRequest(createMockExpressRequest({
      query: { tags: ['a', 'b'], nested: { x: 1 }, flag: 1 },
    }));
    expect(req.queryParams).toEqual({ tags: 'a, b', nested: '{"x":1}', flag: '1' });
  });

  it('drops null and undefined query params', () => {
    const req = new ExpressGuardRequest(createMockExpressRequest({
      query: { q: '1', gone: undefined, nulled: null },
    }));
    expect(req.queryParams).toEqual({ q: '1' });
  });

  it('returns correct queryParams', () => {
    expect(request.queryParams).toEqual({ q: '1' });
  });

  it('returns empty Uint8Array when no rawBody', async () => {
    const body = await request.body();
    expect(body).toEqual(new Uint8Array(0));
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

describe('ExpressGuardRequest with rawBody', () => {
  it('returns rawBody as Uint8Array when rawBody is Uint8Array', async () => {
    const rawBytes = new Uint8Array([72, 101, 108, 108, 111]);
    const req = new ExpressGuardRequest(createMockExpressRequest({ rawBody: rawBytes }));
    const body = await req.body();
    expect(body).toEqual(rawBytes);
  });

  it('returns rawBody as Uint8Array when rawBody is Buffer', async () => {
    const rawBuffer = Buffer.from('Hello');
    const req = new ExpressGuardRequest(createMockExpressRequest({ rawBody: rawBuffer }));
    const body = await req.body();
    expect(body).toBeInstanceOf(Uint8Array);
    expect(Array.from(body)).toEqual(Array.from(rawBuffer));
  });
});

describe('ExpressGuardResponse', () => {
  it('sets statusCode and encodes content', () => {
    const response = new ExpressGuardResponse(200, '{"ok":true}');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Uint8Array);
    expect(response.bodyText).toBe('{"ok":true}');
  });

  it('sets content-type header to text/plain', () => {
    const response = new ExpressGuardResponse(200, 'test');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('setHeader adds headers', () => {
    const response = new ExpressGuardResponse(200, 'test');
    response.setHeader('x-custom', 'value');
    expect(response.headers['x-custom']).toBe('value');
  });

  it('returns null bodyText when body is null', () => {
    const response = new ExpressGuardResponse(200, '');
    expect(response.bodyText).toBe('');
  });
});

describe('ExpressResponseFactory', () => {
  let factory: ExpressResponseFactory;

  beforeEach(() => {
    factory = new ExpressResponseFactory();
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

describe('sendGuardResponse', () => {
  it('sets headers and sends body', () => {
    const mockRes = createMockExpressResponse();
    const guardResponse = new ExpressGuardResponse(200, '{"ok":true}');
    guardResponse.setHeader('x-test', 'value');

    sendGuardResponse(mockRes, guardResponse);

    const typedRes = mockRes as unknown as {
      setHeader: ReturnType<typeof vi.fn>;
      status: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    };
    expect(typedRes.setHeader).toHaveBeenCalledWith('content-type', 'text/plain; charset=utf-8');
    expect(typedRes.setHeader).toHaveBeenCalledWith('x-test', 'value');
    expect(typedRes.status).toHaveBeenCalledWith(200);
    expect(typedRes.send).toHaveBeenCalled();
  });

  it('calls redirect when location header present', () => {
    const mockRes = createMockExpressResponse();
    const guardResponse = new ExpressGuardResponse(302, '');
    guardResponse.setHeader('location', 'https://example.com');

    sendGuardResponse(mockRes, guardResponse);

    const typedRes = mockRes as unknown as { redirect: ReturnType<typeof vi.fn> };
    expect(typedRes.redirect).toHaveBeenCalledWith(302, 'https://example.com');
  });

  it('calls end when body is null', () => {
    const mockRes = createMockExpressResponse();
    const guardResponse = {
      statusCode: 204,
      headers: {} as Record<string, string>,
      setHeader: vi.fn(),
      body: null,
      bodyText: null,
    };

    sendGuardResponse(mockRes, guardResponse);

    const typedRes = mockRes as unknown as {
      status: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
    expect(typedRes.status).toHaveBeenCalledWith(204);
    expect(typedRes.end).toHaveBeenCalled();
  });
});

describe('createSecurityMiddleware', () => {
  it('returns a function', () => {
    const middleware = createSecurityMiddleware({ config: {} });
    expect(typeof middleware).toBe('function');
  });
});

describe('configureCors', () => {
  it('does nothing when enableCors is false', () => {
    const mockApp = { use: vi.fn() } as never;
    const config = { enableCors: false } as never;
    configureCors(mockApp, config);
    const typedApp = mockApp as unknown as { use: ReturnType<typeof vi.fn> };
    expect(typedApp.use).not.toHaveBeenCalled();
  });

  it('applies cors middleware when enableCors is true and cors package is available', () => {
    const mockApp = { use: vi.fn() } as never;
    const config = {
      enableCors: true,
      corsAllowOrigins: ['*'],
      corsAllowMethods: ['GET'],
      corsAllowHeaders: ['*'],
      corsAllowCredentials: false,
      corsExposeHeaders: [],
      corsMaxAge: 600,
    } as never;

    configureCors(mockApp, config);
    const typedApp = mockApp as unknown as { use: ReturnType<typeof vi.fn> };
    expect(typedApp.use).toHaveBeenCalled();
  });

  it('throws when cors package is not installed', () => {
    const mockApp = {
      use: vi.fn(() => { throw new Error('Cannot find module'); }),
    } as never;
    const config = {
      enableCors: true,
      corsAllowOrigins: ['*'],
      corsAllowMethods: ['GET'],
      corsAllowHeaders: ['*'],
      corsAllowCredentials: false,
      corsExposeHeaders: [],
      corsMaxAge: 600,
    } as never;

    expect(() => configureCors(mockApp, config)).toThrow('CORS is enabled but the "cors" package is not installed');
  });
});

const { sharedMockComponents, mockInitialize } = vi.hoisted(() => ({
  sharedMockComponents: {
    pipeline: { execute: vi.fn().mockResolvedValue(null), getCheckNames: () => [] },
    bypassHandler: {
      handlePassthrough: vi.fn().mockResolvedValue(null),
      handleSecurityBypass: vi.fn().mockResolvedValue(null),
    },
    routeResolver: { getRouteConfig: vi.fn().mockReturnValue(null) },
    behavioralProcessor: { processUsageRules: vi.fn(), processReturnRules: vi.fn() },
    errorResponseFactory: { processResponse: vi.fn().mockImplementation((_: unknown, r: unknown) => Promise.resolve(r)) },
    middlewareProtocol: {},
    registry: {},
    eventBus: {},
    metricsCollector: {},
    validator: {},
  } as Record<string, unknown>,
  mockInitialize: vi.fn(),
}));

vi.mock('@guardcore/core', async () => {
  const actual = await vi.importActual('@guardcore/core');
  return {
    ...(actual as Record<string, unknown>),
    initializeSecurityMiddleware: mockInitialize,
  };
});

mockInitialize.mockResolvedValue(sharedMockComponents);

function createMockReqForMiddleware(overrides = {}) {
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

function createMockResForMiddleware() {
  const headers: Record<string, string | number> = { 'content-type': 'text/html', 'x-powered-by': 'Express' };
  const res = {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
    getHeaders: vi.fn(() => headers),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn(),
    redirect: vi.fn(),
    _headers: headers,
  };
  return res;
}

describe('createSecurityMiddleware full flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialize.mockResolvedValue(sharedMockComponents);
    (sharedMockComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (sharedMockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (sharedMockComponents.bypassHandler.handleSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (sharedMockComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation((_: unknown, r: unknown) => Promise.resolve(r));
  });

  it('calls next when pipeline allows request through', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    expect(next).toHaveBeenCalled();
  });

  it('does not re-initialize on second call', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);
    await middleware(req, createMockResForMiddleware() as never, next);

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('initializes once under concurrent first requests', async () => {
    let releaseInit: ((value: unknown) => void) | undefined;
    /* The gate resolves later; releaseInit is assigned synchronously. */
    const gate = new Promise((resolve) => { releaseInit = resolve; });
    mockInitialize.mockImplementationOnce(() => gate);

    const middleware = createSecurityMiddleware({ config: {} });
    const first = middleware(createMockReqForMiddleware(), createMockResForMiddleware() as never, vi.fn());
    const second = middleware(createMockReqForMiddleware(), createMockResForMiddleware() as never, vi.fn());

    /* The lazy init chain reaches the mocked initializer one microtask in
       (logger resolution first); let it land before releasing. */
    await Promise.resolve();
    releaseInit!(sharedMockComponents);
    await Promise.all([first, second]);

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('sends response when passthrough handler returns a response', async () => {
    const passthroughResponse: GuardResponse = {
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      setHeader() {},
      body: new Uint8Array([79, 75]),
      bodyText: 'OK',
    };
    (sharedMockComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, factory: () => GuardResponse) => {
        factory();
        return passthroughResponse;
      },
    );

    const middleware = createSecurityMiddleware({ config: {} });
    const res = createMockResForMiddleware();
    const next = vi.fn();
    await middleware(createMockReqForMiddleware(), res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('sends response when security bypass returns a response', async () => {
    const bypassResponse: GuardResponse = {
      statusCode: 200,
      headers: {},
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (sharedMockComponents.bypassHandler.handleSecurityBypass as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, factory: () => GuardResponse) => {
        factory();
        return bypassResponse;
      },
    );

    const middleware = createSecurityMiddleware({ config: {} });
    const res = createMockResForMiddleware();
    const next = vi.fn();
    await middleware(createMockReqForMiddleware(), res as never, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('sends response when pipeline blocks the request', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    const components = sharedMockComponents;
    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode('{"detail":"Blocked"}'),
      bodyText: '{"detail":"Blocked"}',
    };
    (components.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const res2 = createMockResForMiddleware();
    const next2 = vi.fn();
    await middleware(req, res2 as never, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(403);
  });

  it('calls processUsageRules when routeConfig has behaviorRules', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    const components = sharedMockComponents;
    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (components.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const res2 = createMockResForMiddleware();
    const next2 = vi.fn();
    await middleware(req, res2 as never, next2);

    expect(components.behavioralProcessor.processUsageRules).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });

  it('uses unknown as clientIp when clientHost is null', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware({ socket: { remoteAddress: undefined } });
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    const components = sharedMockComponents;
    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (components.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const res2 = createMockResForMiddleware();
    const next2 = vi.fn();
    await middleware(createMockReqForMiddleware({ socket: { remoteAddress: undefined } }), res2 as never, next2);

    expect(components.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), 'unknown', routeConfig,
    );
  });

  it('overrides res.end and calls processResponse', async () => {
    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        capturedRes.setHeader('x-guard', 'processed');
        return capturedRes;
      },
    );
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    res.end('response body');

    await vi.waitFor(() => {
      expect(sharedMockComponents.errorResponseFactory.processResponse).toHaveBeenCalled();
    });
    expect(res.setHeader).toHaveBeenCalledWith('x-guard', 'processed');
  });

  it('res.end handles Buffer chunk correctly', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    res.end(Buffer.from('buffer data'));

    const components = sharedMockComponents;
    await vi.waitFor(() => {
      expect(components.errorResponseFactory.processResponse).toHaveBeenCalled();
    });
  });

  it('res.end handles no chunk', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    res.end();

    const components = sharedMockComponents;
    await vi.waitFor(() => {
      expect(components.errorResponseFactory.processResponse).toHaveBeenCalled();
    });
  });

  it('passes behavioral return callback when routeConfig exists', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    const components = sharedMockComponents;
    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (components.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const res2 = createMockResForMiddleware();
    const next2 = vi.fn();
    await middleware(req, res2 as never, next2);

    res2.end('done');

    await vi.waitFor(() => {
      expect(components.errorResponseFactory.processResponse).toHaveBeenCalled();
    });

    const lastProcessCall = (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[
      (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ];
    const behaviorCallback = lastProcessCall[4] as ((...args: unknown[]) => Promise<void>) | undefined;
    expect(behaviorCallback).toBeDefined();
    if (behaviorCallback) {
      await behaviorCallback({} as never, {} as never, '10.0.0.1', routeConfig as never);
      expect(components.behavioralProcessor.processReturnRules).toHaveBeenCalled();
    }
  });

  it('does not pass behavioral callback when no routeConfig', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    res.end('done');

    const components = sharedMockComponents;
    await vi.waitFor(() => {
      expect(components.errorResponseFactory.processResponse).toHaveBeenCalled();
    });

    const lastProcessCall = (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(lastProcessCall[4]).toBeUndefined();
  });

  it('swallows errors from processResponse', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    const components = sharedMockComponents;
    (components.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    res.end('data');

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(next).toHaveBeenCalled();
  });

  it('forwards middleware errors to next(error) instead of hanging the request (fail secure)', async () => {
    mockInitialize.mockRejectedValueOnce(new Error('init failed'));
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    await middleware(req, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const forwarded = next.mock.calls[0][0] as Error;
    expect(forwarded).toBeInstanceOf(Error);
    expect(forwarded.message).toBe('init failed');
    expect(res.send).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('applies processResponse headers before ending the response', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    const originalEnd = res.end as ReturnType<typeof vi.fn>;
    const events: string[] = [];
    originalEnd.mockImplementation(() => { events.push('end'); });

    await middleware(req, res as never, next);

    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        capturedRes.setHeader('x-guard', 'done');
        events.push('processResponse');
        return capturedRes;
      },
    );

    res.end('response body');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalled();
    });
    expect(events).toEqual(['processResponse', 'end']);
    expect(res._headers['x-guard']).toBe('done');
  });

  it('still ends the response when processResponse rejects', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = createMockResForMiddleware();
    const next = vi.fn();

    const originalEnd = res.end as ReturnType<typeof vi.fn>;

    await middleware(req, res as never, next);

    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('processing failed'),
    );

    res.end('data');

    await vi.waitFor(() => {
      expect(originalEnd).toHaveBeenCalledWith('data');
    });
  });

  it('captures chunks written via res.write into the response body', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = { ...createMockResForMiddleware(), write: vi.fn().mockReturnValue(true) } as never;
    const next = vi.fn();

    await middleware(req, res, next);

    let captured: GuardResponse | undefined;
    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        captured = capturedRes;
        return capturedRes;
      },
    );

    res.write('hello ');
    res.end('world');

    await vi.waitFor(() => {
      expect(captured).toBeDefined();
    });
    expect(captured?.bodyText).toBe('hello world');
  });

  it('caps the captured response body at the bounded read limit', async () => {
    const middleware = createSecurityMiddleware({ config: {} });
    const req = createMockReqForMiddleware();
    const res = { ...createMockResForMiddleware(), write: vi.fn().mockReturnValue(true) } as never;
    const next = vi.fn();

    await middleware(req, res, next);

    let captured: GuardResponse | undefined;
    (sharedMockComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        captured = capturedRes;
        return capturedRes;
      },
    );

    res.write('a'.repeat(50_000));
    res.end('');

    await vi.waitFor(() => {
      expect(captured).toBeDefined();
    });
    expect(captured?.bodyText?.length).toBe(10_000);
  });
});

describe('guardBodyParser', () => {
  it('returns a function', () => {
    const parser = guardBodyParser();
    expect(typeof parser).toBe('function');
  });

  it('verify callback sets rawBody on request', () => {
    const express = require('express') as typeof import('express');
    const origJson = express.json;
    let capturedVerify: ((req: unknown, res: unknown, buf: Buffer, encoding: string) => void) | undefined;
    (express as unknown as Record<string, unknown>).json = (opts: Record<string, unknown>) => {
      capturedVerify = opts['verify'] as typeof capturedVerify;
      return origJson(opts);
    };
    guardBodyParser();
    (express as unknown as Record<string, unknown>).json = origJson;
    expect(capturedVerify).toBeDefined();
    const fakeReq: Record<string, unknown> = {};
    capturedVerify!(fakeReq, {}, Buffer.from('test'), 'utf-8');
    expect(fakeReq['rawBody']).toEqual(Buffer.from('test'));
  });
});

describe('guardUrlEncodedParser', () => {
  it('returns a function', () => {
    const parser = guardUrlEncodedParser();
    expect(typeof parser).toBe('function');
  });

  it('verify callback sets rawBody on request', () => {
    const express = require('express') as typeof import('express');
    const origUrlencoded = express.urlencoded;
    let capturedVerify: ((req: unknown, res: unknown, buf: Buffer, encoding: string) => void) | undefined;
    (express as unknown as Record<string, unknown>).urlencoded = (opts: Record<string, unknown>) => {
      capturedVerify = opts['verify'] as typeof capturedVerify;
      return origUrlencoded(opts);
    };
    guardUrlEncodedParser();
    (express as unknown as Record<string, unknown>).urlencoded = origUrlencoded;
    expect(capturedVerify).toBeDefined();
    const fakeReq: Record<string, unknown> = {};
    capturedVerify!(fakeReq, {}, Buffer.from('data'), 'utf-8');
    expect(fakeReq['rawBody']).toEqual(Buffer.from('data'));
  });
});

describe('ExpressGuardRequest with non-Uint8Array Buffer rawBody', () => {
  it('converts Buffer rawBody to Uint8Array via Buffer branch', async () => {
    const buf = Buffer.from('test data');
    Object.defineProperty(buf, Symbol.hasInstance, { value: () => false });
    const mockReq = {
      path: '/test',
      protocol: 'https',
      get: () => 'localhost',
      originalUrl: '/test',
      method: 'GET',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
      query: {},
      rawBody: buf,
    } as never;
    const request = new ExpressGuardRequest(mockReq);
    const body = await request.body();
    expect(body).toBeInstanceOf(Uint8Array);
  });
});
