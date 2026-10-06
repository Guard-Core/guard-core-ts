import { describe, it, expect } from 'vitest';
import { guardWebSocketUpgrade,
  WS_CLOSE_CLIENT_ADDRESS_UNKNOWN,
  WS_CLOSE_IP_BANNED,
  WS_CLOSE_IP_NOT_ALLOWED,
  WS_CLOSE_RATE_LIMIT_EXCEEDED,
  WS_CLOSE_SECURITY_CHECK_FAILED,
  WS_CLOSE_SUSPICIOUS_ACTIVITY,
} from '../../src/core/websocket-guard.js';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockRequest, createMockResponseFactory } from '../helpers.js';
import { GuardRedisError } from '../../src/errors.js';
import type { SecurityMiddlewareComponents } from '../../src/index.js';
import type { GuardRequest } from '../../src/index.js';

async function buildComponents(configOverrides: Record<string, unknown> = {}): Promise<SecurityMiddlewareComponents> {
  const config = SecurityConfigSchema.parse({ enableRedis: false, ...configOverrides });
  return initializeSecurityMiddleware(config, defaultLogger, createMockResponseFactory());
}

function wsRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
  return createMockRequest({
    urlPath: '/ws',
    method: 'WEBSOCKET',
    clientHost: '8.8.4.4',
    headers: { 'user-agent': 'WS-Client/1.0' },
    queryParams: {},
    ...overrides,
  });
}

describe('guardWebSocketUpgrade', () => {
  it('allows a clean upgrade and records the client identity on the state', async () => {
    const components = await buildComponents();
    const request = wsRequest();
    const verdict = await guardWebSocketUpgrade(request, components);
    expect(verdict).toEqual({ allowed: true, clientIp: '8.8.4.4' });
    expect(request.state['clientIp']).toBe('8.8.4.4');
    expect(request.state.isWhitelisted).toBe(false);
  });

  it('rejects an unknown client identity in fail-secure mode (close 1008)', async () => {
    const components = await buildComponents();
    const verdict = await guardWebSocketUpgrade(wsRequest({ clientHost: null }), components);
    expect(verdict).toMatchObject({
      allowed: false,
      close: WS_CLOSE_CLIENT_ADDRESS_UNKNOWN,
      httpStatus: 403,
    });
  });

  it('falls through to the allow check for an unknown identity when failSecure is off', async () => {
    const components = await buildComponents({ failSecure: false });
    const verdict = await guardWebSocketUpgrade(wsRequest({ clientHost: null }), components);
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_IP_NOT_ALLOWED });
  });

  it('rejects a banned IP (close 1008)', async () => {
    const components = await buildComponents();
    await components.registry.ipBanHandler.banIp('8.8.4.4', 3600, 'test');
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_IP_BANNED });
  });

  it('rejects a blacklisted IP (close 1008)', async () => {
    const components = await buildComponents({ blacklist: ['8.8.4.4'] });
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_IP_NOT_ALLOWED });
  });

  it('rejects when the rate limit on the ws endpoint trips (close 1008)', async () => {
    const components = await buildComponents({ rateLimit: 2, rateLimitWindow: 60 });
    expect(await guardWebSocketUpgrade(wsRequest(), components)).toMatchObject({ allowed: true });
    expect(await guardWebSocketUpgrade(wsRequest(), components)).toMatchObject({ allowed: true });
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_RATE_LIMIT_EXCEEDED });
  });

  it('skips the rate limit for whitelisted clients and marks the state', async () => {
    const components = await buildComponents({ whitelist: ['8.8.4.4'], rateLimit: 1, rateLimitWindow: 60 });
    const first = await guardWebSocketUpgrade(wsRequest(), components);
    expect(first).toMatchObject({ allowed: true });
    expect(first.allowed && first.clientIp).toBe('8.8.4.4');
    /* Second request would trip the 1 req/60s limit for non-whitelisted. */
    const second = await guardWebSocketUpgrade(wsRequest(), components);
    expect(second).toMatchObject({ allowed: true });
  });

  it('rejects an attack payload with close 1008 (suspicious activity)', async () => {
    const components = await buildComponents();
    const verdict = await guardWebSocketUpgrade(
      wsRequest({ queryParams: { q: "' OR '1'='1" } }),
      components,
    );
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_SUSPICIOUS_ACTIVITY });
  });

  it('maps a failing detection check to close 1013 via the fail-secure 500 sentinel', async () => {
    const components = await buildComponents();
    /* A resolver failure makes the suspicious-activity check throw; the
       pipeline's fail-secure handling answers 500, which the WS guard maps
       to "Security check failed" (close 1013), not "suspicious". */
    components.routeResolver.shouldBypassCheck = () => {
      throw new Error('resolver down');
    };
    const verdict = await guardWebSocketUpgrade(
      wsRequest({ queryParams: { q: "' OR '1'='1" } }),
      components,
    );
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_SECURITY_CHECK_FAILED });
  });

  it('fails open on detection check errors when failSecure is off', async () => {
    const components = await buildComponents({ failSecure: false });
    components.routeResolver.shouldBypassCheck = () => {
      throw new Error('resolver down');
    };
    const verdict = await guardWebSocketUpgrade(
      wsRequest({ queryParams: { q: "' OR '1'='1" } }),
      components,
    );
    expect(verdict).toMatchObject({ allowed: true });
  });

  it('skips detection entirely when penetration detection is disabled', async () => {
    const components = await buildComponents({ enablePenetrationDetection: false });
    const verdict = await guardWebSocketUpgrade(
      wsRequest({ queryParams: { q: "' OR '1'='1" } }),
      components,
    );
    expect(verdict).toMatchObject({ allowed: true });
  });

  it('skips detection for excluded paths and marks the state', async () => {
    const components = await buildComponents({ excludePaths: ['/ws'] });
    const request = wsRequest({ urlPath: '/ws/data', queryParams: { q: "' OR '1'='1" } });
    const verdict = await guardWebSocketUpgrade(request, components);
    expect(verdict).toMatchObject({ allowed: true });
    expect(request.state['guardExclusionScoped']).toBe(true);
  });

  it('honors redisFailOpen on a redis failure in the ban check', async () => {
    const components = await buildComponents({ redisFailOpen: true });
    components.registry.ipBanHandler.isIpBanned = async () => {
      throw new GuardRedisError('redis down');
    };
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: true });
  });

  it('rejects with close 1013 on a redis failure in fail-secure mode', async () => {
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const components = await initializeSecurityMiddleware(config, logger, createMockResponseFactory());
    components.registry.ipBanHandler.isIpBanned = async () => {
      throw new GuardRedisError('redis down');
    };
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: false, close: WS_CLOSE_SECURITY_CHECK_FAILED });
    expect(warns.some((m) => m.includes('fail-secure mode'))).toBe(true);
  });

  it('treats non-redis ban-check failures as not banned outside fail-secure', async () => {
    const errors: string[] = [];
    const logger = { ...defaultLogger, error: (m: string) => errors.push(m) };
    const config = SecurityConfigSchema.parse({ enableRedis: false, failSecure: false });
    const components = await initializeSecurityMiddleware(config, logger, createMockResponseFactory());
    components.registry.ipBanHandler.isIpBanned = async () => {
      throw new Error('not a redis error');
    };
    const verdict = await guardWebSocketUpgrade(wsRequest(), components);
    expect(verdict).toMatchObject({ allowed: true });
    expect(errors.some((m) => m.includes('Error in ip ban check'))).toBe(true);
  });
});
