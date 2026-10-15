import { describe, it, expect, vi } from 'vitest';

import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { DynamicRulesSchema } from '../../src/models/dynamic-rules.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig } from '../helpers.js';

function rules(version: number, extra: Record<string, unknown> = {}, ruleId = 'r1') {
  return DynamicRulesSchema.parse({
    ruleId,
    version,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

interface ManagerInternals {
  applyRules(r: unknown): Promise<void>;
  currentRules: unknown;
  activeBaseSnapshot: Record<string, unknown> | null;
  checkRuleExpiry(): void;
  applyFeatureToggles(r: unknown): void;
}

function build(configOverrides: Record<string, unknown> = {}, targets = {}) {
  const config = createTestConfig(configOverrides);
  const manager = new DynamicRuleManager(config, defaultLogger, targets);
  return { config, manager, internals: manager as unknown as ManagerInternals };
}

async function apply(internals: ManagerInternals, r: ReturnType<typeof rules>) {
  await internals.applyRules(r);
  internals.currentRules = r;
}

describe('each dynamic rule version overlays the base config', () => {
  it('emergency halving does not compound across versions', async () => {
    const { config, internals } = build({ autoBanThreshold: 16 });
    const seen: number[] = [];
    for (const version of [1, 2, 3]) {
      await apply(internals, rules(version, { emergencyMode: true, emergencyWhitelist: [] }));
      seen.push(config.autoBanThreshold);
    }
    expect(seen).toEqual([8, 8, 8]);
    expect(internals.activeBaseSnapshot?.['autoBanThreshold']).toBe(16);
  });

  it('collection values do not accumulate across versions', async () => {
    const { config, internals } = build({
      geoIpHandler: { isInitialized: true },
      blockedUserAgents: ['base-bot'],
      blockCloudProviders: ['AWS'],
    });
    await apply(internals, rules(1, {
      blockedUserAgents: ['bot-a'],
      blockedCloudProviders: ['GCP'],
      blockedCountries: ['AA'],
      endpointRateLimits: { '/a': [1, 60] },
    }));
    await apply(internals, rules(2, {
      blockedUserAgents: ['bot-b'],
      blockedCloudProviders: ['Azure'],
      blockedCountries: ['BB'],
      endpointRateLimits: { '/b': [2, 60] },
    }));
    expect(config.blockedUserAgents).toEqual(['bot-b']);
    expect(config.blockCloudProviders).toEqual(new Set(['Azure']));
    expect(config.blockedCountries).toEqual(['BB']);
    expect(config.endpointRateLimits).toEqual({ '/b': [2, 60] });
  });

  it('a new version drops the change from the previous version', async () => {
    const { config, internals } = build({
      rateLimit: 100, enableIpBanning: true, autoBanThreshold: 5,
    });
    await apply(internals, rules(1, { globalRateLimit: 7, enableIpBanning: false, autoBanThreshold: 2 }));
    expect([config.rateLimit, config.enableIpBanning]).toEqual([7, false]);

    await apply(internals, rules(2, { globalRateLimit: 9 }));

    expect(config.rateLimit).toBe(9);
    expect(config.enableIpBanning).toBe(true);
    expect(config.autoBanThreshold).toBe(5);
  });

  it('a different rule id overlays the base', async () => {
    const { config, internals } = build({ rateLimit: 100, autoBanThreshold: 16 });
    await apply(internals, rules(1, { emergencyMode: true, emergencyWhitelist: [] }, 'r1'));
    await apply(internals, rules(1, { globalRateLimit: 3 }, 'r2'));

    expect(config.rateLimit).toBe(3);
    expect(config.autoBanThreshold).toBe(16);
    expect(config.emergencyMode).toBe(false);
  });

  it('a failed apply rolls back to the active version', async () => {
    const { config, internals } = build({ rateLimit: 100, autoBanThreshold: 16 });
    await apply(internals, rules(1, { globalRateLimit: 7, autoBanThreshold: 4 }));

    internals.applyFeatureToggles = () => { throw new Error('boom'); };
    await expect(internals.applyRules(rules(2, { globalRateLimit: 9 }))).rejects.toThrow('boom');

    expect(config.rateLimit).toBe(7);
    expect(config.autoBanThreshold).toBe(4);
    expect(internals.activeBaseSnapshot?.['rateLimit']).toBe(100);
  });

  it('expiry restores the true base after several versions', async () => {
    const { config, internals } = build({ autoBanThreshold: 16 });
    await apply(internals, rules(1, { emergencyMode: true, emergencyWhitelist: [] }));
    await apply(internals, rules(2, {
      emergencyMode: true,
      emergencyWhitelist: [],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }));
    expect(config.autoBanThreshold).toBe(8);

    internals.checkRuleExpiry();

    expect(config.autoBanThreshold).toBe(16);
    expect(config.emergencyMode).toBe(false);
    expect(internals.currentRules).toBeNull();
    expect(internals.activeBaseSnapshot).toBeNull();
  });

  it('a new version after boot hydration overlays the base', async () => {
    const { config, manager, internals } = build({
      enableDynamicRules: true,
      enableAgent: true,
      agentApiKey: 'test-key-123456',
      autoBanThreshold: 16,
    });
    const hydrated = rules(1, { emergencyMode: true, emergencyWhitelist: [] });
    vi.spyOn(manager as unknown as { loadLastKnownRules(): Promise<unknown> }, 'loadLastKnownRules')
      .mockResolvedValue(hydrated);
    const agent = {
      getDynamicRules: vi.fn().mockResolvedValue(
        {
          ruleId: 'r1',
          version: 2,
          timestamp: new Date().toISOString(),
          emergencyMode: true,
          emergencyWhitelist: [],
        },
      ),
      sendEvent: vi.fn(),
    };
    await manager.initializeAgent(agent as never);
    expect(config.autoBanThreshold).toBe(8);

    await manager.updateRules();

    expect(manager.getCurrentRules()?.version).toBe(2);
    expect(config.autoBanThreshold).toBe(8);
    expect(internals.activeBaseSnapshot?.['autoBanThreshold']).toBe(16);
    await manager.stop();
  });

  it('suspicious patterns are not added again by later versions', async () => {
    const config = createTestConfig();
    const sus = new SusPatternsManager(config, defaultLogger);
    const { internals } = build({}, { susPatternsManager: sus });
    const add = vi.spyOn(sus, 'addPattern');
    const pattern = 'overlay-unique-marker-[0-9]{3}';
    for (const version of [1, 2, 3]) {
      await apply(internals, rules(version, { suspiciousPatterns: [pattern] }));
    }
    expect(add).toHaveBeenCalledTimes(1);
    expect(sus.getCustomPatterns().filter((p) => p === pattern)).toHaveLength(1);
  });
});
