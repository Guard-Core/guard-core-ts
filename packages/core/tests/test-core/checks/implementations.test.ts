import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMiddleware, createMockRequest, createMockResponse } from '../../helpers.js';
import { RouteConfig } from '../../../src/models/route-config.js';
import { EmergencyModeCheck } from '../../../src/core/checks/implementations/emergency-mode.js';
import { RequestLoggingCheck } from '../../../src/core/checks/implementations/request-logging.js';
import { RequestSizeContentCheck } from '../../../src/core/checks/implementations/request-size-content.js';
import { RequiredHeadersCheck } from '../../../src/core/checks/implementations/required-headers.js';
import { AuthenticationCheck } from '../../../src/core/checks/implementations/authentication.js';
import { ReferrerCheck } from '../../../src/core/checks/implementations/referrer.js';
import { CustomValidatorsCheck } from '../../../src/core/checks/implementations/custom-validators.js';
import { CloudIpRefreshCheck } from '../../../src/core/checks/implementations/cloud-ip-refresh.js';
import { UserAgentCheck } from '../../../src/core/checks/implementations/user-agent.js';
import { CustomRequestCheck } from '../../../src/core/checks/implementations/custom-request.js';
import { RouteConfigCheck } from '../../../src/core/checks/implementations/route-config.js';
import { HttpsEnforcementCheck } from '../../../src/core/checks/implementations/https-enforcement.js';
import { IpSecurityCheck } from '../../../src/core/checks/implementations/ip-security.js';
import { RateLimitCheck } from '../../../src/core/checks/implementations/rate-limit.js';
import { SuspiciousActivityCheck } from '../../../src/core/checks/implementations/suspicious-activity.js';
import { TimeWindowCheck } from '../../../src/core/checks/implementations/time-window.js';
import { CloudProviderCheck } from '../../../src/core/checks/implementations/cloud-provider.js';
import type { GuardMiddlewareProtocol } from '../../../src/protocols/middleware.js';

function attachRouteConfig(req: ReturnType<typeof createMockRequest>, rc: RouteConfig) {
  (req.state as Record<string, unknown>)['_routeConfig'] = rc;
}

function createMockValidator(isHttps = true, withinWindow = true) {
  return {
    isRequestHttps: vi.fn().mockReturnValue(isHttps),
    checkTimeWindow: vi.fn().mockResolvedValue(withinWindow),
    isTrustedProxy: vi.fn().mockReturnValue(false),
    isPathExcluded: vi.fn().mockResolvedValue(false),
  };
}

function createMockErrorResponseFactory() {
  return {
    createErrorResponse: vi.fn().mockImplementation(async (statusCode: number, message: string) =>
      createMockResponse(statusCode, message),
    ),
    createHttpsRedirect: vi.fn().mockImplementation(async (request: { urlReplaceScheme: (s: string) => string }) => {
      const resp = createMockResponse(301, '');
      resp.setHeader('location', request.urlReplaceScheme('https'));
      return resp;
    }),
    applySecurityHeaders: vi.fn().mockImplementation(async (response: unknown) => response),
    applyCorsHeaders: vi.fn().mockImplementation(async (response: unknown) => response),
    applyModifier: vi.fn().mockImplementation(async (response: unknown) => response),
    processResponse: vi.fn().mockImplementation(async (_req: unknown, response: unknown) => response),
  };
}

describe('EmergencyModeCheck', () => {
  it('returns null when emergency mode off', async () => {
    const mw = createMockMiddleware();
    const check = new EmergencyModeCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('blocks when emergency mode on', async () => {
    const mw = createMockMiddleware({ emergencyMode: true });
    const check = new EmergencyModeCheck(mw);
    const result = await check.check(createMockRequest());
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(503);
  });

  it('allows whitelisted IP in emergency mode', async () => {
    const mw = createMockMiddleware({ emergencyMode: true, emergencyWhitelist: ['1.2.3.4'] });
    const check = new EmergencyModeCheck(mw);
    expect(await check.check(createMockRequest({ clientHost: '1.2.3.4' }))).toBeNull();
  });

  it('blocks empty clientHost in emergency mode', async () => {
    const mw = createMockMiddleware({ emergencyMode: true });
    const check = new EmergencyModeCheck(mw);
    const req = createMockRequest({ clientHost: '' });
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(503);
  });
});

describe('RequestLoggingCheck', () => {
  it('returns null always (logging only)', async () => {
    const mw = createMockMiddleware({ logRequestLevel: 'INFO' });
    const check = new RequestLoggingCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('skips when log level is null', async () => {
    const mw = createMockMiddleware();
    const check = new RequestLoggingCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });
});

describe('RequestSizeContentCheck', () => {
  it('returns null with no route config', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('blocks oversized requests', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.maxRequestSize = 100;
    const req = createMockRequest({ headers: { 'content-length': '200', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(413);
  });

  it('allows request within size limit', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.maxRequestSize = 1000;
    const req = createMockRequest({ headers: { 'content-length': '50', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('blocks invalid content type', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.allowedContentTypes = ['application/json'];
    const req = createMockRequest({ headers: { 'content-type': 'text/xml', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(415);
  });

  it('allows valid content type', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.allowedContentTypes = ['application/json'];
    const req = createMockRequest({ headers: { 'content-type': 'application/json', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('logs instead of blocking in passive mode', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.maxRequestSize = 100;
    const req = createMockRequest({ headers: { 'content-length': '200', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode for content type', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.allowedContentTypes = ['application/json'];
    const req = createMockRequest({ headers: { 'content-type': 'text/xml', 'user-agent': 'T' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });
});

describe('RequiredHeadersCheck', () => {
  it('returns null with no route config', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('blocks when required header missing', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'x-api-key': '' };
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('allows when required header present', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'x-api-key': 'required' };
    const req = createMockRequest({ headers: { 'x-api-key': 'abc123', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'x-api-key': '' };
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });
});

describe('AuthenticationCheck', () => {
  it('returns null with no route config', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('blocks missing bearer token', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it('allows valid bearer token', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = (request, credential) => ({ user: credential });
    const req = createMockRequest({ headers: { authorization: 'Bearer abc123', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['auth_principal']).toEqual({ user: 'abc123' });
  });

  it('blocks missing API key', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.apiKeyRequired = true;
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it('allows valid API key', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.apiKeyRequired = true;
    rc.apiKeyHeader = 'X-API-Key';
    rc.apiKeyVerifier = (request, credential) => ({ key: credential });
    const req = createMockRequest({ headers: { 'x-api-key': 'key123', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['auth_principal']).toEqual({ key: 'key123' });
  });

  it('passive mode for bearer', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode for API key', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.apiKeyRequired = true;
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });
});

describe('ReferrerCheck', () => {
  it('returns null with no referrer restriction', async () => {
    const mw = createMockMiddleware();
    const check = new ReferrerCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('blocks invalid referrer', async () => {
    const mw = createMockMiddleware();
    const check = new ReferrerCheck(mw);
    const rc = new RouteConfig();
    rc.requireReferrer = ['example.com'];
    const req = createMockRequest({ headers: { referer: 'https://evil.com', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('allows valid referrer', async () => {
    const mw = createMockMiddleware();
    const check = new ReferrerCheck(mw);
    const rc = new RouteConfig();
    rc.requireReferrer = ['example.com'];
    const req = createMockRequest({ headers: { referer: 'https://example.com/page', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new ReferrerCheck(mw);
    const rc = new RouteConfig();
    rc.requireReferrer = ['example.com'];
    const req = createMockRequest({ headers: { referer: 'https://evil.com', 'user-agent': 'Test' } });
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });
});

describe('CustomValidatorsCheck', () => {
  it('returns null with no validators', async () => {
    const mw = createMockMiddleware();
    const check = new CustomValidatorsCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('runs validators and returns their response', async () => {
    const mw = createMockMiddleware();
    const check = new CustomValidatorsCheck(mw);
    const rc = new RouteConfig();
    rc.customValidators = [async () => createMockResponse(418, 'teapot')];
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(418);
  });

  it('returns null when validators pass', async () => {
    const mw = createMockMiddleware();
    const check = new CustomValidatorsCheck(mw);
    const rc = new RouteConfig();
    rc.customValidators = [async () => null];
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });
});

describe('CloudIpRefreshCheck', () => {
  it('returns null always (side-effect only)', async () => {
    const mw = createMockMiddleware();
    const check = new CloudIpRefreshCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('triggers refresh when interval elapsed', async () => {
    const mw = createMockMiddleware({ blockCloudProviders: ['AWS'] });
    mw.lastCloudIpRefresh = 0;
    const refreshSpy = vi.fn();
    (mw as Record<string, unknown>)['refreshCloudIpRanges'] = refreshSpy;
    const check = new CloudIpRefreshCheck(mw);
    await check.check(createMockRequest());
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('skips refresh when interval not elapsed', async () => {
    const mw = createMockMiddleware({ blockCloudProviders: ['AWS'] });
    mw.lastCloudIpRefresh = Date.now() / 1000;
    const refreshSpy = vi.fn();
    (mw as Record<string, unknown>)['refreshCloudIpRanges'] = refreshSpy;
    const check = new CloudIpRefreshCheck(mw);
    await check.check(createMockRequest());
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('handles refresh error gracefully', async () => {
    const mw = createMockMiddleware({ blockCloudProviders: ['AWS'] });
    mw.lastCloudIpRefresh = 0;
    (mw as Record<string, unknown>)['refreshCloudIpRanges'] = vi.fn().mockRejectedValue(new Error('fail'));
    const check = new CloudIpRefreshCheck(mw);
    await check.check(createMockRequest());
  });
});

describe('UserAgentCheck', () => {
  it('returns null for non-blocked user agent', async () => {
    const mw = createMockMiddleware({ blockedUserAgents: ['badbot'] });
    const check = new UserAgentCheck(mw);
    const req = createMockRequest({ headers: { 'user-agent': 'Chrome/120' } });
    expect(await check.check(req)).toBeNull();
  });

  it('blocks matching user agent', async () => {
    const mw = createMockMiddleware({ blockedUserAgents: ['badbot'] });
    const check = new UserAgentCheck(mw);
    const req = createMockRequest({ headers: { 'user-agent': 'badbot/1.0' } });
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('returns null for empty user agent', async () => {
    const mw = createMockMiddleware({ blockedUserAgents: ['badbot'] });
    const check = new UserAgentCheck(mw);
    const req = createMockRequest({ headers: {} });
    expect(await check.check(req)).toBeNull();
  });

  it('logs instead of blocking in passive mode', async () => {
    const mw = createMockMiddleware({ passiveMode: true, blockedUserAgents: ['badbot'] });
    const check = new UserAgentCheck(mw);
    const req = createMockRequest({ headers: { 'user-agent': 'badbot/1.0' } });
    expect(await check.check(req)).toBeNull();
  });
});

describe('CustomRequestCheck', () => {
  it('returns null when no custom check configured', async () => {
    const mw = createMockMiddleware();
    const check = new CustomRequestCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('runs custom check and returns response', async () => {
    const mw = createMockMiddleware({
      customRequestCheck: async () => createMockResponse(403, 'blocked by custom check'),
    });
    const check = new CustomRequestCheck(mw);
    const result = await check.check(createMockRequest());
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });
});

describe('RouteConfigCheck', () => {
  it('returns null always (stamps state only)', async () => {
    const mw = createMockMiddleware();
    const check = new RouteConfigCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });

  it('attaches route config to request state when found', async () => {
    const rc = new RouteConfig();
    rc.rateLimit = 42;
    const mw = createMockMiddleware();
    (mw as Record<string, unknown>)['routeResolver'] = {
      getRouteConfig: () => rc,
    };
    const check = new RouteConfigCheck(mw);
    const req = createMockRequest();
    await check.check(req);
    expect((req.state as Record<string, unknown>)['_routeConfig']).toBe(rc);
  });
});

describe('HttpsEnforcementCheck', () => {
  let middleware: GuardMiddlewareProtocol;

  beforeEach(() => {
    middleware = createMockMiddleware({ enforceHttps: true });
  });

  it('returns null when enforceHttps is false', async () => {
    middleware = createMockMiddleware({ enforceHttps: false });
    const validator = createMockValidator();
    const factory = createMockErrorResponseFactory();
    const check = new HttpsEnforcementCheck(middleware, validator as never, factory as never);

    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when request is HTTPS', async () => {
    const validator = createMockValidator(true);
    const factory = createMockErrorResponseFactory();
    const check = new HttpsEnforcementCheck(middleware, validator as never, factory as never);

    const result = await check.check(createMockRequest({ urlScheme: 'https' }));
    expect(result).toBeNull();
  });

  it('returns redirect when request is HTTP', async () => {
    const validator = createMockValidator(false);
    const factory = createMockErrorResponseFactory();
    const check = new HttpsEnforcementCheck(middleware, validator as never, factory as never);

    const request = createMockRequest({ urlScheme: 'http' });
    const result = await check.check(request);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(301);
    expect(factory.createHttpsRedirect).toHaveBeenCalledWith(request);
  });

  it('returns null in passive mode', async () => {
    middleware = createMockMiddleware({ enforceHttps: true, passiveMode: true });
    const validator = createMockValidator(false);
    const factory = createMockErrorResponseFactory();
    const check = new HttpsEnforcementCheck(middleware, validator as never, factory as never);

    const result = await check.check(createMockRequest({ urlScheme: 'http' }));
    expect(result).toBeNull();
  });
});

describe('IpSecurityCheck', () => {
  let middleware: GuardMiddlewareProtocol;

  beforeEach(() => {
    middleware = createMockMiddleware();
  });

  it('returns null when no clientHost', async () => {
    const check = new IpSecurityCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '' }));
    expect(result).toBeNull();
  });

  it('blocks blacklisted IP', async () => {
    middleware = createMockMiddleware({ blacklist: ['10.0.0.1'] });
    const check = new IpSecurityCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '10.0.0.1' }));
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('allows non-blacklisted IP', async () => {
    middleware = createMockMiddleware({ blacklist: ['10.0.0.1'] });
    const check = new IpSecurityCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '192.168.1.1' }));
    expect(result).toBeNull();
  });

  it('logs but does not block in passive mode', async () => {
    middleware = createMockMiddleware({ blacklist: ['10.0.0.1'], passiveMode: true });
    const logSpy = vi.spyOn(middleware.logger, 'warn');
    const check = new IpSecurityCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '10.0.0.1' }));
    expect(result).toBeNull();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[PASSIVE MODE]'));
  });

  it('blocks IP denied by route config', async () => {
    const check = new IpSecurityCheck(middleware);
    const request = createMockRequest({ clientHost: '10.0.0.5' });
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      ipBlacklist: ['10.0.0.5'],
      ipWhitelist: null,
      blockedCountries: null,
      whitelistCountries: null,
      blockedUserAgents: [],
      bypassedChecks: new Set(),
      behaviorRules: [],
      blockCloudProviders: new Set(),
      customValidators: [],
      requiredHeaders: {},
    };
    const result = await check.check(request);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('passive mode for global blacklist', async () => {
    const mw = createMockMiddleware({ passiveMode: true, blacklist: ['1.2.3.4'] });
    const check = new IpSecurityCheck(mw);
    const req = createMockRequest({ clientHost: '1.2.3.4' });
    expect(await check.check(req)).toBeNull();
  });
});

describe('RateLimitCheck', () => {
  let middleware: GuardMiddlewareProtocol;

  beforeEach(() => {
    middleware = createMockMiddleware({ enableRateLimiting: true });
  });

  it('returns null when rate limiting disabled', async () => {
    middleware = createMockMiddleware({ enableRateLimiting: false });
    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when no clientHost', async () => {
    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '' }));
    expect(result).toBeNull();
  });

  it('returns null when rate limit handler allows request', async () => {
    const mockHandler = {
      checkRateLimit: vi.fn().mockResolvedValue(null),
    };
    (middleware as Record<string, unknown>)['rateLimitHandler'] = mockHandler;

    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
    expect(mockHandler.checkRateLimit).toHaveBeenCalled();
  });

  it('returns error response when rate limit handler blocks', async () => {
    const blockedResponse = createMockResponse(429, 'Rate limit exceeded');
    const mockHandler = {
      checkRateLimit: vi.fn().mockResolvedValue(blockedResponse),
    };
    (middleware as Record<string, unknown>)['rateLimitHandler'] = mockHandler;

    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(429);
  });

  it('returns null in passive mode when rate limit exceeded', async () => {
    middleware = createMockMiddleware({ enableRateLimiting: true, passiveMode: true });
    const blockedResponse = createMockResponse(429, 'Rate limit exceeded');
    const mockHandler = {
      checkRateLimit: vi.fn().mockResolvedValue(blockedResponse),
    };
    (middleware as Record<string, unknown>)['rateLimitHandler'] = mockHandler;

    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('checks route-level rate limit when route config has rateLimit', async () => {
    const blockedResponse = createMockResponse(429, 'Rate limit exceeded');
    const mockHandler = {
      checkRateLimit: vi.fn().mockResolvedValue(blockedResponse),
    };
    (middleware as Record<string, unknown>)['rateLimitHandler'] = mockHandler;

    const check = new RateLimitCheck(middleware);
    const request = createMockRequest();
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      rateLimit: 5,
      rateLimitWindow: 30,
    };

    const result = await check.check(request);
    expect(result).not.toBeNull();
    expect(mockHandler.checkRateLimit).toHaveBeenCalledWith(
      request, '1.2.3.4', expect.any(Function), '/api/test', 5, 30,
    );
  });

  it('checks endpoint-level rate limit from config', async () => {
    middleware = createMockMiddleware({
      enableRateLimiting: true,
      endpointRateLimits: { '/api/test': [3, 10] },
    });
    const mockHandler = {
      checkRateLimit: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockResponse(429, 'Rate limit exceeded')),
    };
    (middleware as Record<string, unknown>)['rateLimitHandler'] = mockHandler;

    const check = new RateLimitCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).not.toBeNull();
    expect(mockHandler.checkRateLimit).toHaveBeenCalledTimes(2);
  });

  it('passive mode for route limit', async () => {
    const mw = createMockMiddleware({ passiveMode: true, enableRateLimiting: true });
    (mw as Record<string, unknown>)['rateLimitHandler'] = {
      checkRateLimit: vi.fn().mockResolvedValue(createMockResponse(429, 'limit')),
    };
    const check = new RateLimitCheck(mw);
    const rc = new RouteConfig();
    rc.rateLimit = 1;
    rc.rateLimitWindow = 60;
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode for endpoint limit', async () => {
    const mw = createMockMiddleware({
      passiveMode: true,
      enableRateLimiting: true,
      endpointRateLimits: { '/api/test': [1, 60] },
    });
    (mw as Record<string, unknown>)['rateLimitHandler'] = {
      checkRateLimit: vi.fn().mockResolvedValue(createMockResponse(429, 'limit')),
    };
    const check = new RateLimitCheck(mw);
    const req = createMockRequest();
    expect(await check.check(req)).toBeNull();
  });

  it('passive mode for global limit', async () => {
    const mw = createMockMiddleware({ passiveMode: true, enableRateLimiting: true });
    (mw as Record<string, unknown>)['rateLimitHandler'] = {
      checkRateLimit: vi.fn().mockResolvedValue(createMockResponse(429, 'limit')),
    };
    const check = new RateLimitCheck(mw);
    const req = createMockRequest();
    expect(await check.check(req)).toBeNull();
  });
});

describe('SuspiciousActivityCheck', () => {
  let middleware: GuardMiddlewareProtocol;

  beforeEach(() => {
    middleware = createMockMiddleware({ enablePenetrationDetection: true });
  });

  it('returns null when detection disabled', async () => {
    middleware = createMockMiddleware({ enablePenetrationDetection: false });
    const check = new SuspiciousActivityCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when no clientHost', async () => {
    const check = new SuspiciousActivityCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '' }));
    expect(result).toBeNull();
  });

  it('returns null for benign request', async () => {
    const check = new SuspiciousActivityCheck(middleware);
    const result = await check.check(createMockRequest({
      urlPath: '/api/users',
      queryParams: { page: '1' },
      headers: { 'user-agent': 'Mozilla/5.0' },
    }));
    expect(result).toBeNull();
  });

  it('blocks suspicious request with XSS attempt', async () => {
    const check = new SuspiciousActivityCheck(middleware);
    const result = await check.check(createMockRequest({
      queryParams: { q: '<script>alert(1)</script>' },
    }));
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns null for suspicious request in passive mode', async () => {
    middleware = createMockMiddleware({ enablePenetrationDetection: true, passiveMode: true });
    const check = new SuspiciousActivityCheck(middleware);
    const result = await check.check(createMockRequest({
      queryParams: { q: '<script>alert(1)</script>' },
    }));
    expect(result).toBeNull();
  });

  it('increments suspicious request count', async () => {
    const check = new SuspiciousActivityCheck(middleware);
    await check.check(createMockRequest({
      queryParams: { q: '<script>alert(1)</script>' },
    }));
    expect(middleware.suspiciousRequestCounts.get('1.2.3.4')?.get('xss')).toBe(1);

    await check.check(createMockRequest({
      queryParams: { q: '<script>alert(2)</script>' },
    }));
    expect(middleware.suspiciousRequestCounts.get('1.2.3.4')?.get('xss')).toBe(2);
  });
});

describe('TimeWindowCheck', () => {
  let middleware: GuardMiddlewareProtocol;

  beforeEach(() => {
    middleware = createMockMiddleware();
  });

  it('returns null when no timeRestrictions on route config', async () => {
    const validator = createMockValidator();
    const check = new TimeWindowCheck(middleware, validator as never);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when within time window', async () => {
    const validator = createMockValidator(true, true);
    const check = new TimeWindowCheck(middleware, validator as never);
    const request = createMockRequest();
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      timeRestrictions: { start: '00:00', end: '23:59' },
    };
    const result = await check.check(request);
    expect(result).toBeNull();
    expect(validator.checkTimeWindow).toHaveBeenCalledWith({ start: '00:00', end: '23:59' });
  });

  it('blocks when outside time window', async () => {
    const validator = createMockValidator(true, false);
    const check = new TimeWindowCheck(middleware, validator as never);
    const request = createMockRequest();
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      timeRestrictions: { start: '02:00', end: '03:00' },
    };
    const result = await check.check(request);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('returns null when outside time window in passive mode', async () => {
    middleware = createMockMiddleware({ passiveMode: true });
    const validator = createMockValidator(true, false);
    const check = new TimeWindowCheck(middleware, validator as never);
    const request = createMockRequest();
    (request.state as Record<string, unknown>)['_routeConfig'] = {
      timeRestrictions: { start: '02:00', end: '03:00' },
    };
    const result = await check.check(request);
    expect(result).toBeNull();
  });
});

describe('CloudProviderCheck', () => {
  let middleware: GuardMiddlewareProtocol;
  let cloudHandler: { isCloudIp: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    middleware = createMockMiddleware();
    cloudHandler = { isCloudIp: vi.fn().mockReturnValue(false) };
  });

  it('returns null when no clientHost', async () => {
    const check = new CloudProviderCheck(middleware);
    const result = await check.check(createMockRequest({ clientHost: '' }));
    expect(result).toBeNull();
  });

  it('returns null when no providers to check', async () => {
    const check = new CloudProviderCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when providers list is empty', async () => {
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => [];
    const check = new CloudProviderCheck(middleware);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when no cloud handler was injected', async () => {
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => ['AWS'];
    const check = new CloudProviderCheck(middleware, null);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when the handler does not resolve the IP to a selected provider', async () => {
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => ['AWS'];
    const check = new CloudProviderCheck(middleware, cloudHandler as never);
    const result = await check.check(createMockRequest());
    expect(result).toBeNull();
    expect(cloudHandler.isCloudIp).toHaveBeenCalledWith('1.2.3.4', new Set(['AWS']));
  });

  it('blocks a cloud IP with 403 when the handler resolves a selected provider', async () => {
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => ['AWS'];
    cloudHandler.isCloudIp.mockReturnValue(true);
    const check = new CloudProviderCheck(middleware, cloudHandler as never);
    const result = await check.check(createMockRequest());
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('blocks and reports logged_only action in passive mode', async () => {
    middleware = createMockMiddleware({ passiveMode: true });
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => ['AWS'];
    const cloudEvents: Array<[string, string[], boolean]> = [];
    const decoratorEvents: string[] = [];
    (middleware.eventBus as Record<string, unknown>)['sendCloudDetectionEvents'] =
      async (_r: unknown, ip: string, providers: string[], rc: { blockCloudProviders: Set<string> } | null, _handler: unknown, passiveMode: boolean) => {
        cloudEvents.push([ip, providers, passiveMode]);
        if (rc && rc.blockCloudProviders.size > 0) {
          decoratorEvents.push(`decorator_violation:${passiveMode ? 'logged_only' : 'request_blocked'}`);
        }
      };
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string) => { decoratorEvents.push(`${type}:${action}`); };
    cloudHandler.isCloudIp.mockReturnValue(true);
    const check = new CloudProviderCheck(middleware, cloudHandler as never);

    const plain = createMockRequest();
    expect(await check.check(plain)).toBeNull();
    expect(cloudEvents).toEqual([['1.2.3.4', ['AWS'], true]]);
    expect(decoratorEvents).toEqual([]);

    cloudEvents.length = 0;
    decoratorEvents.length = 0;
    const rc = new RouteConfig();
    rc.blockCloudProviders = new Set(['AWS']);
    const routed = createMockRequest();
    (routed.state as Record<string, unknown>)['_routeConfig'] = rc;
    expect(await check.check(routed)).toBeNull();
    expect(cloudEvents).toEqual([['1.2.3.4', ['AWS'], true]]);
    expect(decoratorEvents).toEqual(['decorator_violation:logged_only']);
  });

  it('route bypass ["clouds"] skips provider resolution entirely', async () => {
    const spy = vi.fn(() => ['AWS']);
    (middleware.routeResolver as Record<string, unknown>)['shouldBypassCheck'] = () => true;
    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = spy as never;
    const check = new CloudProviderCheck(middleware, cloudHandler as never);
    const rc = new RouteConfig();
    rc.bypassedChecks = new Set(['clouds']);
    const req = createMockRequest();
    (req.state as Record<string, unknown>)['_routeConfig'] = rc;
    expect(await check.check(req)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits a decorator violation only for route-level provider blocks', async () => {
    middleware = createMockMiddleware();
    const cloudEvents: number[] = [];
    const decoratorEvents: string[] = [];
    (middleware.eventBus as Record<string, unknown>)['sendCloudDetectionEvents'] =
      async (...args: unknown[]) => { cloudEvents.push(args.length); };
    /* 6-arg reference signature: request, ip, providers, routeConfig,
       cloudHandler, passiveMode. */
    expect(cloudEvents).toEqual([]);
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string) => { decoratorEvents.push(type); };
    cloudHandler.isCloudIp.mockReturnValue(true);
    const check = new CloudProviderCheck(middleware, cloudHandler as never);

    /* The decorator event rides the real sendCloudDetectionEvents contract;
       mirror its route-gate here. */
    (middleware.eventBus as Record<string, unknown>)['sendCloudDetectionEvents'] =
      async (_r: unknown, ip: string, providers: string[], rc: { blockCloudProviders: Set<string> } | null, _handler: unknown, passiveMode: boolean) => {
        cloudEvents.push(6);
        if (rc && rc.blockCloudProviders.size > 0) {
          decoratorEvents.push('decorator_violation');
        }
      };

    (middleware.routeResolver as Record<string, unknown>)['getCloudProvidersToCheck'] = () => ['AWS'];
    await check.check(createMockRequest());
    expect(cloudEvents).toEqual([6]);
    expect(decoratorEvents).toEqual([]);

    cloudEvents.length = 0;
    decoratorEvents.length = 0;
    const rc = new RouteConfig();
    rc.blockCloudProviders = new Set(['AWS']);
    const routed = createMockRequest();
    (routed.state as Record<string, unknown>)['_routeConfig'] = rc;
    await check.check(routed);
    expect(cloudEvents).toEqual([6]);
    expect(decoratorEvents).toEqual(['decorator_violation']);

    cloudEvents.length = 0;
    decoratorEvents.length = 0;
    const globalOnlyRc = new RouteConfig();
    const globalOnlyReq = createMockRequest();
    (globalOnlyReq.state as Record<string, unknown>)['_routeConfig'] = globalOnlyRc;
    await check.check(globalOnlyReq);
    expect(cloudEvents).toEqual([6]);
    expect(decoratorEvents).toEqual([]);
  });
});

describe('additional branch coverage', () => {
  it('EmergencyModeCheck: null clientHost coalesces to empty string', async () => {
    const mw = createMockMiddleware({ emergencyMode: true, emergencyWhitelist: [] });
    const check = new EmergencyModeCheck(mw);
    const req = createMockRequest({ clientHost: null });
    const result = await check.check(req);
    expect(result).not.toBeNull();
  });

  it('IpSecurityCheck: passive mode for route config IP block', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new IpSecurityCheck(mw);
    const rc = new RouteConfig();
    rc.ipBlacklist = ['1.2.3.4'];
    const req = createMockRequest();
    attachRouteConfig(req, rc);
    expect(await check.check(req)).toBeNull();
  });

  it('RateLimitCheck: endpoint-specific limit exceeded (non-passive)', async () => {
    const mw = createMockMiddleware({ enableRateLimiting: true, endpointRateLimits: { '/api/test': [1, 60] } });
    (mw as Record<string, unknown>)['rateLimitHandler'] = {
      checkRateLimit: vi.fn().mockResolvedValue(createMockResponse(429, 'limit')),
    };
    const check = new RateLimitCheck(mw);
    const req = createMockRequest();
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(429);
  });

  it('ReferrerCheck: both referer and referrer headers missing', async () => {
    const mw = createMockMiddleware();
    const check = new ReferrerCheck(mw);
    const rc = new RouteConfig();
    rc.requireReferrer = ['example.com'];
    const req = createMockRequest({ headers: {} });
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
  });

  it('RequestSizeContentCheck: missing content-length and content-type', async () => {
    const mw = createMockMiddleware();
    const check = new RequestSizeContentCheck(mw);
    const rc = new RouteConfig();
    rc.maxRequestSize = 100;
    rc.allowedContentTypes = ['application/json'];
    const req = createMockRequest({ headers: {} });
    attachRouteConfig(req, rc);
    /* Reference parity (request_size_content.py _check_content_type_allowed):
       a missing content-type header is not in the allowed list and blocks
       with 415, like the reference. */
    const result = await check.check(req);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(415);
  });

  it('RequiredHeadersCheck: header present but wrong value', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'x-version': '2.0' };
    const req = createMockRequest({ headers: { 'x-version': '1.0', 'user-agent': 'T' } });
    attachRouteConfig(req, rc);
    const result = await check.check(req);
    expect(result).not.toBeNull();
  });
});

describe('check names', () => {
  it('each check has a unique name', () => {
    const mw = createMockMiddleware();
    const names = [
      new EmergencyModeCheck(mw).checkName,
      new RequestLoggingCheck(mw).checkName,
      new RequestSizeContentCheck(mw).checkName,
      new RequiredHeadersCheck(mw).checkName,
      new AuthenticationCheck(mw).checkName,
      new ReferrerCheck(mw).checkName,
      new CustomValidatorsCheck(mw).checkName,
      new CloudIpRefreshCheck(mw).checkName,
      new UserAgentCheck(mw).checkName,
      new CustomRequestCheck(mw).checkName,
      new RouteConfigCheck(mw).checkName,
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
