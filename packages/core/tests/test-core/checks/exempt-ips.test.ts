/**
 * Middleware-level parity tests for the exemptIps skip-list (guard-core
 * #117/#118 port).
 *
 * Every vector below goes through the real pipeline built by
 * initializeSecurityMiddleware, mirroring the reference acceptance checklist
 * (specs/exempt-ips.md section 7, reference tests/test_core/test_exempt_ips.py):
 * an exempt match sets the same skip state a whitelist match sets for rate
 * limiting, the user-agent check and the (route) cloud-provider check, never
 * adds or relaxes a deny path, and leaves penetration detection, the
 * blacklist, dynamic bans and route IP rules fully in force.
 */

import { describe, it, expect, vi } from 'vitest';
import { initializeSecurityMiddleware } from '../../../src/middleware-support.js';
import type { SecurityMiddlewareComponents } from '../../../src/middleware-support.js';
import { SecurityConfigSchema } from '../../../src/models/config.js';
import { RouteConfig } from '../../../src/models/route-config.js';
import { defaultLogger } from '../../../src/models/logger.js';
import type { GuardRequest } from '../../../src/protocols/request.js';
import { isIpInWhitelist } from '../../../src/core/checks/helpers.js';
import { createMockResponseFactory } from '../../helpers.js';

const EXEMPT_IP = '198.51.100.7';
const OTHER_IP = '203.0.113.9';

function makeRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
  return {
    urlPath: '/api/test',
    urlScheme: 'https',
    urlFull: 'https://example.com/api/test',
    urlReplaceScheme: (s: string) => `${s}://example.com/api/test`,
    method: 'GET',
    clientHost: EXEMPT_IP,
    headers: { 'user-agent': 'TestAgent/1.0' },
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: {},
    scope: {},
    ...overrides,
  };
}

async function build(configOverrides: Record<string, unknown> = {}): Promise<SecurityMiddlewareComponents> {
  const config = SecurityConfigSchema.parse({ enableRedis: false, ...configOverrides });
  return initializeSecurityMiddleware(config, defaultLogger, createMockResponseFactory());
}

async function run(components: SecurityMiddlewareComponents, request: GuardRequest) {
  const response = await components.pipeline.execute(request);
  return response;
}

describe('exemptIps config validation', () => {
  it('defaults to an empty list', () => {
    const config = SecurityConfigSchema.parse({});
    expect(config.exemptIps).toEqual([]);
  });

  it('accepts IPs and CIDR ranges', () => {
    const config = SecurityConfigSchema.parse({ exemptIps: [EXEMPT_IP, '198.51.100.16/28'] });
    expect(config.exemptIps).toEqual([EXEMPT_IP, '198.51.100.16/28']);
  });

  it('fails closed on an invalid entry at construction', () => {
    expect(() => SecurityConfigSchema.parse({ exemptIps: ['not-an-ip'] })).toThrow();
    expect(() => SecurityConfigSchema.parse({ exemptIps: ['198.51.100.1/99'] })).toThrow();
  });
});

describe('exemptIps flag resolution (real pipeline)', () => {
  it('sets isExempt for an exact match without blocking anyone', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP, '198.51.100.16/28'] });

    const exempt = makeRequest({ clientHost: EXEMPT_IP });
    expect(await run(components, exempt)).toBeNull();
    expect(exempt.state.isExempt).toBe(true);
    expect(exempt.state.isWhitelisted).toBe(false);

    const inCidr = makeRequest({ clientHost: '198.51.100.20' });
    expect(await run(components, inCidr)).toBeNull();
    expect(inCidr.state.isExempt).toBe(true);

    const other = makeRequest({ clientHost: OTHER_IP });
    expect(await run(components, other)).toBeNull();
    expect(other.state.isExempt).toBe(false);
    expect(other.state.isWhitelisted).toBe(false);
  });

  it('never passes a restrictive whitelist (deny path unchanged)', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], whitelist: [OTHER_IP] });

    const request = makeRequest({ clientHost: EXEMPT_IP });
    const response = await run(components, request);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(403);
    expect(request.state.isExempt).toBeFalsy();
    expect(request.state.isWhitelisted).toBeFalsy();
  });

  it('lets a route requireIp take over, clearing both flags as it does for the whitelist', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], whitelist: [EXEMPT_IP] });
    const routeConfig = new RouteConfig();
    routeConfig.ipWhitelist = [EXEMPT_IP];

    const request = makeRequest({ clientHost: EXEMPT_IP, state: { _routeConfig: routeConfig } });
    expect(await run(components, request)).toBeNull();
    expect(request.state.isWhitelisted).toBe(false);
    expect(request.state.isExempt).toBe(false);
  });

  it('matches IPv4-mapped and IPv6 forms exactly like the whitelist matcher', async () => {
    const cases: Array<[string, string, boolean]> = [
      ['2001:db8::1', '2001:db8::1', true],
      ['2001:db8::1', '2001:db8::2', false],
      ['::ffff:198.51.100.7', '::ffff:198.51.100.7', true],
      ['2001:db8::/32', '2001:db8:ffff::1', true],
      [EXEMPT_IP, '::ffff:198.51.100.7', false],
    ];

    for (const [entry, ip, expected] of cases) {
      const components = await build({ exemptIps: [entry] });
      const request = makeRequest({ clientHost: ip });
      expect(await run(components, request)).toBeNull();
      expect(request.state.isExempt).toBe(expected);
      expect(request.state.isExempt).toBe(isIpInWhitelist(ip, [entry]) === true);
    }
  });
});

describe('exemptIps acceptance checklist (middleware level)', () => {
  it('1+2. exempt IP (exact and by CIDR) exceeds the rate limit keeping normal responses', async () => {
    const exact = await build({ exemptIps: [EXEMPT_IP], rateLimit: 2, rateLimitWindow: 60 });
    for (let i = 0; i < 5; i++) {
      expect(await run(exact, makeRequest({ clientHost: EXEMPT_IP }))).toBeNull();
    }

    const cidr = await build({ exemptIps: ['198.51.100.16/28'], rateLimit: 2, rateLimitWindow: 60 });
    for (let i = 0; i < 5; i++) {
      expect(await run(cidr, makeRequest({ clientHost: '198.51.100.20' }))).toBeNull();
    }
  });

  it('3. a non-exempt client on the same deployment is still throttled', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], rateLimit: 2, rateLimitWindow: 60 });

    expect(await run(components, makeRequest({ clientHost: EXEMPT_IP }))).toBeNull();
    expect(await run(components, makeRequest({ clientHost: OTHER_IP }))).toBeNull();
    expect(await run(components, makeRequest({ clientHost: OTHER_IP }))).toBeNull();
    const throttled = await run(components, makeRequest({ clientHost: OTHER_IP }));
    expect(throttled).not.toBeNull();
    expect(throttled!.statusCode).toBe(429);
  });

  it('4. an empty whitelist leaks no deny path', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });

    const exempt = makeRequest({ clientHost: EXEMPT_IP });
    expect(await run(components, exempt)).toBeNull();

    const other = makeRequest({ clientHost: OTHER_IP });
    expect(await run(components, other)).toBeNull();
    expect(other.state.isExempt).toBe(false);
  });

  it('5. an exempt IP on the blacklist is still blocked', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], blacklist: [EXEMPT_IP] });

    const request = makeRequest({ clientHost: EXEMPT_IP });
    const response = await run(components, request);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(403);
    expect(request.state.isExempt).toBeFalsy();
  });

  it('6. an exempt IP with an active dynamic ban is still blocked', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });
    await components.registry.ipBanHandler.banIp(EXEMPT_IP, 3600, 'test');

    const request = makeRequest({ clientHost: EXEMPT_IP });
    const response = await run(components, request);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(403);
    expect(request.state.isExempt).toBeFalsy();
  });

  it('6a. a banned exempt IP only logs in passive mode and the pipeline continues', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], passiveMode: true });
    await components.registry.ipBanHandler.banIp(EXEMPT_IP, 3600, 'test');

    const request = makeRequest({ clientHost: EXEMPT_IP });
    expect(await run(components, request)).toBeNull();
    expect(request.state.isExempt).toBe(true);
  });

  it('6b. a route bypassing the ip_ban check skips the ban stage for an exempt IP', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });
    await components.registry.ipBanHandler.banIp(EXEMPT_IP, 3600, 'test');
    const routeConfig = new RouteConfig();
    routeConfig.bypassedChecks = new Set(['ip_ban']);

    const request = makeRequest({ clientHost: EXEMPT_IP, state: { _routeConfig: routeConfig } });
    expect(await run(components, request)).toBeNull();
    expect(request.state.isExempt).toBe(true);
  });

  it('7. a per-route blockIp on an exempt IP still blocks on that route', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });
    const routeConfig = new RouteConfig();
    routeConfig.ipBlacklist = [EXEMPT_IP];

    const request = makeRequest({ clientHost: EXEMPT_IP, state: { _routeConfig: routeConfig } });
    const response = await run(components, request);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(403);
  });

  it('8. an attack payload from an exempt IP is still detected', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });

    const request = makeRequest({
      clientHost: EXEMPT_IP,
      queryParams: { q: '<script>alert(1)</script>' },
    });
    const response = await run(components, request);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(400);
    expect(components.middlewareProtocol.suspiciousRequestCounts.get(EXEMPT_IP)?.get('xss')).toBe(1);
  });

  it('10. an IPv4-mapped exempt form skips rate limiting like its IPv4 twin', async () => {
    const components = await build({ exemptIps: ['::ffff:198.51.100.7'], rateLimit: 1, rateLimitWindow: 60 });
    for (let i = 0; i < 3; i++) {
      expect(await run(components, makeRequest({ clientHost: '::ffff:198.51.100.7' }))).toBeNull();
    }
  });
});

describe('exemptIps and whitelist skip consumers (middleware level)', () => {
  it('rate limiting is skipped for an exempt request', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], rateLimit: 1, rateLimitWindow: 60 });

    const exempt = makeRequest({ clientHost: EXEMPT_IP });
    expect(await run(components, exempt)).toBeNull();

    expect(await run(components, makeRequest({ clientHost: OTHER_IP }))).toBeNull();
    const other = makeRequest({ clientHost: OTHER_IP });
    const response = await run(components, other);
    expect(response).not.toBeNull();
    expect(response!.statusCode).toBe(429);
  });

  it('rate limiting is skipped for a whitelisted request too (same skip state)', async () => {
    const components = await build({ whitelist: [EXEMPT_IP], rateLimit: 1, rateLimitWindow: 60 });

    for (let i = 0; i < 3; i++) {
      expect(await run(components, makeRequest({ clientHost: EXEMPT_IP }))).toBeNull();
    }

    const other = makeRequest({ clientHost: OTHER_IP });
    expect((await run(components, other))!.statusCode).toBe(403);
  });

  it('the user-agent check is skipped for an exempt request', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP], blockedUserAgents: ['badbot'] });

    const exempt = makeRequest({ clientHost: EXEMPT_IP, headers: { 'user-agent': 'badbot/1.0' } });
    expect(await run(components, exempt)).toBeNull();

    const other = makeRequest({ clientHost: OTHER_IP, headers: { 'user-agent': 'badbot/1.0' } });
    expect((await run(components, other))!.statusCode).toBe(403);
  });

  it('the user-agent check is skipped for a whitelisted request too (same skip state)', async () => {
    const components = await build({ whitelist: [EXEMPT_IP], blockedUserAgents: ['badbot'] });

    const whitelisted = makeRequest({ clientHost: EXEMPT_IP, headers: { 'user-agent': 'badbot/1.0' } });
    expect(await run(components, whitelisted)).toBeNull();
  });

  it('the per-route cloud-provider block is skipped for an exempt request', async () => {
    const components = await build({ exemptIps: [EXEMPT_IP] });
    const spy = vi.spyOn(components.routeResolver, 'getCloudProvidersToCheck');
    const routeConfig = new RouteConfig();
    routeConfig.blockCloudProviders = new Set(['AWS']);

    const exempt = makeRequest({ clientHost: EXEMPT_IP, state: { _routeConfig: routeConfig } });
    expect(await run(components, exempt)).toBeNull();
    expect(spy).not.toHaveBeenCalled();

    const other = makeRequest({ clientHost: OTHER_IP, state: { _routeConfig: routeConfig } });
    expect(await run(components, other)).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('penetration detection is skipped for a whitelisted request but not for an exempt one', async () => {
    const attack = { queryParams: { q: '<script>alert(1)</script>' } };

    const whitelistComponents = await build({ whitelist: [EXEMPT_IP] });
    const whitelisted = makeRequest({ clientHost: EXEMPT_IP, ...attack });
    expect(await run(whitelistComponents, whitelisted)).toBeNull();

    const exemptComponents = await build({ exemptIps: [EXEMPT_IP] });
    const exempt = makeRequest({ clientHost: EXEMPT_IP, ...attack });
    expect((await run(exemptComponents, exempt))!.statusCode).toBe(400);
  });
});
