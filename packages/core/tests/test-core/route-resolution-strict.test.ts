import { describe, it, expect, vi } from 'vitest';
import { RouteConfigResolver } from '../../src/core/routing/resolver.js';
import { RouteConfigCheck, UNRESOLVED_ROUTE_REASON } from '../../src/core/checks/implementations/route-config.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { createMockMiddleware, createMockRequest } from '../helpers.js';

describe('RouteConfigResolver unresolved marking', () => {
  it('marks guard_route_unresolved when the decorator lacks getRouteConfig', () => {
    const resolver = new RouteConfigResolver(createMockMiddleware().config);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guardRouteId'] = 'route-1';
    (req.state as Record<string, unknown>)['guardDecorator'] = {};
    expect(resolver.getRouteConfig(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['guard_route_unresolved']).toBe(true);
  });

  it('marks guard_route_unresolved when the routeId is unknown to the decorator', () => {
    const resolver = new RouteConfigResolver(createMockMiddleware().config);
    const decorator = { getRouteConfig: () => undefined };
    resolver.setGuardDecorator(decorator);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guardRouteId'] = 'missing-route';
    expect(resolver.getRouteConfig(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['guard_route_unresolved']).toBe(true);
  });

  it('marks guard_route_unresolved when the lookup throws', () => {
    const resolver = new RouteConfigResolver(createMockMiddleware().config);
    const decorator = { getRouteConfig: () => { throw new Error('lookup boom'); } };
    resolver.setGuardDecorator(decorator);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guardRouteId'] = 'route-1';
    expect(resolver.getRouteConfig(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['guard_route_unresolved']).toBe(true);
  });

  it('does not mark unrouted requests (no routeId) or successful lookups', () => {
    const resolver = new RouteConfigResolver(createMockMiddleware().config);
    const decorator = { getRouteConfig: () => new RouteConfig() };
    resolver.setGuardDecorator(decorator);

    const unrouted = createMockRequest();
    expect(resolver.getRouteConfig(unrouted)).toBeNull();
    expect((unrouted.state as Record<string, unknown>)['guard_route_unresolved']).toBeUndefined();

    const routed = createMockRequest();
    (routed.state as Record<string, unknown>)['guardRouteId'] = 'route-1';
    expect(resolver.getRouteConfig(routed)).toBeInstanceOf(RouteConfig);
    expect((routed.state as Record<string, unknown>)['guard_route_unresolved']).toBeUndefined();
  });
});

describe('RouteConfigCheck route_resolution_strict', () => {
  function makeCheck(configOverrides: Record<string, unknown> = {}) {
    const middleware = createMockMiddleware(configOverrides);
    return { check: new RouteConfigCheck(middleware), middleware };
  }

  it('blocks with 500 Route resolution failed when strict and resolution failed', async () => {
    const { check } = makeCheck({ routeResolutionStrict: true });
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guard_route_unresolved'] = true;
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(500);
    expect(result!.bodyText).toBe('Route resolution failed');
  });

  it('returns null when strict but resolution succeeded', async () => {
    const { check } = makeCheck({ routeResolutionStrict: true });
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when strict and passive mode (logged only)', async () => {
    const { check } = makeCheck({ routeResolutionStrict: true, passiveMode: true });
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guard_route_unresolved'] = true;
    const result = await check.check(req);
    expect(result).toBeNull();
  });

  it('does not block when strict is off (default)', async () => {
    const { check } = makeCheck({});
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guard_route_unresolved'] = true;
    const result = await check.check(req);
    expect(result).toBeNull();
  });

  it('fires on_block with the unresolved reason and the route_unresolved event', async () => {
    const onBlock = vi.fn();
    const { check, middleware } = makeCheck({ routeResolutionStrict: true, onBlock });
    const sendEvent = vi.spyOn(check, 'sendEvent').mockResolvedValue(undefined);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guard_route_unresolved'] = true;
    await check.check(req);
    expect(sendEvent).toHaveBeenCalledWith(
      'route_unresolved', req, 'request_blocked', UNRESOLVED_ROUTE_REASON,
    );
    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(onBlock.mock.calls[0][1]).toMatchObject({
      check_name: 'route_config',
      reason: UNRESOLVED_ROUTE_REASON,
      status_code: 500,
    });
    void middleware;
  });
});
