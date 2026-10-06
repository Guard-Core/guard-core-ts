import { describe, it, expect, vi } from 'vitest';
import { RateLimitCheck } from '../../../src/core/checks/implementations/rate-limit.js';
import { RateLimitManager } from '../../../src/handlers/rate-limit.js';
import { createMockMiddleware, createMockRequest, createMockResponse } from '../../helpers.js';
import { createTestConfig } from '../../helpers.js';
import type { GuardRequest, GuardMiddlewareProtocol } from '../../../src/index.js';
import type { RouteConfig } from '../../../src/models/route-config.js';

function middlewareWithHandler(mw: GuardMiddlewareProtocol, handler: unknown): void {
  (mw as Record<string, unknown>)['rateLimitHandler'] = handler;
}

function requestWithSession(sessionValue: string | null): GuardRequest {
  const headers: Record<string, string> = { 'user-agent': 'TestAgent/1.0' };
  if (sessionValue !== null) headers['x-session-id'] = sessionValue;
  return createMockRequest({ headers });
}

function routeConfigWith(sessionLimits: Record<string, number> | null): Record<string, unknown> {
  return { rateLimit: null, rateLimitWindow: null, sessionLimits, bypassedChecks: new Set() };
}

describe('RateLimitCheck session limits (D5 consumer)', () => {
  it('applies the session tier with the header value as the counter key', async () => {
    const mw = createMockMiddleware({ enableRateLimiting: true });
    const blocked = createMockResponse(429, 'Too many requests');
    const mockHandler = { checkRateLimit: vi.fn().mockResolvedValue(blocked) };
    middlewareWithHandler(mw, mockHandler);

    const check = new RateLimitCheck(mw);
    const request = requestWithSession('abc123');
    (request.state as Record<string, unknown>)['_routeConfig'] = routeConfigWith({ 'x-session-id': 5 });

    const result = await check.check(request);
    expect(result!.statusCode).toBe(429);
    /* The route tier is unset (rateLimit null), so the FIRST call is the
       session tier; it blocks before the global tier is reached. */
    expect(mockHandler.checkRateLimit).toHaveBeenCalledTimes(1);
    const [, clientIp, , endpointPath, limit, window] = mockHandler.checkRateLimit.mock.calls[0];
    expect(endpointPath).toBe('session:x-session-id:abc123');
    expect(limit).toBe(5);
    expect(window).toBe(60); // config default window
    expect(clientIp).toBe('1.2.3.4');
  });

  it('uses the route window for the session tier when configured', async () => {
    const mw = createMockMiddleware({ enableRateLimiting: true });
    const mockHandler = { checkRateLimit: vi.fn().mockResolvedValue(null) };
    middlewareWithHandler(mw, mockHandler);

    const check = new RateLimitCheck(mw);
    const request = requestWithSession('abc123');
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      rateLimit: null,
      rateLimitWindow: 45,
      sessionLimits: { 'x-session-id': 3 },
      bypassedChecks: new Set(),
    };

    await check.check(request);
    /* calls[0] is the session tier (the route rateLimit tier is unset); the
       last call is the global tier with the config window. */
    const [, , , , , window] = mockHandler.checkRateLimit.mock.calls[0];
    expect(window).toBe(45);
  });

  it('skips the session tier when none of the configured headers are present', async () => {
    const mw = createMockMiddleware({ enableRateLimiting: true });
    const mockHandler = { checkRateLimit: vi.fn().mockResolvedValue(null) };
    middlewareWithHandler(mw, mockHandler);

    const check = new RateLimitCheck(mw);
    const request = requestWithSession(null);
    (request.state as Record<string, unknown>)['_routeConfig'] = routeConfigWith({ 'x-session-id': 5 });

    await check.check(request);
    expect(mockHandler.checkRateLimit).toHaveBeenCalledTimes(1); // global tier only
  });

  it('skips invalid (non-positive) session limits with a warning', async () => {
    const warns: string[] = [];
    const mw = createMockMiddleware({ enableRateLimiting: true });
    (mw as Record<string, unknown>)['logger'] = {
      info() {}, warn: (m: string) => warns.push(m), error() {}, debug() {},
    };
    const mockHandler = { checkRateLimit: vi.fn().mockResolvedValue(null) };
    middlewareWithHandler(mw, mockHandler);

    const check = new RateLimitCheck(mw);
    const request = requestWithSession('abc123');
    (request.state as Record<string, unknown>)['_routeConfig'] = routeConfigWith({
      'x-session-id': 0,
      'x-other': -2,
    });

    await check.check(request);
    expect(mockHandler.checkRateLimit).toHaveBeenCalledTimes(1); // global tier only
    expect(warns.some((w) => w.includes("Ignoring invalid sessionLimits entry 'x-session-id'"))).toBe(true);
  });

  it('skips the tier when the route has no sessionLimits', async () => {
    const mw = createMockMiddleware({ enableRateLimiting: true });
    const mockHandler = { checkRateLimit: vi.fn().mockResolvedValue(null) };
    middlewareWithHandler(mw, mockHandler);

    const check = new RateLimitCheck(mw);
    const request = requestWithSession('abc123');
    (request.state as Record<string, unknown>)['_routeConfig'] = routeConfigWith(null);

    await check.check(request);
    expect(mockHandler.checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('counts distinct session values independently (real manager)', async () => {
    const config = createTestConfig({ enableRateLimiting: true, rateLimit: 1000, rateLimitWindow: 60 });
    const mw = createMockMiddleware({ enableRateLimiting: true, rateLimit: 1000, rateLimitWindow: 60 });
    const manager = new RateLimitManager(mw.logger, config);
    middlewareWithHandler(mw, manager);

    const check = new RateLimitCheck(mw);
    const routeConfig = routeConfigWith({ 'x-session-id': 2 }) as unknown as RouteConfig;

    const first = await check.check(withRoute(requestWithSession('alice'), routeConfig));
    expect(first).toBeNull();
    const second = await check.check(withRoute(requestWithSession('alice'), routeConfig));
    /* Third request on the same session would be the limit-breaking one:
       after two calls the in-memory count for alice is 2; the third trips. */
    const third = await check.check(withRoute(requestWithSession('alice'), routeConfig));
    expect(third).not.toBeNull();
    expect(third!.statusCode).toBe(429);

    /* Bob's session counter is independent: still under the limit. */
    const bob = await check.check(withRoute(requestWithSession('bob'), routeConfig));
    expect(bob).toBeNull();

    void first; void second;
  });
});

function withRoute(request: GuardRequest, routeConfig: RouteConfig): GuardRequest {
  (request.state as Record<string, unknown>)['_routeConfig'] = routeConfig;
  return request;
}
