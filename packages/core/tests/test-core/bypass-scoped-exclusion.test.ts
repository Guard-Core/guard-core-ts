import { describe, it, expect } from 'vitest';
import { IpSecurityCheck } from '../../src/core/checks/implementations/ip-security.js';
import { RateLimitCheck } from '../../src/core/checks/implementations/rate-limit.js';
import { RouteConfigCheck } from '../../src/core/checks/implementations/route-config.js';
import { SuspiciousActivityCheck } from '../../src/core/checks/implementations/suspicious-activity.js';
import { BehavioralProcessor } from '../../src/core/behavioral/processor.js';
import { SecurityEventBus } from '../../src/core/events/event-bus.js';
import { BehaviorTracker } from '../../src/handlers/behavior.js';
import { BehaviorRule } from '../../src/models/behavior-rule.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockMiddleware, createMockRequest, createTestConfig } from '../helpers.js';

function scoped(overrides: Parameters<typeof createMockRequest>[0] = {}) {
  const req = createMockRequest(overrides);
  req.state.guardExclusionScoped = true;
  return req;
}

describe('which checks are enforced on excluded paths (reference enforced_on_excluded_paths)', () => {
  it('route_config, ip_security and rate_limit are enforced; the rest are not', () => {
    const mw = createMockMiddleware();
    expect(new RouteConfigCheck(mw).enforcedOnExcludedPaths).toBe(true);
    expect(new IpSecurityCheck(mw).enforcedOnExcludedPaths).toBe(true);
    expect(new RateLimitCheck(mw).enforcedOnExcludedPaths).toBe(true);
    expect(new SuspiciousActivityCheck(mw, null, null).enforcedOnExcludedPaths).toBe(false);
  });
});

describe('IpSecurityCheck on an exclusion-scoped request', () => {
  it('still blocks the global blacklist', async () => {
    const check = new IpSecurityCheck(createMockMiddleware({ blacklist: ['10.0.0.1'] }));
    const result = await check.check(scoped({ clientHost: '10.0.0.1' }));
    expect(result!.statusCode).toBe(403);
  });

  it('ignores the route config ip rules', async () => {
    const rc = new RouteConfig();
    rc.ipBlacklist = ['10.0.0.5'];
    const mw = createMockMiddleware();
    const unscopedReq = createMockRequest({ clientHost: '10.0.0.5' });
    (unscopedReq.state as Record<string, unknown>)['_routeConfig'] = rc;
    expect((await new IpSecurityCheck(mw).check(unscopedReq))!.statusCode).toBe(403);

    const scopedReq = scoped({ clientHost: '10.0.0.5' });
    (scopedReq.state as Record<string, unknown>)['_routeConfig'] = rc;
    expect(await new IpSecurityCheck(mw).check(scopedReq)).toBeNull();
  });

  it('keeps the ip ban check', async () => {
    const mw = createMockMiddleware();
    const banManager = { isIpBanned: async () => true } as never;
    const result = await new IpSecurityCheck(mw, banManager).check(scoped({ clientHost: '10.0.0.9' }));
    expect(result!.statusCode).toBe(403);
  });
});

describe('BehavioralProcessor on an exclusion-scoped request', () => {
  it('never reaches the tracker', async () => {
    const config = createTestConfig();
    const processor = new BehavioralProcessor(defaultLogger, new SecurityEventBus(null, config, defaultLogger));
    const tracker = new BehaviorTracker(config, defaultLogger);
    processor.setGuardDecorator({ behaviorTracker: tracker });
    const rc = new RouteConfig();
    rc.behaviorRules = [new BehaviorRule('usage', 0, 60, null, 'log')];

    let tracked = 0;
    tracker.trackEndpointUsage = async () => { tracked += 1; return false; };
    await processor.processUsageRules(createMockRequest(), '1.2.3.4', rc);
    expect(tracked).toBe(1);
    await processor.processUsageRules(scoped(), '1.2.3.4', rc);
    expect(tracked).toBe(1);
  });
});
