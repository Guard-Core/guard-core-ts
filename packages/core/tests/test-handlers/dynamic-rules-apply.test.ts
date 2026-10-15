import { describe, it, expect, vi, afterEach } from 'vitest';

import { HandlerInitializer } from '../../src/core/initialization/handler-initializer.js';
import type { HandlerRegistry } from '../../src/core/initialization/handler-initializer.js';
import { EmergencyModeCheck } from '../../src/core/checks/implementations/emergency-mode.js';
import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockMiddleware, createMockRequest, createTestConfig } from '../helpers.js';

const BASE_RULE = { ruleId: 'r1', version: 1, timestamp: '2024-01-01T00:00:00Z' };

async function setup(rule: Record<string, unknown>, configOverrides: Record<string, unknown> = {}) {
  const config = createTestConfig({
    enableDynamicRules: true,
    enableAgent: true,
    agentApiKey: 'test-key-123456',
    enableRedis: false,
    ...configOverrides,
  });
  const agent = {
    start: vi.fn(),
    stop: vi.fn(),
    initializeRedis: vi.fn(),
    sendEvent: vi.fn(),
    sendMetric: vi.fn(),
    flushBuffer: vi.fn(),
    getDynamicRules: vi.fn().mockResolvedValue({ ...BASE_RULE, ...rule }),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
  const registry = await new HandlerInitializer(config, defaultLogger, agent as never).initialize();
  return { config, registry, agent };
}

let current: HandlerRegistry | null = null;
afterEach(async () => {
  await current?.dynamicRuleHandler.stop();
  current = null;
});

async function applyRule(rule: Record<string, unknown>, configOverrides: Record<string, unknown> = {}) {
  const ctx = await setup(rule, configOverrides);
  current = ctx.registry;
  await ctx.registry.dynamicRuleHandler.updateRules();
  return ctx;
}

describe('a received dynamic rule changes request handling', () => {
  it('ip_blacklist bans the listed IPs for ip_ban_duration', async () => {
    const { registry } = await applyRule({ ipBlacklist: ['9.9.9.9'], ipBanDuration: 120 });
    expect(await registry.ipBanHandler.isIpBanned('9.9.9.9')).toBe(true);
    expect(await registry.ipBanHandler.isIpBanned('8.8.8.8')).toBe(false);
  });

  it('ip_whitelist unbans previously banned IPs', async () => {
    const ctx = await setup({ ipWhitelist: ['7.7.7.7'] });
    current = ctx.registry;
    await ctx.registry.ipBanHandler.banIp('7.7.7.7', 600, 'test');
    await ctx.registry.dynamicRuleHandler.updateRules();
    expect(await ctx.registry.ipBanHandler.isIpBanned('7.7.7.7')).toBe(false);
  });

  it('emergency_mode locks the service down for non-whitelisted IPs', async () => {
    const { config } = await applyRule({ emergencyMode: true, emergencyWhitelist: ['10.0.0.1'] });
    expect(config.emergencyMode).toBe(true);
    expect(config.emergencyWhitelist).toEqual(['10.0.0.1']);

    const middleware = createMockMiddleware();
    (middleware as { config: unknown }).config = config;
    const check = new EmergencyModeCheck(middleware);
    expect((await check.check(createMockRequest({ clientHost: '1.2.3.4' })))?.statusCode).toBe(503);
    expect(await check.check(createMockRequest({ clientHost: '10.0.0.1' }))).toBeNull();
  });

  it('rate limits replace the live global and endpoint limits', async () => {
    const { config } = await applyRule({
      globalRateLimit: 3,
      globalRateWindow: 30,
      endpointRateLimits: { '/api/login': [2, 10] },
    });
    expect(config.rateLimit).toBe(3);
    expect(config.rateLimitWindow).toBe(30);
    expect(config.endpointRateLimits).toEqual({ '/api/login': [2, 10] });
  });
});

describe('rule application surfaces', () => {
  it('replaces country lists uppercased when a geo resolver exists', async () => {
    const { config } = await applyRule(
      { blockedCountries: ['cn'], whitelistCountries: ['us'] },
      { ipinfoToken: 'tok' },
    );
    expect(config.blockedCountries).toEqual(['CN']);
    expect(config.whitelistCountries).toEqual(['US']);
  });

  it('skips country rules with a warning when nothing can resolve countries', async () => {
    const { config } = await applyRule({ blockedCountries: ['CN'] });
    expect(config.blockedCountries).toEqual([]);
  });

  it('replaces the cloud provider set', async () => {
    const { config } = await applyRule({ blockedCloudProviders: ['AWS', 'GCP'] });
    expect(config.blockCloudProviders).toEqual(new Set(['AWS', 'GCP']));
  });

  it('keeps only ReDoS-safe blocked user agents', async () => {
    const { config } = await applyRule({ blockedUserAgents: ['BadBot', '(a+)+$', '['] });
    expect(config.blockedUserAgents).toEqual(['BadBot']);
  });

  it('adds safe suspicious patterns and rejects unsafe ones', async () => {
    const { registry } = await applyRule({ suspiciousPatterns: ['evil-marker-\\d+', '(a+)+$'] });
    expect(registry.susPatternsHandler.getCustomPatterns()).toEqual(['evil-marker-\\d+']);
  });

  it('applies the feature toggles and auto-ban overrides', async () => {
    const { config } = await applyRule({
      enablePenetrationDetection: false,
      enableIpBanning: false,
      enableRateLimiting: false,
      enableRateLimitAutoBan: true,
      autoBanThreshold: 7,
      autoBanDuration: 99,
    });
    expect(config).toMatchObject({
      enablePenetrationDetection: false,
      enableIpBanning: false,
      enableRateLimiting: false,
      enableRateLimitAutoBan: true,
      autoBanThreshold: 7,
      autoBanDuration: 99,
    });
  });

  it('emergency mode halves the auto-ban threshold, never below 1', async () => {
    const { config } = await applyRule({ emergencyMode: true }, { autoBanThreshold: 1 });
    expect(config.autoBanThreshold).toBe(1);
    const second = await applyRule({ emergencyMode: true });
    expect(second.config.autoBanThreshold).toBe(5);
  });

  it('leaves the config untouched for a rule that sets nothing', async () => {
    const { config } = await applyRule({});
    expect(config.rateLimit).toBe(10);
    expect(config.emergencyMode).toBe(false);
  });

  it('logs and continues when a ban fails or no ban manager is attached', async () => {
    const failing = { banIp: async () => { throw new Error('store down'); }, unbanIp: async () => { throw new Error('store down'); } };
    const agent = { getDynamicRules: async () => ({ ...BASE_RULE, ipBlacklist: ['1.1.1.1'], ipWhitelist: ['2.2.2.2'], enableIpBanning: false }), sendEvent: vi.fn() };
    for (const targets of [{ ipBanManager: failing as never }, {}]) {
      const fresh = createTestConfig({ enableRedis: false });
      const manager = new DynamicRuleManager(fresh, defaultLogger, targets);
      await manager.initializeAgent(agent as never);
      await manager.updateRules();
      expect(fresh.enableIpBanning).toBe(false);
      expect(manager.getCurrentRules()).not.toBeNull();
    }
  });

  it('rejects patterns when no patterns manager is attached', async () => {
    const config = createTestConfig({ enableRedis: false });
    const manager = new DynamicRuleManager(config, defaultLogger);
    await manager.initializeAgent({ getDynamicRules: async () => ({ ...BASE_RULE, suspiciousPatterns: ['x'] }), sendEvent: vi.fn() } as never);
    await manager.updateRules();
    expect(manager.getCurrentRules()).not.toBeNull();
  });
});

describe('rule lifecycle on the live config', () => {
  it('a failed apply restores the snapshot and does not record the rule', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 10 });
    const sus = { addPattern: async () => { throw new Error('boom'); } };
    const manager = new DynamicRuleManager(config, defaultLogger, { susPatternsManager: sus as never });
    await manager.initializeAgent({
      getDynamicRules: async () => ({ ...BASE_RULE, globalRateLimit: 3, suspiciousPatterns: ['x'] }),
      sendEvent: vi.fn(),
    } as never);
    await manager.updateRules();
    expect(config.rateLimit).toBe(10);
    expect(manager.getCurrentRules()).toBeNull();
  });

  it('expiry restores the pre-rule config, across consecutive rules', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 10 });
    const future = new Date(Date.now() + 60_000).toISOString();
    const rules = [
      { ...BASE_RULE, version: 1, globalRateLimit: 3, expiresAt: future },
      { ...BASE_RULE, version: 2, globalRateLimit: 2, expiresAt: future },
    ];
    const agent = { getDynamicRules: vi.fn(), sendEvent: vi.fn() };
    const manager = new DynamicRuleManager(config, defaultLogger);
    await manager.initializeAgent(agent as never);
    agent.getDynamicRules.mockResolvedValueOnce(rules[0]);
    await manager.updateRules();
    agent.getDynamicRules.mockResolvedValueOnce(rules[1]);
    await manager.updateRules();
    expect(config.rateLimit).toBe(2);

    vi.useFakeTimers({ now: Date.now() + 120_000, toFake: ['Date'] });
    try {
      agent.getDynamicRules.mockResolvedValueOnce(null);
      await manager.updateRules();
    } finally {
      vi.useRealTimers();
    }
    expect(config.rateLimit).toBe(10);
    expect(manager.getCurrentRules()).toBeNull();
  });

  it('boot hydration applies the last-known rules to the config', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 10, enableDynamicRules: true, enableAgent: true, agentApiKey: 'test-key-123456' });
    const seed = new DynamicRuleManager(config, defaultLogger);
    const store: { payload?: string } = {};
    const redis = {
      getKey: async () => store.payload ?? null,
      setKey: async (_ns: string, _k: string, v: string) => { store.payload = v; },
    };
    await seed.initializeRedis(redis as never);
    await seed.persistLastKnownRules({
      ...BASE_RULE, ttl: 300, expiresAt: null, ipBlacklist: [], ipWhitelist: [], ipBanDuration: 3600,
      blockedCountries: [], whitelistCountries: [], globalRateLimit: 4, globalRateWindow: null,
      endpointRateLimits: {}, blockedCloudProviders: new Set<string>(), blockedUserAgents: [], suspiciousPatterns: [],
      enablePenetrationDetection: null, enableIpBanning: null, enableRateLimiting: null,
      autoBanThreshold: 3, autoBanDuration: null, enableRateLimitAutoBan: null, emergencyMode: false, emergencyWhitelist: [],
    } as never);

    const live = createTestConfig({ enableRedis: false, rateLimit: 10, enableDynamicRules: true, enableAgent: true, agentApiKey: 'test-key-123456' });
    const manager = new DynamicRuleManager(live, defaultLogger);
    await manager.initializeRedis(redis as never);
    await manager.initializeAgent({ getDynamicRules: async () => null, sendEvent: vi.fn() } as never);
    await manager.stop();
    expect(live.rateLimit).toBe(4);
    expect(live.autoBanThreshold).toBe(3);
  });
});
