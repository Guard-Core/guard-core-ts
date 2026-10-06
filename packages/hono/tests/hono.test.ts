import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GuardResponse, SecurityMiddlewareComponents } from '@guardcore/core';
import {
  HonoGuardRequest,
  HonoGuardResponse,
  HonoResponseFactory,
} from '../src/adapters.js';
import { configureCors } from '../src/cors.js';

function createMockHonoRequest(url = 'https://example.com/api/test?q=1', init: RequestInit = {}) {
  const raw = new Request(url, init);
  return {
    url,
    method: raw.method,
    raw,
    header: (name: string) => raw.headers.get(name),
    arrayBuffer: () => raw.arrayBuffer(),
  } as never;
}

describe('HonoGuardRequest', () => {
  let request: HonoGuardRequest;

  beforeEach(() => {
    request = new HonoGuardRequest(createMockHonoRequest(), '1.2.3.4');
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

  it('returns null clientHost when connectingIp is null', () => {
    const req = new HonoGuardRequest(createMockHonoRequest(), null);
    expect(req.clientHost).toBeNull();
  });

  it('returns correct headers', () => {
    const mockReq = createMockHonoRequest('https://example.com/api/test', {
      headers: { 'user-agent': 'Test/1.0' },
    });
    const req = new HonoGuardRequest(mockReq, '1.2.3.4');
    expect(req.headers['user-agent']).toBe('Test/1.0');
  });

  it('returns correct queryParams', () => {
    expect(request.queryParams).toEqual({ q: '1' });
  });

  it('returns empty queryParams when no query string', () => {
    const req = new HonoGuardRequest(createMockHonoRequest('https://example.com/api/test'), '1.2.3.4');
    expect(request.queryParams).toEqual({ q: '1' });
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

describe('HonoGuardRequest.body()', () => {
  it('returns Uint8Array from request body', async () => {
    const mockReq = createMockHonoRequest('https://example.com/api/test', {
      method: 'POST',
      body: 'hello',
    });
    const req = new HonoGuardRequest(mockReq, '1.2.3.4');
    const body = await req.body();
    expect(body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(body)).toBe('hello');
  });

  it('returns empty Uint8Array for GET request without body', async () => {
    const mockReq = createMockHonoRequest('https://example.com/api/test');
    const req = new HonoGuardRequest(mockReq, '1.2.3.4');
    const body = await req.body();
    expect(body).toBeInstanceOf(Uint8Array);
    expect(body.length).toBe(0);
  });
});

describe('HonoGuardResponse', () => {
  it('sets statusCode and encodes content', () => {
    const response = new HonoGuardResponse(200, '{"ok":true}');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Uint8Array);
    expect(response.bodyText).toBe('{"ok":true}');
  });

  it('sets content-type header to text/plain', () => {
    const response = new HonoGuardResponse(200, 'test');
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('setHeader adds headers', () => {
    const response = new HonoGuardResponse(200, 'test');
    response.setHeader('x-custom', 'value');
    expect(response.headers['x-custom']).toBe('value');
  });

  it('returns null bodyText when body is empty string', () => {
    const response = new HonoGuardResponse(200, '');
    expect(response.bodyText).toBe('');
  });
});

describe('HonoResponseFactory', () => {
  let factory: HonoResponseFactory;

  beforeEach(() => {
    factory = new HonoResponseFactory();
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

describe('HonoGuardResponse bodyText null branch', () => {
  it('returns null bodyText when body is null', () => {
    const response = new HonoGuardResponse(200, 'content');
    (response as unknown as Record<string, unknown>)['_body'] = null;
    expect(response.bodyText).toBeNull();
  });
});

const { hoistedComponents, hoistedInit } = vi.hoisted(() => ({
  hoistedComponents: {
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
  hoistedInit: vi.fn(),
}));

vi.mock('@guardcore/core', async () => {
  const actual = await vi.importActual('@guardcore/core');
  return {
    ...(actual as Record<string, unknown>),
    initializeSecurityMiddleware: hoistedInit,
  };
});

hoistedInit.mockResolvedValue(hoistedComponents);

describe('createGuardMiddleware', () => {
  function createMockContext(overrides: Record<string, unknown> = {}) {
    const responseHeaders = new Headers();
    return {
      req: {
        url: 'https://example.com/api/test?q=1',
        method: 'GET',
        raw: new Request('https://example.com/api/test?q=1'),
        header: (_name: string) => null as string | null,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      },
      env: {},
      header: vi.fn((_name: string, value: string) => { responseHeaders.set(_name, value); }),
      redirect: vi.fn(() => new Response(null, { status: 302 })),
      json: vi.fn((data: unknown, status: unknown) => new Response(JSON.stringify(data), { status: status as number })),
      body: vi.fn((data: string | null, status: number) => new Response(data ?? '', { status })),
      res: {
        status: 200,
        headers: responseHeaders,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    hoistedInit.mockResolvedValue(hoistedComponents);
    (hoistedComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (hoistedComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (hoistedComponents.bypassHandler.handleSecurityBypass as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementation((_: unknown, r: unknown) => Promise.resolve(r));
  });

  async function invokeMiddleware(ctxOverrides: Record<string, unknown> = {}) {
    const { createGuardMiddleware } = await import('../src/middleware.js');
    const middleware = createGuardMiddleware({ config: {} });
    const ctx = createMockContext(ctxOverrides);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as never, next);

    return { ctx, next, middleware };
  }

  it('calls next when pipeline allows', async () => {
    const { next } = await invokeMiddleware();
    expect(next).toHaveBeenCalled();
  });

  it('does not re-initialize on second call', async () => {
    const { middleware } = await invokeMiddleware();
    const ctx2 = createMockContext();
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    expect(hoistedInit).toHaveBeenCalledTimes(1);
  });

  it('returns response when passthrough handler returns', async () => {
    const passthroughResponse: GuardResponse = {
      statusCode: 200,
      headers: { 'x-pass': 'yes' },
      setHeader() {},
      body: null,
      bodyText: 'pass',
    };
    (hoistedComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, factory: () => GuardResponse) => {
        factory();
        return passthroughResponse;
      },
    );

    const { ctx, next } = await invokeMiddleware();

    expect(next).not.toHaveBeenCalled();
    expect(ctx.body).toHaveBeenCalled();
  });

  it('returns response when security bypass returns', async () => {
    const bypassResponse: GuardResponse = {
      statusCode: 200,
      headers: {},
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (hoistedComponents.bypassHandler.handleSecurityBypass as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, factory: () => GuardResponse) => {
        factory();
        return bypassResponse;
      },
    );

    const { next } = await invokeMiddleware();

    expect(next).not.toHaveBeenCalled();
  });

  it('returns response when pipeline blocks', async () => {
    const { middleware } = await invokeMiddleware();

    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode('blocked'),
      bodyText: 'blocked',
    };
    (hoistedComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const ctx2 = createMockContext();
    const next2 = vi.fn();
    await middleware(ctx2 as never, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(ctx2.body).toHaveBeenCalled();
  });

  it('sends the engine body without re-wrapping it in a detail envelope', async () => {
    const { middleware } = await invokeMiddleware();

    const blockResponse: GuardResponse = {
      statusCode: 403,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode(JSON.stringify({ detail: 'Blocked' })),
      bodyText: JSON.stringify({ detail: 'Blocked' }),
    };
    (hoistedComponents.pipeline.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(blockResponse);

    const ctx2 = createMockContext();
    const next2 = vi.fn();
    await middleware(ctx2 as never, next2);

    expect(ctx2.json).not.toHaveBeenCalled();
    expect((ctx2.body as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(JSON.stringify({ detail: 'Blocked' }));
    expect((ctx2.body as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(403);
  });

  it('redirects when location header present', async () => {
    const { middleware } = await invokeMiddleware();

    const redirectResponse: GuardResponse = {
      statusCode: 302,
      headers: { location: 'https://example.com' },
      setHeader() {},
      body: null,
      bodyText: null,
    };
    (hoistedComponents.bypassHandler.handlePassthrough as ReturnType<typeof vi.fn>).mockResolvedValueOnce(redirectResponse);

    const ctx2 = createMockContext();
    const next2 = vi.fn();
    await middleware(ctx2 as never, next2);

    expect(ctx2.redirect).toHaveBeenCalledWith('https://example.com', 302);
  });

  it('processes usage rules when routeConfig has behaviorRules', async () => {
    const { middleware } = await invokeMiddleware();

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const ctx2 = createMockContext();
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    expect(hoistedComponents.behavioralProcessor.processUsageRules).toHaveBeenCalled();
  });

  it('uses unknown when connecting ip is null', async () => {
    const { middleware } = await invokeMiddleware();

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const ctx2 = createMockContext({ env: undefined });
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    expect(hoistedComponents.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), 'unknown', routeConfig,
    );
  });

  it('reads remoteAddr from env when available', async () => {
    const { middleware } = await invokeMiddleware();

    const ctx2 = createMockContext({ env: { remoteAddr: '192.168.1.1' } });
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    expect(next2).toHaveBeenCalled();
  });

  it('calls processResponse after next with routeConfig behavioral callback', async () => {
    (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, capturedRes: GuardResponse) => {
        capturedRes.setHeader('x-guard', 'done');
        return capturedRes;
      },
    );
    const { middleware } = await invokeMiddleware();

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const ctx2 = createMockContext();
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    const lastCall = (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[
      (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ];
    const callback = lastCall[4] as ((...args: unknown[]) => Promise<void>) | undefined;
    expect(callback).toBeDefined();
    if (callback) {
      await callback({} as never, {} as never, '10.0.0.1', routeConfig as never);
      expect(hoistedComponents.behavioralProcessor.processReturnRules).toHaveBeenCalled();
    }
  });

  it('does not pass behavioral callback when no routeConfig', async () => {
    const { middleware } = await invokeMiddleware();

    const ctx2 = createMockContext();
    const next2 = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx2 as never, next2);

    const lastCall = (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls[
      (hoistedComponents.errorResponseFactory.processResponse as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ];
    expect(lastCall[4]).toBeUndefined();
  });

  it('uses the connectingIpResolver option when provided', async () => {
    const { createGuardMiddleware } = await import('../src/middleware.js');
    const middleware = createGuardMiddleware({
      config: {},
      connectingIpResolver: () => '9.9.9.9',
    });

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const ctx = createMockContext();
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as never, next);

    expect(hoistedComponents.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), '9.9.9.9', routeConfig,
    );
  });

  it('treats a null resolver result as unknown client ip', async () => {
    const { createGuardMiddleware } = await import('../src/middleware.js');
    const middleware = createGuardMiddleware({
      config: {},
      connectingIpResolver: () => null,
    });

    const routeConfig = { behaviorRules: [{ type: 'usage' }] };
    (hoistedComponents.routeResolver.getRouteConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(routeConfig);

    const ctx = createMockContext();
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as never, next);

    expect(hoistedComponents.behavioralProcessor.processUsageRules).toHaveBeenCalledWith(
      expect.anything(), 'unknown', routeConfig,
    );
  });

  it('initializes once under concurrent first requests', async () => {
    const { createGuardMiddleware } = await import('../src/middleware.js');
    let releaseInit: ((value: unknown) => void) | undefined;
    /* The gate resolves later; releaseInit is assigned synchronously. */
    const gate = new Promise((resolve) => { releaseInit = resolve; });
    hoistedInit.mockImplementationOnce(() => gate);

    const middleware = createGuardMiddleware({ config: {} });
    const first = middleware(createMockContext() as never, vi.fn().mockResolvedValue(undefined));
    const second = middleware(createMockContext() as never, vi.fn().mockResolvedValue(undefined));

    /* The lazy init chain reaches the mocked initializer one microtask in
       (logger resolution first); let it land before releasing. */
    await Promise.resolve();
    releaseInit!(hoistedComponents);
    await Promise.all([first, second]);

    expect(hoistedInit).toHaveBeenCalledTimes(1);
  });
});

describe('configureCors for Hono', () => {
  it('does nothing when enableCors is false', () => {
    const mockApp = { use: vi.fn() } as never;
    configureCors(mockApp, { enableCors: false } as never);
    const typed = mockApp as unknown as { use: ReturnType<typeof vi.fn> };
    expect(typed.use).not.toHaveBeenCalled();
  });

  it('applies cors middleware when enableCors is true', () => {
    const mockApp = { use: vi.fn() } as never;
    configureCors(mockApp, {
      enableCors: true,
      corsAllowOrigins: ['*'],
      corsAllowMethods: ['GET'],
      corsAllowHeaders: ['*'],
      corsAllowCredentials: false,
      corsExposeHeaders: [],
      corsMaxAge: 600,
    } as never);
    const typed = mockApp as unknown as { use: ReturnType<typeof vi.fn> };
    expect(typed.use).toHaveBeenCalledWith('*', expect.anything());
  });
});
