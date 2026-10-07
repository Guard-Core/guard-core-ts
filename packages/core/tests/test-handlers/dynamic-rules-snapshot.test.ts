/* The dynamic_rules_cache_path snapshot lifecycle suite: the fault-injection
   harness mirrors tests/test_dynamic_rule_persistence.py - real temp
   directories for the happy paths, injected write/read failures and
   corrupt payloads for every fallback arm. The node:fs/promises seam is
   wrapped in spies so individual tests can inject disk-full style rename
   and read failures without touching the real fs defaults. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rename as fsRename, stat as fsStat } from 'node:fs/promises';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: vi.fn(
      (...args: [string, string]) => actual.rename(...args),
    ),
    readFile: vi.fn(
      (...args: [string, ...unknown[]]) => actual.readFile(...args),
    ),
    stat: vi.fn(
      (...args: [string]) => actual.stat(...args),
    ),
  };
});

import { DynamicRuleManager,
  DYNAMIC_RULES_REDIS_NAMESPACE,
  LAST_KNOWN_RULES_KEY,
  writeLastKnownRulesFile,
} from '../../src/handlers/dynamic-rules.js';
import {
  LAST_KNOWN_RULES_SNAPSHOT_SCHEMA_VERSION,
  dumpLastKnownRulesSnapshot,
  loadLastKnownRulesSnapshot,
} from '../../src/models/dynamic-rule-snapshot.js';
import { createTestConfig } from '../helpers.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import type { DynamicRules } from '../../src/models/dynamic-rules.js';
import type { Logger } from '../../src/models/logger.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { RedisManager } from '../../src/handlers/redis.js';

function captureLogger(): Logger & {
  infos: string[]; warns: string[]; errors: string[];
} {
  const infos: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  return {
    info: (m: string) => { infos.push(m); },
    warn: (m: string) => { warns.push(m); },
    error: (m: string) => { errors.push(m); },
    debug: () => {},
    infos, warns, errors,
  };
}

function rules(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ruleId: 'test-rule',
    version: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}): string {
  return dumpLastKnownRulesSnapshot(rules(overrides));
}

function redisMock(payload: unknown) {
  return {
    getKey: vi.fn().mockResolvedValue(payload),
    setKey: vi.fn().mockResolvedValue(true),
  };
}

function agentMock(getDynamicRules: unknown) {
  return {
    getDynamicRules: vi.fn().mockResolvedValue(getDynamicRules),
    sendEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AgentHandlerProtocol;
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'guard-dynamic-rules-'));
  vi.mocked(fsRename).mockClear();
  vi.mocked(fsStat).mockClear();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('DynamicRuleManager snapshot persistence (write-on-update)', () => {
  function persistConfig(overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
    return createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key',
      ...overrides,
    });
  }

  it('persists the last-known snapshot to Redis on an accepted update', async () => {
    const logger = captureLogger();
    const config = persistConfig();
    const manager = new DynamicRuleManager(config, logger);
    const redis = redisMock(null);
    await manager.initializeRedis(redis as unknown as RedisManager);
    manager.agentHandler = agentMock(rules()) as AgentHandlerProtocol;

    await manager.updateRules();

    expect(redis.setKey).toHaveBeenCalledTimes(1);
    const [namespace, key, payload] = vi.mocked(redis.setKey).mock.calls[0];
    expect(namespace).toBe(DYNAMIC_RULES_REDIS_NAMESPACE);
    expect(key).toBe(LAST_KNOWN_RULES_KEY);
    const loaded = loadLastKnownRulesSnapshot(payload as string);
    expect(loaded.ruleId).toBe('test-rule');
    expect(loaded.version).toBe(1);
    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
    expect(logger.errors).toEqual([]);
  });

  it('persists the last-known snapshot to the cache file on an accepted update', async () => {
    const logger = captureLogger();
    const cachePath = join(tempDir, 'dynamic_rules.json');
    const config = createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key', dynamicRulesCachePath: cachePath,
    });
    const manager = new DynamicRuleManager(config, logger);
    manager.agentHandler = agentMock(rules({ version: 1 }));

    await manager.updateRules();

    const payload = await readFile(cachePath, 'utf-8');
    const loaded = loadLastKnownRulesSnapshot(payload);
    expect(loaded.ruleId).toBe('test-rule');
    expect(logger.errors).toEqual([]);
  });

  it('persists to both Redis and the cache file', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    const config = createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key', dynamicRulesCachePath: cachePath,
    });
    const manager = new DynamicRuleManager(config, captureLogger());
    const redis = redisMock(null);
    await manager.initializeRedis(redis as unknown as RedisManager);
    manager.agentHandler = agentMock(rules()) as AgentHandlerProtocol;

    await manager.updateRules();

    expect(redis.setKey).toHaveBeenCalledTimes(1);
    const filePayload = await readFile(cachePath, 'utf-8');
    expect(loadLastKnownRulesSnapshot(filePayload).ruleId).toBe('test-rule');
  });

  it('survives a Redis write failure and keeps the update applied', async () => {
    const logger = captureLogger();
    const config = persistConfig();
    const manager = new DynamicRuleManager(config, logger);
    const redis = redisMock(null);
    vi.mocked(redis.setKey).mockRejectedValue(new Error('redis down'));
    await manager.initializeRedis(redis as unknown as RedisManager);
    manager.agentHandler = agentMock(rules()) as AgentHandlerProtocol;

    await manager.updateRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
    expect(logger.errors.some((m) => m.includes('Failed to persist dynamic rules to Redis'))).toBe(true);
  });

  it('survives a cache-file write failure (missing parent directory)', async () => {
    const logger = captureLogger();
    const cachePath = join(tempDir, 'missing-dir', 'dynamic_rules.json');
    const config = createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key', dynamicRulesCachePath: cachePath,
    });
    const manager = new DynamicRuleManager(config, logger);
    manager.agentHandler = agentMock(rules()) as AgentHandlerProtocol;

    await manager.updateRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
    expect(logger.errors.some((m) =>
      m.includes('Failed to persist dynamic rules to cache file'))).toBe(true);
  });

  it('a failed atomic replace preserves the previous snapshot and leaves no temp files', async () => {
    const logger = captureLogger();
    const cachePath = join(tempDir, 'dynamic_rules.json');
    const previous = snapshot({ ruleId: 'previous', version: 1 });
    await writeFile(cachePath, previous, 'utf-8');

    vi.mocked(fsRename).mockRejectedValueOnce(new Error('disk full'));

    const config = createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key', dynamicRulesCachePath: cachePath,
    });
    const manager = new DynamicRuleManager(config, logger);
    manager.agentHandler = agentMock(rules({ ruleId: 'next' })) as AgentHandlerProtocol;

    await manager.updateRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('next');
    expect(await readFile(cachePath, 'utf-8')).toBe(previous);
    const leftovers = (await readdir(tempDir)).filter((n) => n.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    expect(logger.errors.some((m) =>
      m.includes('Failed to persist dynamic rules to cache file'))).toBe(true);
  });

  it('a snapshot build failure is logged once and never fails the update', async () => {
    const logger = captureLogger();
    const cachePath = join(tempDir, 'dynamic_rules.json');
    const config = createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key', dynamicRulesCachePath: cachePath,
    });
    const manager = new DynamicRuleManager(config, logger);
    // A payload that does not mirror the model: dumpLastKnownRulesSnapshot throws.
    await manager.persistLastKnownRules({ ruleId: 42 } as unknown as DynamicRules);

    expect(logger.errors.filter((m) =>
      m.includes('Failed to build last-known dynamic rules snapshot')).length).toBe(1);
    expect(logger.errors.every((m) => !m.includes('Failed to fetch dynamic rules'))).toBe(true);
  });
});

describe('DynamicRuleManager snapshot hydration (restart-restore)', () => {
  function hydratedConfig(overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
    return createTestConfig({
      enableDynamicRules: true, enableAgent: true, agentApiKey: 'key',
      ...overrides,
    });
  }

  it('restart with the SaaS down hydrates the last-known snapshot from Redis', async () => {
    const logger = captureLogger();
    const manager = new DynamicRuleManager(hydratedConfig(), logger);
    await manager.initializeRedis(redisMock(snapshot({ version: 1 })) as unknown as RedisManager);

    await manager.initializeAgent(agentMock(null));

    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
    expect(logger.infos.some((m) =>
      m.includes('Hydrated last-known dynamic rules test-rule v1'))).toBe(true);
    await manager.stop();
  });

  it('restart hydration also hydrates from a real Redis round trip', async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return; // the reference test needs live Redis; skipped without it
    const { RedisManager } = await import('../../src/handlers/redis.js');
    const prefix = `guard-ts-dynrules-${Math.random().toString(36).slice(2)}:`;
    const storeConfig = createTestConfig({ redisUrl, redisPrefix: prefix });
    const store = new RedisManager(storeConfig, captureLogger());
    await store.initialize();
    try {
      await store.setKey(DYNAMIC_RULES_REDIS_NAMESPACE, LAST_KNOWN_RULES_KEY, snapshot({ version: 1 }));

      const logger = captureLogger();
      const restartConfig = createTestConfig({
        redisUrl, redisPrefix: prefix, enableDynamicRules: true,
        enableAgent: true, agentApiKey: 'key',
      });
      const restarted = new DynamicRuleManager(restartConfig, logger);
      await restarted.initializeRedis(store);

      await restarted.initializeAgent(agentMock(null));

      expect(restarted.getCurrentRules()?.ruleId).toBe('test-rule');
      expect(logger.infos.some((m) => m.includes('Hydrated last-known dynamic rules'))).toBe(true);
      await restarted.stop();
    } finally {
      await store.delete(DYNAMIC_RULES_REDIS_NAMESPACE, LAST_KNOWN_RULES_KEY);
      await store.close();
    }
  });

  it('hydration falls back to the cache file when Redis is empty', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, snapshot({ version: 1 }), 'utf-8');
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, captureLogger());
    await manager.initializeRedis(redisMock(null) as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
  });

  it('hydration decodes a bytes Redis payload', async () => {
    const config = hydratedConfig();
    const manager = new DynamicRuleManager(config, captureLogger());
    const payload = new TextEncoder().encode(snapshot({ version: 1 }));
    await manager.initializeRedis(redisMock(payload) as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');
  });

  it('hydration prefers the Redis snapshot over the file', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, snapshot({ ruleId: 'file-rule', version: 1 }), 'utf-8');
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, captureLogger());
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'redis-rule', version: 2 })) as unknown as RedisManager,
    );

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('redis-rule');
    expect(manager.getCurrentRules()?.version).toBe(2);
  });

  it('hydration falls back to the file when the Redis payload is malformed', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, snapshot({ ruleId: 'file-rule' }), 'utf-8');
    const logger = captureLogger();
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, logger);
    await manager.initializeRedis(redisMock('{not json') as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('file-rule');
    expect(logger.errors.some((m) =>
      m.includes('Discarding unusable last-known dynamic rules payload'))).toBe(true);
  });

  it('hydration with unusable snapshots on both stores stays on base state', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, 'definitely not json', 'utf-8');
    const logger = captureLogger();
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, logger);
    await manager.initializeRedis(redisMock('{"schema": "unknown"}') as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.filter((m) =>
      m.includes('Discarding unusable last-known dynamic rules payload')).length).toBe(2);
  });

  it('hydration discards an expired Redis snapshot', async () => {
    const logger = captureLogger();
    const config = hydratedConfig();
    const manager = new DynamicRuleManager(config, logger);
    const expiredAt = new Date(Date.now() - 3_600_000).toISOString();
    await manager.initializeRedis(
      redisMock(snapshot({ expiresAt: expiredAt })) as unknown as RedisManager,
    );

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Discarding expired last-known dynamic rules'))).toBe(true);
  });

  it('hydration falls back to the file when the Redis snapshot is expired', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, snapshot({ ruleId: 'file-rule', version: 1 }), 'utf-8');
    const logger = captureLogger();
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, logger);
    const expiredAt = new Date(Date.now() - 3_600_000).toISOString();
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'expired-rule', version: 2, expiresAt: expiredAt })) as unknown as RedisManager,
    );

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()?.ruleId).toBe('file-rule');
    expect(logger.errors.some((m) =>
      m.includes('Discarding expired last-known dynamic rules'))).toBe(true);
  });

  it('hydration discards a corrupt cache file (undecodable bytes)', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, new Uint8Array([0xff, 0xfe, 0x20, 0x20, 0x20]));
    const logger = captureLogger();
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, logger);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Discarding unusable last-known dynamic rules payload'))).toBe(true);
  });

  it('hydration logs and continues when the cache file exists but cannot be read', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    await writeFile(cachePath, snapshot(), 'utf-8');
    vi.mocked(readFile).mockRejectedValueOnce(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }),
    );
    const logger = captureLogger();
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, logger);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Failed to read dynamic rules cache file'))).toBe(true);
  });

  it('hydration logs and continues when the cache file stat itself fails', async () => {
    const logger = captureLogger();
    const config = hydratedConfig({
      dynamicRulesCachePath: join(tempDir, 'locked.json'),
    });
    const manager = new DynamicRuleManager(config, logger);
    vi.mocked(fsStat).mockRejectedValueOnce(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }),
    );

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Failed to read dynamic rules cache file'))).toBe(true);
  });

  it('hydration survives a Redis read failure', async () => {
    const logger = captureLogger();
    const config = hydratedConfig();
    const manager = new DynamicRuleManager(config, logger);
    const redis = redisMock(null);
    vi.mocked(redis.getKey).mockRejectedValue(new Error('connection refused'));
    await manager.initializeRedis(redis as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Failed to read last-known dynamic rules from Redis'))).toBe(true);
  });

  it('hydration survives a logger that throws mid-hydration', async () => {
    const logger = captureLogger();
    logger.info = () => { throw new Error('logger kaboom'); };
    const config = hydratedConfig();
    const manager = new DynamicRuleManager(config, logger);
    await manager.initializeRedis(redisMock(snapshot()) as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(logger.errors.some((m) =>
      m.includes('Failed to hydrate last-known dynamic rules'))).toBe(true);
  });

  it('missing cache file is a silent null (no error log)', async () => {
    const logger = captureLogger();
    const config = hydratedConfig({
      dynamicRulesCachePath: join(tempDir, 'nope', 'missing.json'),
    });
    const manager = new DynamicRuleManager(config, logger);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors).toEqual([]);
  });

  it('initializeAgent without a stored snapshot keeps base state', async () => {
    const manager = new DynamicRuleManager(hydratedConfig(), captureLogger());

    await manager.initializeAgent(agentMock(null));

    expect(manager.getCurrentRules()).toBeNull();
    await manager.stop();
  });

  it('initializeAgent skips hydration when dynamic rules are disabled', async () => {
    const config = createTestConfig({ enableDynamicRules: false });
    const manager = new DynamicRuleManager(config, captureLogger());
    const spy = vi.spyOn(manager, 'hydrateLastKnownRules');

    await manager.initializeAgent(agentMock(null));

    expect(spy).not.toHaveBeenCalled();
    expect(manager.getCurrentRules()).toBeNull();
  });

  it('a second initializeAgent does not re-apply the hydrated snapshot', async () => {
    const cachePath = join(tempDir, 'dynamic_rules.json');
    const config = hydratedConfig({ dynamicRulesCachePath: cachePath });
    const manager = new DynamicRuleManager(config, captureLogger());
    await manager.initializeRedis(
      redisMock(snapshot({ version: 1 })) as unknown as RedisManager,
    );

    await manager.initializeAgent(agentMock(null));
    expect(manager.getCurrentRules()?.ruleId).toBe('test-rule');

    const hydrateSpy = vi.spyOn(manager, 'hydrateLastKnownRules');
    await manager.initializeAgent(agentMock(null));

    expect(hydrateSpy).not.toHaveBeenCalled();
    const payload = await readFile(cachePath, 'utf-8');
    expect(loadLastKnownRulesSnapshot(payload).ruleId).toBe('test-rule');
    await manager.stop();
  });

  it('hydration treats an empty bytes Redis payload as absent', async () => {
    const logger = captureLogger();
    const config = hydratedConfig();
    const manager = new DynamicRuleManager(config, logger);
    await manager.initializeRedis(redisMock(new Uint8Array(0)) as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors).toEqual([]);
  });

  it('the first successful fetch supersedes the hydrated state', async () => {
    const manager = new DynamicRuleManager(hydratedConfig(), captureLogger());
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'hydrated-rule', version: 3 })) as unknown as RedisManager,
    );
    await manager.hydrateLastKnownRules();

    manager.agentHandler = agentMock(
      rules({ ruleId: 'hydrated-rule', version: 4 }),
    ) as AgentHandlerProtocol;
    await manager.updateRules();

    expect(manager.getCurrentRules()?.version).toBe(4);
  });

  it('the hydrated state is kept when the fetch returns an older version', async () => {
    const manager = new DynamicRuleManager(hydratedConfig(), captureLogger());
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'hydrated-rule', version: 3 })) as unknown as RedisManager,
    );
    await manager.hydrateLastKnownRules();

    manager.agentHandler = agentMock(
      rules({ ruleId: 'hydrated-rule', version: 2 }),
    ) as AgentHandlerProtocol;
    await manager.updateRules();

    expect(manager.getCurrentRules()?.version).toBe(3);
  });
});

describe('DynamicRuleManager snapshot strictness (corruption handling)', () => {
  it('discards an envelope carrying unknown rule fields and never writes it back', async () => {
    const envelope = JSON.parse(snapshot()) as { rules: Record<string, unknown> };
    envelope['rules']['future_field'] = 'future';
    const logger = captureLogger();
    const config = createTestConfig();
    const manager = new DynamicRuleManager(config, logger);
    const redis = redisMock(JSON.stringify(envelope));
    await manager.initializeRedis(redis as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Discarding unusable last-known dynamic rules payload'))).toBe(true);
    expect(redis.setKey).not.toHaveBeenCalled();
  });

  it('discards an unknown snapshot schema version and never writes it back', async () => {
    const envelope = JSON.parse(snapshot()) as Record<string, unknown>;
    envelope['schema_version'] = LAST_KNOWN_RULES_SNAPSHOT_SCHEMA_VERSION + 1;
    const logger = captureLogger();
    const manager = new DynamicRuleManager(createTestConfig(), logger);
    const redis = redisMock(JSON.stringify(envelope));
    await manager.initializeRedis(redis as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Unsupported last-known dynamic rules snapshot schema version'))).toBe(true);
    expect(redis.setKey).not.toHaveBeenCalled();
  });

  it('discards a legacy bare rules payload without the envelope', async () => {
    const logger = captureLogger();
    const manager = new DynamicRuleManager(createTestConfig(), logger);
    const bare = JSON.stringify(rules());
    await manager.initializeRedis(redisMock(bare) as unknown as RedisManager);

    await manager.hydrateLastKnownRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.errors.some((m) =>
      m.includes('Discarding unusable last-known dynamic rules payload'))).toBe(true);
  });
});

describe('DynamicRuleManager expiry lifecycle', () => {
  it('a live (unexpired) active rule survives the expiry check across updates', async () => {
    const logger = captureLogger();
    const manager = new DynamicRuleManager(
      createTestConfig({ enableDynamicRules: true, enableAgent: true, agentApiKey: 'key' }), logger,
    );
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'live-rule', version: 1, expiresAt: later })) as unknown as RedisManager,
    );
    await manager.hydrateLastKnownRules();
    expect(manager.getCurrentRules()?.ruleId).toBe('live-rule');

    manager.agentHandler = agentMock(
      rules({ ruleId: 'live-rule', version: 2, expiresAt: later }),
    ) as AgentHandlerProtocol;
    await manager.updateRules();

    expect(manager.getCurrentRules()?.version).toBe(2);
    expect(logger.infos.every((m) => !m.includes('expired; restored base config'))).toBe(true);
  });

  it('a payload already expired on receipt is rejected once per (ruleId, version)', async () => {
    const logger = captureLogger();
    const manager = new DynamicRuleManager(
      createTestConfig({ enableDynamicRules: true, enableAgent: true, agentApiKey: 'key' }), logger,
    );
    const expiredAt = new Date(Date.now() - 3_600_000).toISOString();
    manager.agentHandler = agentMock(
      rules({ ruleId: 'expired-rule', version: 2, expiresAt: expiredAt }),
    ) as AgentHandlerProtocol;

    await manager.updateRules();
    await manager.updateRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.warns.filter((m) => m.includes('already expired on receipt')).length).toBe(1);
  });

  it('an active rule that expires retires before the next fetch', async () => {
    const logger = captureLogger();
    const manager = new DynamicRuleManager(
      createTestConfig({ enableDynamicRules: true, enableAgent: true, agentApiKey: 'key' }), logger,
    );
    const soon = new Date(Date.now() + 50).toISOString();
    await manager.initializeRedis(
      redisMock(snapshot({ ruleId: 'dying-rule', expiresAt: soon })) as unknown as RedisManager,
    );
    await manager.hydrateLastKnownRules();
    expect(manager.getCurrentRules()?.ruleId).toBe('dying-rule');

    await new Promise((resolve) => setTimeout(resolve, 80));
    manager.agentHandler = agentMock(null);
    await manager.updateRules();

    expect(manager.getCurrentRules()).toBeNull();
    expect(logger.infos.some((m) =>
      m.includes('expired; restored base config'))).toBe(true);
  });
});

describe('last-known snapshot envelope (models)', () => {
  it('dump emits the reference snake_case wire bytes (the redis interop corpus pin)', () => {
    const payload = dumpLastKnownRulesSnapshot(
      rules({ ruleId: 'rio-rules', version: 3, timestamp: '2026-01-01T00:00:00+00:00' }),
    );
    expect(JSON.parse(payload)).toEqual({
      schema_version: 1,
      rules: {
        rule_id: 'rio-rules',
        version: 3,
        timestamp: '2026-01-01T00:00:00Z',
        expires_at: null,
        ttl: 300,
        ip_blacklist: [],
        ip_whitelist: [],
        ip_ban_duration: 3600,
        blocked_countries: [],
        whitelist_countries: [],
        global_rate_limit: null,
        global_rate_window: null,
        endpoint_rate_limits: {},
        blocked_cloud_providers: [],
        blocked_user_agents: [],
        suspicious_patterns: [],
        enable_penetration_detection: null,
        enable_ip_banning: null,
        enable_rate_limiting: null,
        auto_ban_threshold: null,
        auto_ban_duration: null,
        enable_rate_limit_auto_ban: null,
        emergency_mode: false,
        emergency_whitelist: [],
      },
    });
  });

  it('dump drops agent-only fields and the round trip preserves the mirrored surface', () => {
    const agentRules = {
      ruleId: 'agent-rule',
      version: 3,
      timestamp: '2026-01-01T00:00:00.000Z',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      emergencyWhitelistOnly: true,
      message: 'maintenance',
      ipBlacklist: ['1.2.3.4'],
      emergencyMode: false,
    };
    const payload = dumpLastKnownRulesSnapshot(agentRules);
    const envelope = JSON.parse(payload) as { rules: Record<string, unknown> };
    expect('emergencyWhitelistOnly' in envelope['rules']).toBe(false);
    expect('message' in envelope['rules']).toBe(false);

    const loaded = loadLastKnownRulesSnapshot(payload);
    expect(loaded.ruleId).toBe('agent-rule');
    expect(loaded.version).toBe(3);
    expect(loaded.ipBlacklist).toEqual(['1.2.3.4']);
    expect(loaded.emergencyMode).toBe(false);
  });

  it('dump serializes a Set of cloud providers and load restores it', () => {
    const payload = dumpLastKnownRulesSnapshot(
      rules({ blockedCloudProviders: new Set(['AWS']) }),
    );
    const loaded = loadLastKnownRulesSnapshot(payload);
    expect(loaded.blockedCloudProviders).toBeInstanceOf(Set);
    expect(loaded.blockedCloudProviders.has('AWS')).toBe(true);
  });

  it('load rejects a non-object payload', () => {
    expect(() => loadLastKnownRulesSnapshot('42')).toThrow();
    expect(() => loadLastKnownRulesSnapshot('[]')).toThrow();
  });

  it('dump rejects a non-integer version', () => {
    expect(() => dumpLastKnownRulesSnapshot(rules({ version: 'two' }))).toThrow(TypeError);
  });

  it('dump rejects an unparseable timestamp', () => {
    expect(() => dumpLastKnownRulesSnapshot(rules({ timestamp: 'not-a-date' }))).toThrow(TypeError);
    expect(() => dumpLastKnownRulesSnapshot(rules({ timestamp: undefined }))).toThrow(TypeError);
  });

  it('dump rejects an unparseable expiresAt', () => {
    expect(() => dumpLastKnownRulesSnapshot(rules({ expiresAt: 'someday' }))).toThrow(TypeError);
  });

  it('dump rejects a malformed list field', () => {
    expect(() => dumpLastKnownRulesSnapshot(rules({ ipBlacklist: '1.2.3.4' }))).toThrow();
  });
});

describe('writeLastKnownRulesFile (atomic write helper)', () => {
  it('writes the payload atomically and round-trips', async () => {
    const cachePath = join(tempDir, 'rules.json');
    await writeLastKnownRulesFile(cachePath, snapshot());
    expect(loadLastKnownRulesSnapshot(await readFile(cachePath, 'utf-8')).ruleId)
      .toBe('test-rule');
  });

  it('cleans the temp file and rethrows when the write itself fails', async () => {
    const cachePath = join(tempDir, 'missing-dir', 'rules.json');
    await expect(writeLastKnownRulesFile(cachePath, snapshot())).rejects.toThrow();
    const leftovers = (await readdir(tempDir)).filter((n) => n.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });
});

describe('dynamicRulesCachePath config validation', () => {
  it('defaults to null, disabling the file fallback', () => {
    expect(createTestConfig().dynamicRulesCachePath).toBeNull();
  });

  it('accepts a filesystem path string', () => {
    const parsed = createTestConfig({ dynamicRulesCachePath: '/var/lib/guard/rules.json' });
    expect(parsed.dynamicRulesCachePath).toBe('/var/lib/guard/rules.json');
  });

  it('rejects empty and blank values', () => {
    expect(() => createTestConfig({ dynamicRulesCachePath: '' })).toThrow();
    expect(() => createTestConfig({ dynamicRulesCachePath: '   ' })).toThrow();
    expect(() => createTestConfig({ dynamicRulesCachePath: '\t' })).toThrow();
  });

  it('rejects non-string values', () => {
    expect(() => createTestConfig({ dynamicRulesCachePath: 123 })).toThrow();
  });
});
