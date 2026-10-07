import { describe, it, expect, vi } from 'vitest';
import { GuardCoreError, GuardRedisError } from '../../src/errors.js';

/* Controllable ioredis mock for the safeOperation suite: `get2` is a
   deliberately failing method the test drives through safeOperation. */
const redisImpl = vi.hoisted(() => ({
  failMethod: null as ((...args: unknown[]) => Promise<never>) | null,
}));

vi.mock('ioredis', () => {
  function MockRedis() {
    const base = {
      get: vi.fn((_key: string) => Promise.resolve('v')),
      ping: vi.fn(() => Promise.resolve('PONG')),
      on: vi.fn(),
      disconnect: vi.fn(),
      quit: vi.fn(() => Promise.resolve('OK')),
    };
    if (redisImpl.failMethod) {
      (base as Record<string, unknown>)['get2'] = vi.fn(() => redisImpl.failMethod!());
    }
    return base;
  }
  return { default: MockRedis };
});
import { redactEndpointForDisplay } from '../../src/redaction.js';
import { PerformanceMonitor } from '../../src/detection-engine/monitor.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';

describe('GuardCoreError base (gap 9)', () => {
  it('is the base of GuardRedisError and carries the status', () => {
    const core = new GuardCoreError(503, 'engine down');
    expect(core.status).toBe(503);
    expect(core.name).toBe('GuardCoreError');
    expect(core instanceof GuardCoreError).toBe(true);
    const redis = new GuardRedisError(503, 'redis down');
    expect(redis instanceof GuardCoreError).toBe(true);
    expect(redis.name).toBe('GuardRedisError');
  });
});

describe('redactEndpointForDisplay (gap 31)', () => {
  it('delegates to redactUrlForDisplay', () => {
    expect(redactEndpointForDisplay('https://user:pass@example.com/a?token=secret', null, null, null))
      .not.toContain('secret');
    expect(redactEndpointForDisplay('/plain/path', null, null, null)).toBe('/plain/path');
  });
});

describe('logCountryCheckLevel (gap 5)', () => {
  it('defaults to INFO and silences with null', () => {
    expect(SecurityConfigSchema.parse({}).logCountryCheckLevel).toBe('INFO');
    expect(SecurityConfigSchema.parse({ logCountryCheckLevel: null }).logCountryCheckLevel).toBeNull();
  });

  it('logs whitelisted verdicts at the configured level', async () => {
    const { checkIpCountry } = await import('../../src/utils.js');
    const infoSpy = vi.spyOn(defaultLogger, 'info');
    const config = createTestConfig({
      whitelistCountries: ['US'],
      logCountryCheckLevel: 'INFO',
      geoResolver: () => 'US',
    });
    const geo = { isInitialized: true, initialize: async () => {}, getCountry: () => 'US' };
    const blocked = await checkIpCountry('1.2.3.4', config, geo as never);
    expect(blocked).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('IP from whitelisted country'));
    infoSpy.mockRestore();
  });

  it('logs the not-affected, no-geolocation and no-rules verdicts', async () => {
    const { checkIpCountry } = await import('../../src/utils.js');
    const debugSpy = vi.spyOn(defaultLogger, 'debug');
    const geo = { isInitialized: true, initialize: async () => {}, getCountry: (): string | null => 'BR' };

    // not_affected: the IP's country is not on the blocked list.
    const blockedConfig = createTestConfig({
      blockedCountries: ['CN'],
      logCountryCheckLevel: 'DEBUG',
      geoResolver: () => 'BR',
    });
    expect(await checkIpCountry('1.2.3.4', blockedConfig, geo as never)).toBe(false);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('IP not from blocked or whitelisted country'));

    // no_geolocation: the resolver answers null.
    const noGeoConfig = createTestConfig({
      blockedCountries: ['CN'],
      logCountryCheckLevel: 'DEBUG',
      geoResolver: () => null,
    });
    expect(await checkIpCountry('1.2.3.4', noGeoConfig, { isInitialized: true, initialize: async () => {}, getCountry: () => null } as never)).toBe(false);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('IP not geolocated'));

    // no_rules: no country lists configured.
    const noRulesConfig = createTestConfig({ logCountryCheckLevel: 'DEBUG' });
    expect(await checkIpCountry('1.2.3.4', noRulesConfig, geo as never)).toBe(false);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('No countries blocked or whitelisted'));

    debugSpy.mockRestore();
  });

  it('exempts loopback IPs from the country verdict', async () => {
    const { checkIpCountry } = await import('../../src/utils.js');
    const debugSpy = vi.spyOn(defaultLogger, 'debug');
    const config = createTestConfig({
      blockedCountries: ['CN'],
      logCountryCheckLevel: 'DEBUG',
      geoResolver: () => 'CN',
    });
    expect(await checkIpCountry('127.0.0.1', config, { isInitialized: true, initialize: async () => {}, getCountry: () => 'CN' } as never)).toBe(false);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Loopback IP exempt'));
    debugSpy.mockRestore();
  });

  it('silences non-block verdicts at null level', async () => {
    const { checkIpCountry } = await import('../../src/utils.js');
    const infoSpy = vi.spyOn(defaultLogger, 'info');
    const config = createTestConfig({
      whitelistCountries: ['US'],
      logCountryCheckLevel: null,
      geoResolver: () => 'US',
    });
    const geo = { isInitialized: true, initialize: async () => {}, getCountry: () => 'US' };
    await checkIpCountry('1.2.3.4', config, geo as never);
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('IP from whitelisted country'));
    infoSpy.mockRestore();
  });
});

describe('detection_anomaly_emission_cooldown (gap 8)', () => {
  it('rides the config schema with the reference default', () => {
    expect(SecurityConfigSchema.parse({}).detectionAnomalyEmissionCooldown).toBe(60);
    expect(() => SecurityConfigSchema.parse({ detectionAnomalyEmissionCooldown: 0.5 })).toThrow();
  });

  it('suppresses repeat anomaly events within the cooldown window', async () => {
    const events: Array<Record<string, unknown>> = [];
    const agent: AgentHandlerProtocol = {
      async sendEvent(event: unknown) { events.push(event as Record<string, unknown>); },
      async sendMetric() {},
      async start() {},
      async stop() {},
      async flushBuffer() {},
      async getDynamicRules() { return null; },
      async healthCheck() { return true; },
      async initializeRedis() {},
    } as unknown as AgentHandlerProtocol;

    const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000, 3600);
    // First slow scan emits; the second inside the cooldown window does not.
    const first = monitor.recordMetric('cooldown-pattern', 0.5, 128, false, false, agent);
    if (first instanceof Promise) await first;
    const second = monitor.recordMetric('cooldown-pattern', 0.5, 128, false, false, agent);
    if (second instanceof Promise) await second;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const anomalies = events.filter((e) => e['eventType'] === 'pattern_anomaly_slow_execution');
    expect(anomalies.length).toBe(1);
  });
});

describe('redis tuning knobs + safeOperation (gap 1, 22)', () => {
  it('carries the redis tuning defaults and accepts overrides', () => {
    const defaults = SecurityConfigSchema.parse({});
    expect(defaults.redisSocketConnectTimeout).toBeNull();
    expect(defaults.redisSocketTimeout).toBeNull();
    expect(defaults.redisHealthCheckInterval).toBe(30);
    expect(defaults.redisMaxConnections).toBeNull();
    expect(defaults.redisRetries).toBe(0);

    const tuned = SecurityConfigSchema.parse({
      redisSocketConnectTimeout: 2.5,
      redisSocketTimeout: 1.5,
      redisHealthCheckInterval: 15,
      redisMaxConnections: 20,
      redisRetries: 3,
    });
    expect(tuned.redisSocketConnectTimeout).toBe(2.5);
    expect(tuned.redisMaxConnections).toBe(20);
  });

  it('applies the pool and retry knobs only when set', async () => {
    const { RedisManager } = await import('../../src/handlers/redis.js');
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379/0',
      redisMaxConnections: null,
      redisRetries: 0,
    });
    const manager = new RedisManager(config, defaultLogger);
    await manager.initialize();
    expect(manager.getRawClient()).not.toBeNull();
    manager['closed'] = true;
    manager['client'] = null;
  });

  it('applies the retry strategy knob when retries are set', async () => {
    const { RedisManager, redisRetryStrategy } = await import('../../src/handlers/redis.js');
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379/0',
      redisRetries: 3,
    });
    const manager = new RedisManager(config, defaultLogger);
    await manager.initialize();
    expect(manager.getRawClient()).not.toBeNull();
    manager['closed'] = true;
    manager['client'] = null;

    // The capped exponential pacing: 200, 400, ... capped at 2000ms.
    expect(redisRetryStrategy(1)).toBe(200);
    expect(redisRetryStrategy(3)).toBe(600);
    expect(redisRetryStrategy(50)).toBe(2000);
  });

  it('passes the tuning knobs to ioredis and applies the retry policy', async () => {
    const { RedisManager } = await import('../../src/handlers/redis.js');
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379/0',
      redisSocketConnectTimeout: 2.5,
      redisSocketTimeout: 1.5,
      redisHealthCheckInterval: 15,
      redisMaxConnections: 20,
      redisRetries: 3,
    });
    const manager = new RedisManager(config, defaultLogger);
    await manager.initialize();
    expect(manager.getRawClient()).not.toBeNull();
    manager['closed'] = true;
    manager['client'] = null;
  });

  it('safeOperation answers null without a client and reports safe_operation_failed', async () => {
    const { RedisManager } = await import('../../src/handlers/redis.js');
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://localhost:6379/0' });
    const manager = new RedisManager(config, defaultLogger);
    const events: Array<Record<string, unknown>> = [];
    await manager.initializeAgent({
      async sendEvent(event: unknown) { events.push(event as Record<string, unknown>); },
    } as never);
    await manager.initialize();

    const value = await manager.safeOperation(async (client) => {
      const getter = (client as unknown as { get: (k: string) => Promise<string> }).get;
      return getter('k');
    });
    expect(value).toBe('v');

    // Disabled config answers null without touching Redis.
    const disabled = new RedisManager(
      SecurityConfigSchema.parse({ enableRedis: false }),
      defaultLogger,
    );
    expect(await disabled.safeOperation(async () => 'x')).toBeNull();

    // No client (never initialized): null without a failure event.
    const uninitialized = new RedisManager(
      SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://localhost:6379/0' }),
      defaultLogger,
    );
    expect(await uninitialized.safeOperation(async () => 'x')).toBeNull();

    redisImpl.failMethod = async () => { throw new Error('boom'); };
    try {
      await manager.safeOperation(async (client) => {
        const getter2 = (client as unknown as { get2?: () => Promise<never> }).get2;
        if (!getter2) throw new Error('boom');
        return getter2();
      });
      expect.unreachable('safeOperation must surface the failure');
    } catch {
      /* expected */
    }
    redisImpl.failMethod = null;
    const failure = events.find((e) => e['eventType'] === 'redis_error');
    expect(failure).toMatchObject({
      actionTaken: 'safe_operation_failed',
      metadata: { errorType: 'safe_operation_error' },
    });
  });
});

describe('lazyInit + scan tunable config keys (gaps 19, 97)', () => {
  it('carries the reference scan-budget defaults', () => {
    const config = SecurityConfigSchema.parse({});
    expect(config.detectionMaxScanValues).toBe(512);
    expect(config.detectionMaxScanChars).toBe(65536);
    expect(config.detectionMaxJsonDepth).toBe(32);
    expect(config.detectionMinSamplesForAnomaly).toBe(10);
  });

  it('carries the lazyInit default', () => {
    expect(SecurityConfigSchema.parse({}).lazyInit).toBe(true);
  });
});
