import { describe, it, expect, vi } from 'vitest';
import { GuardCoreError, GuardRedisError } from '../../src/errors.js';
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
