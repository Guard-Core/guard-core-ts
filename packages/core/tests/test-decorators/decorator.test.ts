import { describe, it, expect, vi } from 'vitest';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { BaseSecurityDecorator, getRouteDecoratorConfig } from '../../src/decorators/base.js';
import { SecurityDecorator } from '../../src/decorators/index.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { BehaviorRule } from '../../src/models/behavior-rule.js';
import { createMockRequest } from '../helpers.js';
import type { GuardRequest, GuardRequestState } from '../../src/protocols/request.js';

describe('BaseSecurityDecorator', () => {
  it('creates with config', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    expect(decorator.config).toBe(config);
    expect(decorator.behaviorTracker).toBeDefined();
  });

  it('generates unique route IDs per function', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);

    function handlerA() {}
    function handlerB() {}

    decorator.ensureRouteConfig(handlerA);
    decorator.ensureRouteConfig(handlerB);

    const idA = decorator.getRouteId(handlerA);
    const idB = decorator.getRouteId(handlerB);
    expect(idA).not.toBe(idB);
    expect(idA).toMatch(/^guard_route_\d+$/);
  });

  it('returns same route ID for same function', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);

    function handler() {}
    const id1 = decorator.getRouteId(handler);
    const id2 = decorator.getRouteId(handler);
    expect(id1).toBe(id2);
  });

  it('stamps _guardRouteId on function', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);

    function handler() {}
    decorator.applyRouteConfig(handler);
    expect((handler as Record<string, unknown>)['_guardRouteId']).toBeDefined();
  });

  it('creates RouteConfig with default suspicious detection', () => {
    const config = SecurityConfigSchema.parse({ enablePenetrationDetection: false });
    const decorator = new BaseSecurityDecorator(config);

    function handler() {}
    const rc = decorator.ensureRouteConfig(handler);
    expect(rc.enableSuspiciousDetection).toBe(false);
  });

  it('retrieves route config by ID', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);

    function handler() {}
    const rc = decorator.ensureRouteConfig(handler);
    rc.rateLimit = 100;
    decorator.applyRouteConfig(handler);

    const routeId = decorator.getRouteId(handler);
    const retrieved = decorator.getRouteConfig(routeId);
    expect(retrieved?.rateLimit).toBe(100);
  });
});

describe('SecurityDecorator', () => {
  it('has all mixin methods', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    expect(typeof guard.requireIp).toBe('function');
    expect(typeof guard.blockCountries).toBe('function');
    expect(typeof guard.allowCountries).toBe('function');
    expect(typeof guard.blockClouds).toBe('function');
    expect(typeof guard.bypass).toBe('function');
    expect(typeof guard.rateLimit).toBe('function');
    expect(typeof guard.geoRateLimit).toBe('function');
    expect(typeof guard.requireHttps).toBe('function');
    expect(typeof guard.requireAuth).toBe('function');
    expect(typeof guard.apiKeyAuth).toBe('function');
    expect(typeof guard.requireHeaders).toBe('function');
    expect(typeof guard.blockUserAgents).toBe('function');
    expect(typeof guard.contentTypeFilter).toBe('function');
    expect(typeof guard.maxRequestSize).toBe('function');
    expect(typeof guard.requireReferrer).toBe('function');
    expect(typeof guard.customValidation).toBe('function');
    expect(typeof guard.usageMonitor).toBe('function');
    expect(typeof guard.returnMonitor).toBe('function');
    expect(typeof guard.behaviorAnalysis).toBe('function');
    expect(typeof guard.suspiciousFrequency).toBe('function');
    expect(typeof guard.timeWindow).toBe('function');
    expect(typeof guard.suspiciousDetection).toBe('function');
    expect(typeof guard.honeypotDetection).toBe('function');
  });

  it('decorators stamp route config', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    function handler() {}

    guard.requireIp(['10.0.0.1'], ['192.168.1.1'])(handler);
    guard.rateLimit(100, 60)(handler);
    guard.requireAuth('bearer')(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId);

    expect(rc?.ipWhitelist).toEqual(['10.0.0.1']);
    expect(rc?.ipBlacklist).toEqual(['192.168.1.1']);
    expect(rc?.rateLimit).toBe(100);
    expect(rc?.rateLimitWindow).toBe(60);
    expect(rc?.authRequired).toBe('bearer');
  });

  it('bypass decorator adds check names', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    function handler() {}
    guard.bypass(['rate_limit', 'ip_security'])(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId);

    expect(rc?.bypassedChecks.has('rate_limit')).toBe(true);
    expect(rc?.bypassedChecks.has('ip_security')).toBe(true);
  });

  it('blockClouds defaults to all providers', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    function handler() {}
    guard.blockClouds()(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId);

    expect(rc?.blockCloudProviders.has('AWS')).toBe(true);
    expect(rc?.blockCloudProviders.has('GCP')).toBe(true);
    expect(rc?.blockCloudProviders.has('Azure')).toBe(true);
  });

  it('behavioral decorators add rules', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    function handler() {}
    guard.usageMonitor(5, 3600, 'ban')(handler);
    guard.returnMonitor('status:200', 10, 86400, 'log')(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId);

    expect(rc?.behaviorRules).toHaveLength(2);
    expect(rc?.behaviorRules[0].ruleType).toBe('usage');
    expect(rc?.behaviorRules[0].threshold).toBe(5);
    expect(rc?.behaviorRules[0].action).toBe('ban');
    expect(rc?.behaviorRules[1].ruleType).toBe('return_pattern');
    expect(rc?.behaviorRules[1].pattern).toBe('status:200');
  });

  it('timeWindow decorator sets restrictions', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);

    function handler() {}
    guard.timeWindow('09:00', '17:00')(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId);

    expect(rc?.timeRestrictions).toEqual({ start: '09:00', end: '17:00' });
  });

  it('allowCountries sets whitelistCountries', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.allowCountries(['US', 'GB'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.whitelistCountries).toEqual(['US', 'GB']);
  });

  it('blockCountries sets blockedCountries', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.blockCountries(['CN', 'RU'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.blockedCountries).toEqual(['CN', 'RU']);
  });

  it('blockClouds with specific providers', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.blockClouds(['AWS'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.blockCloudProviders.has('AWS')).toBe(true);
    expect(rc?.blockCloudProviders.has('GCP')).toBe(false);
  });

  it('geoRateLimit sets geo rate limits', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.geoRateLimit({ US: [100, 60], CN: [10, 60] })(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.geoRateLimits).toEqual({ US: [100, 60], CN: [10, 60] });
  });

  it('requireHttps sets requireHttps flag', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireHttps()(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.requireHttps).toBe(true);
  });

  it('apiKeyAuth sets apiKeyRequired and header', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.apiKeyAuth('X-Custom-Key')(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.apiKeyRequired).toBe(true);
    expect(rc?.apiKeyHeader).toBe('X-Custom-Key');
    expect(rc?.requiredHeaders['X-Custom-Key']).toBe('required');
  });

  it('requireAuth stores the scheme and route verifier', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    const verifier = () => 'principal';
    guard.requireAuth('basic', verifier)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.authRequired).toBe('basic');
    expect(rc?.authVerifier).toBe(verifier);
  });

  it('apiKeyAuth stores the route verifier', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    const verifier = () => 'principal';
    guard.apiKeyAuth('X-Custom-Key', verifier)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.apiKeyVerifier).toBe(verifier);
  });

  it('requireAuthorizationHeader sets the presence-only scheme and is mutually exclusive', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireAuthorizationHeader('basic')(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.authorizationHeaderRequired).toBe('basic');
  });

  it('requireAuthorizationHeader rejects combination with requireAuth', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireAuth('bearer')(handler);
    expect(() => guard.requireAuthorizationHeader()(handler)).toThrow();
  });

  it('requireAuth rejects combination with requireAuthorizationHeader', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireAuthorizationHeader()(handler);
    expect(() => guard.requireAuth('bearer')(handler)).toThrow();
  });

  it('apiKeyAuth rejects combination with requireAuthorizationHeader', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireAuthorizationHeader()(handler);
    expect(() => guard.apiKeyAuth()(handler)).toThrow();
  });

  it('requireHeaders sets required headers', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireHeaders({ 'X-Request-ID': '', 'X-Trace': 'required' })(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.requiredHeaders['X-Request-ID']).toBe('');
    expect(rc?.requiredHeaders['X-Trace']).toBe('required');
  });

  it('blockUserAgents adds patterns', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.blockUserAgents(['scrapy', 'wget'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.blockedUserAgents).toContain('scrapy');
    expect(rc?.blockedUserAgents).toContain('wget');
  });

  it('contentTypeFilter sets allowedContentTypes', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.contentTypeFilter(['application/json', 'text/plain'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.allowedContentTypes).toEqual(['application/json', 'text/plain']);
  });

  it('maxRequestSize sets size limit', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.maxRequestSize(1024 * 1024)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.maxRequestSize).toBe(1048576);
  });

  it('requireReferrer sets allowed domains', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.requireReferrer(['example.com', 'app.example.com'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.requireReferrer).toEqual(['example.com', 'app.example.com']);
  });

  it('customValidation adds validator function', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    const validator = async () => null;
    guard.customValidation(validator)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.customValidators).toHaveLength(1);
  });

  it('behaviorAnalysis adds multiple rules', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    const rules = [
      new BehaviorRule('usage', 10, 3600),
      new BehaviorRule('return_pattern', 5, 86400, 'status:200'),
    ];
    guard.behaviorAnalysis(rules)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.behaviorRules).toHaveLength(2);
  });

  it('suspiciousFrequency adds frequency rule', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.suspiciousFrequency(50, 300, 'throttle')(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.behaviorRules).toHaveLength(1);
    expect(rc?.behaviorRules[0].ruleType).toBe('frequency');
    expect(rc?.behaviorRules[0].action).toBe('throttle');
  });

  it('suspiciousDetection disables detection', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.suspiciousDetection(false)(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.enableSuspiciousDetection).toBe(false);
  });

  it('honeypotDetection adds custom validator', () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap_field', 'hidden_input'])(handler);
    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string);
    expect(rc?.customValidators).toHaveLength(1);
  });
});

describe('BaseSecurityDecorator event methods', () => {
  it('sendDecoratorEvent no-ops without agent', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    await decorator.sendDecoratorEvent('test', createMockRequest(), 'action', 'reason', 'type');
  });

  it('sendDecoratorEvent sends to agent', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    await decorator.sendDecoratorEvent('test', createMockRequest(), 'action', 'reason', 'type');
    expect(agent.sendEvent).toHaveBeenCalledTimes(1);
  });

  it('sendDecoratorEvent catches agent errors', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn().mockRejectedValue(new Error('fail')) };
    await decorator.initializeAgent(agent as never);
    await decorator.sendDecoratorEvent('test', createMockRequest(), 'action', 'reason', 'type');
  });

  it('sendAccessDeniedEvent delegates', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    await decorator.sendAccessDeniedEvent(createMockRequest(), 'blocked', 'access_control');
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('access_denied');
  });

  it('sendAuthenticationFailedEvent delegates', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    await decorator.sendAuthenticationFailedEvent(createMockRequest(), 'bad token', 'bearer');
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('authentication_failed');
  });

  it('sendRateLimitEvent delegates', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    await decorator.sendRateLimitEvent(createMockRequest(), 10, 60);
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('rate_limited');
  });

  it('sendDecoratorViolationEvent delegates', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    await decorator.sendDecoratorViolationEvent(createMockRequest(), 'cloud_provider', 'Cloud IP');
    expect(agent.sendEvent.mock.calls[0][0].eventType).toBe('decorator_violation');
  });

  it('initializeAgent sets agent and initializes tracker', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const agent = { sendEvent: vi.fn() };
    await decorator.initializeAgent(agent as never);
    expect(decorator.agentHandler).toBe(agent);
  });

  it('initializeBehaviorTracking without Redis', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    await decorator.initializeBehaviorTracking();
  });
});

function createMockRequestWithBody(
  body: string,
  contentType: string,
): GuardRequest {
  const encoded = new TextEncoder().encode(body);
  return {
    urlPath: '/api/test',
    urlScheme: 'https',
    urlFull: 'https://example.com/api/test',
    urlReplaceScheme: (s: string) => `${s}://example.com/api/test`,
    method: 'POST',
    clientHost: '1.2.3.4',
    headers: { 'content-type': contentType, 'user-agent': 'Test' },
    queryParams: {},
    body: async () => encoded,
    state: {} as GuardRequestState,
    scope: {},
  };
}

describe('honeypotDetection validator execution', () => {
  it('blocks when trap field filled in JSON body', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap_field'])(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = guard.getRouteConfig(routeId)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody(
      JSON.stringify({ trap_field: 'bot filled this', name: 'real user' }),
      'application/json',
    );
    const result = await validator(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('allows when trap field is empty in JSON body', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap_field'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody(
      JSON.stringify({ trap_field: '', name: 'real user' }),
      'application/json',
    );
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('allows when trap field absent in JSON body', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap_field'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody(
      JSON.stringify({ name: 'real user' }),
      'application/json',
    );
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('blocks when trap field filled in form body', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['hidden_input'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody(
      'name=user&hidden_input=bot_filled',
      'application/x-www-form-urlencoded',
    );
    const result = await validator(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('allows form body without trap field', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['hidden_input'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody(
      'name=user&email=user@test.com',
      'application/x-www-form-urlencoded',
    );
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('allows empty body', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req: GuardRequest = {
      urlPath: '/api', urlScheme: 'https', urlFull: 'https://x/api',
      urlReplaceScheme: () => '', method: 'POST', clientHost: '1.2.3.4',
      headers: { 'content-type': 'application/json', 'user-agent': 'T' },
      queryParams: {}, body: async () => new Uint8Array(0),
      state: {} as GuardRequestState, scope: {},
    };
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('handles unparseable body gracefully', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req = createMockRequestWithBody('not json or form', 'text/plain');
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('catches body read error gracefully', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap'])(handler);

    const rc = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = rc.customValidators[0];

    const req: GuardRequest = {
      urlPath: '/', urlScheme: 'https', urlFull: 'https://x/',
      urlReplaceScheme: () => '', method: 'POST', clientHost: '1.1.1.1',
      headers: { 'content-type': 'application/json', 'user-agent': 'T' },
      queryParams: {},
      body: async () => { throw new Error('body read failed'); },
      state: {} as GuardRequestState, scope: {},
    };
    const result = await validator(req);
    expect(result).toBeNull();
  });

  it('handles missing content-type in honeypot', async () => {
    const config = SecurityConfigSchema.parse({});
    const guard = new SecurityDecorator(config);
    function handler() {}
    guard.honeypotDetection(['trap'])(handler);
    const routeConfig = guard.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    const validator = routeConfig.customValidators[0];

    const req: GuardRequest = {
      urlPath: '/', urlScheme: 'https', urlFull: 'https://x/',
      urlReplaceScheme: () => '', method: 'POST', clientHost: '1.1.1.1',
      headers: {}, queryParams: {},
      body: async () => new TextEncoder().encode('trap=filled'),
      state: {} as GuardRequestState, scope: {},
    };
    const result = await validator(req);
    expect(result).toBeNull();
  });
});

describe('getRouteDecoratorConfig', () => {
  it('returns undefined when no routeId', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const req = createMockRequest();
    expect(getRouteDecoratorConfig(req, decorator)).toBeUndefined();
  });

  it('returns undefined when routeId is not string', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guardRouteId'] = 42;
    expect(getRouteDecoratorConfig(req, decorator)).toBeUndefined();
  });

  it('returns route config when ID matches', () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    function handler() {}
    const routeConfig = decorator.ensureRouteConfig(handler);
    routeConfig.rateLimit = 99;
    decorator.applyRouteConfig(handler);
    const routeId = decorator.getRouteId(handler);

    const req = createMockRequest();
    (req.state as Record<string, unknown>)['guardRouteId'] = routeId;
    expect(getRouteDecoratorConfig(req, decorator)?.rateLimit).toBe(99);
  });
});

describe('initializeBehaviorTracking with Redis', () => {
  it('calls tracker initializeRedis when Redis provided', async () => {
    const config = SecurityConfigSchema.parse({});
    const decorator = new BaseSecurityDecorator(config);
    const mockRedis = { getKey: vi.fn(), setKey: vi.fn() };
    await decorator.initializeBehaviorTracking(mockRedis as never);
  });
});
