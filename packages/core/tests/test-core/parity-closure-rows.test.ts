/* The parity-closure rows suite: the ban-list migration (matrix gap 24),
   the route-config revision surface (gap 29) and the standalone
   checkIpAccess verdict (gap 30). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RedisManager } from '../../src/handlers/redis.js';
import { IPBanManager, canonicalizeIp } from '../../src/handlers/ip-ban.js';
import { checkIpAccess } from '../../src/core/checks/ip-access.js';
import { BaseSecurityDecorator } from '../../src/decorators/base.js';
import { checkRateLimitByIp } from '../../src/handlers/rate-limit-by-ip.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { Logger } from '../../src/models/logger.js';
import type { RedisClient } from '../../src/handlers/redis.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'guard-parity-closure-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('canonicalizeIp (the _canonicalize_ip twin)', () => {
  it('compresses and lowercases IPv6 text', () => {
    expect(canonicalizeIp('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });

  it('maps an IPv4-mapped IPv6 to its IPv4 text', () => {
    expect(canonicalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
  });

  it('strips brackets', () => {
    expect(canonicalizeIp('[2001:db8::1]')).toBe('2001:db8::1');
  });

  it('leaves canonical and unparseable input unchanged', () => {
    expect(canonicalizeIp('10.0.0.1')).toBe('10.0.0.1');
    expect(canonicalizeIp('not-an-ip')).toBe('not-an-ip');
  });
});

describe('legacy ban-key migration (the _ipban_migration twin, matrix gap 24)', () => {
  function fakeRedisClient() {
    const store = new Map<string, { value: string; pttl: number }>();
    const client = {
      async keys(pattern: string) {
        const bare = pattern.slice(0, -1); // strip the trailing '*'
        return [...store.keys()].filter((k) => k.startsWith(bare));
      },
      async get(key: string) {
        return store.get(key)?.value ?? null;
      },
      async pttl(key: string) {
        return store.get(key)?.pttl ?? -2;
      },
      async set(key: string, value: string, ...rest: unknown[]) {
        const px = rest[0] === 'PX' ? Number(rest[1]) : -1;
        store.set(key, { value, pttl: px });
        return 'OK';
      },
      async del(key: string) {
        return store.delete(key) ? 1 : 0;
      },
    };
    return { client: client as unknown as RedisClient, store };
  }

  function managerWithRedis(client: RedisClient): { manager: IPBanManager; handler: RedisManager } {
    const handler = {
      getRawClient: () => client,
      prefix: 'guard:test:',
    } as unknown as RedisManager;
    const manager = new IPBanManager(defaultLogger);
    return { manager, handler };
  }

  it('migrates a non-canonical legacy key to the canonical ip with the same ttl', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:2001:0DB8:0:0:0:0:0:1', { value: '1791399999.0', pttl: 555_000 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.has('guard:test:banned_ips:2001:db8::1')).toBe(true);
    expect(store.get('guard:test:banned_ips:2001:db8::1')!.pttl).toBe(555_000);
    expect(store.has('guard:test:banned_ips:2001:0DB8:0:0:0:0:0:1')).toBe(false);
  });

  it('deletes an expired legacy key instead of migrating it', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:2001:0DB8::1', { value: 'x', pttl: -1 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.size).toBe(0);
  });

  it('keeps the longer ttl when a canonical key already exists', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:::FFFF:10.0.0.9', { value: 'legacy', pttl: 900_000 });
    store.set('guard:test:banned_ips:10.0.0.9', { value: 'canonical', pttl: 100_000 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.get('guard:test:banned_ips:10.0.0.9')!.value).toBe('legacy');
    expect(store.get('guard:test:banned_ips:10.0.0.9')!.pttl).toBe(900_000);
    expect(store.size).toBe(1);
  });

  it('a legacy key with no value still migrates (empty payload written)', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:2001:0DB8::7', { value: null as unknown as string, pttl: 42_000 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.get('guard:test:banned_ips:2001:db8::7')!.value).toBe('');
    expect(store.has('guard:test:banned_ips:2001:0DB8::7')).toBe(false);
  });

  it('keeps the canonical ttl when it is already longer and still deletes the legacy key', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:2001:0DB8::8', { value: 'legacy', pttl: 5_000 });
    store.set('guard:test:banned_ips:2001:db8::8', { value: 'canonical', pttl: 60_000 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.get('guard:test:banned_ips:2001:db8::8')!.value).toBe('canonical');
    expect(store.get('guard:test:banned_ips:2001:db8::8')!.pttl).toBe(60_000);
    expect(store.size).toBe(1);
  });

  it('isIpBanned answers false when the redis key is absent', async () => {
    const handler = {
      getRawClient: () => null,
      prefix: 'guard:null:',
      getKey: async () => null,
    } as unknown as RedisManager;
    const manager = new IPBanManager(defaultLogger);
    await manager.initializeRedis(handler);
    expect(await manager.isIpBanned('203.0.113.77')).toBe(false);
  });

  it('a handler without a raw client skips the scan silently', async () => {
    const handler = {
      getRawClient: () => null,
      prefix: 'guard:null:',
    } as unknown as RedisManager;
    const manager = new IPBanManager(defaultLogger);
    await manager.initializeRedis(handler);
  });

  it('leaves already-canonical keys untouched and survives scan failures', async () => {
    const { client, store } = fakeRedisClient();
    store.set('guard:test:banned_ips:10.0.0.5', { value: 'v', pttl: 1000 });

    const { manager, handler } = managerWithRedis(client);
    await manager.initializeRedis(handler);

    expect(store.get('guard:test:banned_ips:10.0.0.5')).toEqual({ value: 'v', pttl: 1000 });

    const broken = {
      getRawClient: () => { throw new Error('boom'); },
      prefix: 'guard:broken:',
    } as unknown as RedisManager;
    const warn: string[] = [];
    const logger: Logger = {
      ...defaultLogger,
      warn: (m: string) => { warn.push(m); },
    };
    const breaking = new IPBanManager(logger);
    await breaking.initializeRedis(broken);
    expect(warn.some((m) => m.includes('Legacy ban-key migration skipped'))).toBe(true);
  });
});

describe('routeConfigRevision surface (the route_config_revision twin, matrix gap 29)', () => {
  it('starts at zero and bumps on every new route config', () => {
    const decorator = new BaseSecurityDecorator(SecurityConfigSchema.parse({}));
    expect(decorator.routeConfigRevision).toBe(0);

    const fn = function handler(): void {};
    decorator.ensureRouteConfig(fn);
    expect(decorator.routeConfigRevision).toBe(1);

    // Re-entering an existing config does not bump.
    decorator.ensureRouteConfig(fn);
    expect(decorator.routeConfigRevision).toBe(1);

    decorator.ensureRouteConfig(function another(): void {});
    expect(decorator.routeConfigRevision).toBe(2);
  });

  it('stays per-instance (two decorators do not share a counter)', () => {
    const a = new BaseSecurityDecorator(SecurityConfigSchema.parse({}));
    const b = new BaseSecurityDecorator(SecurityConfigSchema.parse({}));
    a.ensureRouteConfig(function fa(): void {});
    expect(a.routeConfigRevision).toBe(1);
    expect(b.routeConfigRevision).toBe(0);
  });
});

describe('standalone checkIpAccess (the check_ip_access twin, matrix gap 30)', () => {
  const config = SecurityConfigSchema.parse({
    blacklist: ['203.0.113.99', '10.0.0.0/8'],
    whitelist: [],
  }) as ResolvedSecurityConfig;

  it('allows a clean ip', async () => {
    const result = await checkIpAccess('198.51.100.7', config);
    expect(result).toEqual({ allowed: true, reason: '', cloudProvider: null, network: null });
  });

  it('blocks a blacklisted exact ip and a CIDR match with the generic reason', async () => {
    const exact = await checkIpAccess('203.0.113.99', config);
    expect(exact.allowed).toBe(false);
    expect(exact.reason).toBe('IP 203.0.113.99 not in global allowlist/blocklist');

    const cidr = await checkIpAccess('10.1.2.3', config);
    expect(cidr.allowed).toBe(false);
  });

  it('blocks a whitelist miss and lets a whitelist match skip the country verdict', async () => {
    const allowOnly = SecurityConfigSchema.parse({
      whitelist: ['198.51.100.7'],
    }) as ResolvedSecurityConfig;
    const miss = await checkIpAccess('198.51.100.8', allowOnly);
    expect(miss.allowed).toBe(false);

    // A whitelist hit answers allowed without touching the (null) geo handler
    // even when country rules exist.
    const withCountries = SecurityConfigSchema.parse({
      whitelist: ['198.51.100.7'],
      blockedCountries: ['US'],
      geoResolver: () => null,
    }) as ResolvedSecurityConfig;
    const hit = await checkIpAccess('198.51.100.7', withCountries, null);
    expect(hit.allowed).toBe(true);
  });

  it('blocks on the country verdict and carries the country into the reason', async () => {
    const geo = {
      isInitialized: true,
      initialize: async () => {},
      getCountry: (ip: string) => (ip === '198.51.100.7' ? 'RU' : null),
    };
    const withCountries = SecurityConfigSchema.parse({
      blockedCountries: ['RU'],
      geoResolver: () => null,
    }) as ResolvedSecurityConfig;
    const result = await checkIpAccess('198.51.100.7', withCountries, geo as never);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('IP from blocked country: RU');
  });

  it('blocks an unknown identity only when an allowlist tier is active', async () => {
    const unknown = 'unknown';
    const open = await checkIpAccess(unknown, config);
    expect(open.allowed).toBe(true);

    const allowOnly = SecurityConfigSchema.parse({
      whitelist: ['198.51.100.7'],
    }) as ResolvedSecurityConfig;
    const blocked = await checkIpAccess(unknown, allowOnly);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('not in global allowlist/blocklist');

    const skipped = await checkIpAccess(unknown, allowOnly, null, null, { skipIpLists: true });
    expect(skipped.allowed).toBe(true);
  });

  it('reports the cloud provider and network on a cloud denial', async () => {
    const cloudConfig = SecurityConfigSchema.parse({
      blockCloudProviders: ['AWS'],
    }) as ResolvedSecurityConfig;
    const cloudHandler = {
      isCloudIp: (ip: string) => ip === '52.1.2.3',
      getCloudProviderDetails: (ip: string) =>
        ip === '52.1.2.3' ? (['AWS', '52.0.0.0/8'] as [string, string]) : null,
    };
    const result = await checkIpAccess('52.1.2.3', cloudConfig, null, cloudHandler as never);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('IP belongs to blocked cloud provider: AWS');
    expect(result.cloudProvider).toBe('AWS');
    expect(result.network).toBe('52.0.0.0/8');
  });

  it('leaves a non-cloud ip alone and reports the generic reason on missing details', async () => {
    const cloudConfig = SecurityConfigSchema.parse({
      blockCloudProviders: ['AWS'],
    }) as ResolvedSecurityConfig;
    const cloudHandler = {
      isCloudIp: (ip: string) => ip === '52.1.2.3',
      getCloudProviderDetails: () => null,
    };
    const miss = await checkIpAccess('198.51.100.7', cloudConfig, null, cloudHandler as never);
    expect(miss.allowed).toBe(true);

    const noDetails = await checkIpAccess('52.1.2.3', cloudConfig, null, cloudHandler as never);
    expect(noDetails.allowed).toBe(false);
    expect(noDetails.reason).toContain('not in global allowlist/blocklist');
    expect(noDetails.cloudProvider).toBeNull();
  });

  it('the country-not-blocked verdict falls through to the cloud tier', async () => {
    const withCountries = SecurityConfigSchema.parse({
      blockedCountries: ['RU'],
      geoResolver: () => null,
    }) as ResolvedSecurityConfig;
    let calls = 0;
    const geo = {
      isInitialized: true,
      initialize: async () => {},
      getCountry: () => {
        calls += 1;
        return calls % 2 === 1 ? 'DE' : null; // verdict sees a country, the reason lookup sees none
      },
    };
    const result = await checkIpAccess('198.51.100.7', withCountries, geo as never);
    expect(result.allowed).toBe(true);
  });

  it('blocks an unparseable ip with the generic reason (the ValueError arm)', async () => {
    const result = await checkIpAccess('not-an-ip', config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not in global allowlist/blocklist');
  });

  it('skipCountries skips the geo tier entirely', async () => {
    const withCountries = SecurityConfigSchema.parse({
      blockedCountries: ['RU'],
      geoResolver: () => null,
    }) as ResolvedSecurityConfig;
    const result = await checkIpAccess(
      '198.51.100.7', withCountries, null, null, { skipCountries: true },
    );
    expect(result.allowed).toBe(true);
  });
});

describe('package-root handler exports (matrix gap 33)', () => {
  it('the manager classes are public from the package root', async () => {
    const root = await import('../../src/index.js');
    for (const name of [
      'BehaviorTracker', 'CloudHandler', 'DynamicRuleManager', 'IPBanManager',
      'IPInfoManager', 'RateLimitManager', 'RedisManager', 'SecurityHeadersManager',
      'SusPatternsManager',
    ]) {
      expect((root as Record<string, unknown>)[name], name).toBeTypeOf('function');
    }
  });
});

describe('root export parity smoke', () => {
  it('checkRateLimitByIp and checkIpAccess are importable from the root', async () => {
    const root = await import('../../src/index.js');
    expect(typeof root.checkRateLimitByIp).toBe('function');
    expect(typeof root.checkIpAccess).toBe('function');
    void checkRateLimitByIp;
  });
});
