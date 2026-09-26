import { describe, it, expect, vi } from 'vitest';
import { AuthenticationCheck } from '../../src/core/checks/implementations/authentication.js';
import { RequiredHeadersCheck, classifyHeaderViolation } from '../../src/core/checks/implementations/required-headers.js';
import { extractCredential, resolveVerifierResult } from '../../src/core/checks/helpers.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { createMockMiddleware, createMockRequest } from '../helpers.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import type { GuardResponse } from '../../src/protocols/response.js';
import type { SecurityCheck } from '../../src/core/checks/base.js';

function attach(rc: RouteConfig, request: GuardRequest): GuardRequest {
  (request.state as Record<string, unknown>)['_routeConfig'] = rc;
  return request;
}

function eventSpy(check: SecurityCheck) {
  return vi.spyOn(check, 'sendEvent').mockResolvedValue(undefined);
}

describe('extractCredential', () => {
  it('mirrors the reference bearer and basic extraction', () => {
    expect(extractCredential('Bearer tok', 'bearer')).toEqual(['tok', '']);
    expect(extractCredential('bearer tok', 'bearer'))
      .toEqual([null, 'Missing or invalid Bearer token']);
    expect(extractCredential('Basic dXNlcjpwYXNz', 'basic')).toEqual(['dXNlcjpwYXNz', '']);
    expect(extractCredential('Token x', 'basic'))
      .toEqual([null, 'Missing or invalid Basic authentication']);
  });

  it('mirrors the reference general-scheme extraction', () => {
    expect(extractCredential('', 'ApiKey')).toEqual([null, 'Missing ApiKey authentication']);
    expect(extractCredential('raw-key', 'ApiKey')).toEqual(['raw-key', '']);
  });
});

describe('resolveVerifierResult', () => {
  it('awaits promises and passes values through', async () => {
    expect(await resolveVerifierResult(Promise.resolve(7))).toBe(7);
    expect(await resolveVerifierResult(7)).toBe(7);
  });
});

describe('RequiredHeadersCheck reference semantics', () => {
  it('answers 400 "Missing required header: X" for absent headers', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'X-Request-Id': 'required' };
    const result = await check.check(attach(rc, createMockRequest()));
    expect(result!.statusCode).toBe(400);
    expect(result!.bodyText).toBe('Missing required header: X-Request-Id');
  });

  it('answers 400 with the mismatch message for wrong values', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'X-Request-Id': 'expected-value' };
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { 'x-request-id': 'wrong' } })),
    );
    expect(result!.statusCode).toBe(400);
    expect(result!.bodyText)
      .toBe("Header 'X-Request-Id' does not match the required value");
  });

  it('treats the "required" sentinel as presence-only', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'X-Request-Id': 'required' };
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { 'x-request-id': 'anything' } })),
    );
    expect(result).toBeNull();
  });

  it('returns null in passive mode', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new RequiredHeadersCheck(mw);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'X-Request-Id': 'required' };
    expect(await check.check(attach(rc, createMockRequest()))).toBeNull();
  });

  it('scopes the decorator_violation event by header classification', async () => {
    const mw = createMockMiddleware();
    const check = new RequiredHeadersCheck(mw);
    const sendEvent = eventSpy(check);
    const rc = new RouteConfig();
    rc.requiredHeaders = { 'x-api-key': 'required', authorization: 'required', 'x-other': 'required' };
    await check.check(attach(rc, createMockRequest()));
    expect(sendEvent.mock.calls[0][4]).toMatchObject({
      decoratorType: 'authentication', violationType: 'api_key_required', missing_header: 'x-api-key',
    });
  });

  it('classifies headers exactly like the reference', () => {
    expect(classifyHeaderViolation('X-API-Key')).toEqual(['authentication', 'api_key_required']);
    expect(classifyHeaderViolation('Authorization')).toEqual(['authentication', 'required_header']);
    expect(classifyHeaderViolation('X-Other')).toEqual(['advanced', 'required_header']);
  });
});

describe('AuthenticationCheck reference semantics', () => {
  it('answers 401 "Authentication required" for a failed bearer', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = () => ({ user: 'u' });
    const result = await check.check(attach(rc, createMockRequest()));
    expect(result!.statusCode).toBe(401);
    expect(result!.bodyText).toBe('Authentication required');
  });

  it('presence-only authorizationHeaderRequired allows any bearer and blocks absence', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authorizationHeaderRequired = 'bearer';

    const missing = await check.check(attach(rc, createMockRequest()));
    expect(missing!.statusCode).toBe(401);

    const present = await check.check(
      attach(rc, createMockRequest({ headers: { authorization: 'Bearer whatever' } })),
    );
    expect(present).toBeNull();
  });

  it('fails closed with "No auth verifier configured" when none is set', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const sendEvent = eventSpy(check);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } })),
    );
    expect(result!.statusCode).toBe(401);
    expect(sendEvent.mock.calls[0][4]).toMatchObject({
      decoratorType: 'authentication', violationType: 'require_auth', authType: 'bearer',
    });
  });

  it('prefers the route verifier over the global authVerifier', async () => {
    const globalVerifier = vi.fn(() => 'global');
    const routeVerifier = vi.fn(() => 'route');
    const mw = createMockMiddleware({ authVerifier: globalVerifier });
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = routeVerifier;
    const req = attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } }));
    expect(await check.check(req)).toBeNull();
    expect(routeVerifier).toHaveBeenCalled();
    expect(globalVerifier).not.toHaveBeenCalled();
    expect((req.state as Record<string, unknown>)['auth_principal']).toBe('route');
  });

  it('falls back to the global authVerifier', async () => {
    const mw = createMockMiddleware({ authVerifier: () => 'principal' });
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    const req = attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } }));
    expect(await check.check(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['auth_principal']).toBe('principal');
  });

  it('awaits async verifiers', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = async () => 'async-principal';
    const req = attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } }));
    expect(await check.check(req)).toBeNull();
    expect((req.state as Record<string, unknown>)['auth_principal']).toBe('async-principal');
  });

  it('maps a throwing verifier to 401 (Authentication error)', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const sendEvent = eventSpy(check);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = () => { throw new Error('db down'); };
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } })),
    );
    expect(result!.statusCode).toBe(401);
    expect(sendEvent.mock.calls[0][3]).toBe('Authentication error');
  });

  it('maps a falsy verifier result to 401 (Authentication failed)', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const sendEvent = eventSpy(check);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = () => null;
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } })),
    );
    expect(result!.statusCode).toBe(401);
    expect(sendEvent.mock.calls[0][3]).toBe('Authentication failed');
  });

  it('reads the api key from the route-named header case-insensitively', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.apiKeyRequired = true;
    rc.apiKeyHeader = 'X-API-Key';
    rc.apiKeyVerifier = (_request, credential) => credential;

    const ok = await check.check(
      attach(rc, createMockRequest({ headers: { 'x-api-key': 'k' } })),
    );
    expect(ok).toBeNull();

    const missing = await check.check(attach(rc, createMockRequest()));
    expect(missing!.statusCode).toBe(401);
  });

  it('returns null in passive mode for auth failures', async () => {
    const mw = createMockMiddleware({ passiveMode: true });
    const check = new AuthenticationCheck(mw);
    const rc = new RouteConfig();
    rc.authRequired = 'bearer';
    rc.authVerifier = () => null;
    const result = await check.check(
      attach(rc, createMockRequest({ headers: { authorization: 'Bearer tok' } })),
    );
    expect(result).toBeNull();
  });

  it('returns null without a route config', async () => {
    const mw = createMockMiddleware();
    const check = new AuthenticationCheck(mw);
    expect(await check.check(createMockRequest())).toBeNull();
  });
});
