/* The standalone checkRateLimitByIp suite: mirrors
   tests/test_core/test_check_rate_limit_by_ip.py and
   tests/test_core/test_check_rate_limit_by_ip_autoban.py. The dedicated
   stores reset between tests like the reference module globals. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimitByIp,
  byIpRequestTimestamps,
  byIpAutobanCounts,
  setMaxTrackedRateLimitKeys,
  MAX_TRACKED_RATE_LIMIT_KEYS,
  hashIdentitySegment,
  inMemoryRequestCountByIp,
  redisRequestCountByIp,
} from '../../src/handlers/rate-limit-by-ip.js';
import { RateLimitManager } from '../../src/handlers/rate-limit.js';
import { IPBanManager } from '../../src/handlers/ip-ban.js';
import { GuardRedisError } from '../../src/errors.js';
import { createTestConfig } from '../helpers.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import type { Logger } from '../../src/models/logger.js';
import type { RedisManager } from '../../src/handlers/redis.js';

function captureLogger(): Logger & { warns: string[]; errors: string[] } {
  const warns: string[] = [];
  const errors: string[] = [];
  return {
    info: () => {},
    warn: (m: string) => { warns.push(m); },
    error: (m: string) => { errors.push(m); },
    debug: () => {},
    warns, errors,
  };
}

const ORIGINAL_CAP = MAX_TRACKED_RATE_LIMIT_KEYS;

beforeEach(() => {
  byIpRequestTimestamps.clear();
  byIpAutobanCounts.clear();
  setMaxTrackedRateLimitKeys(10_000);
});

afterEach(() => {
  setMaxTrackedRateLimitKeys(ORIGINAL_CAP);
});

async function flushRedis(prefix: string): Promise<void> {
  const { RedisManager } = await import('../../src/handlers/redis.js');
  const { defaultLogger } = await import('../../src/models/logger.js');
  const config = createTestConfig({ redisUrl: process.env.REDIS_URL, redisPrefix: prefix });
  const store = new RedisManager(config, defaultLogger);
  await store.initialize();
  await store.deletePattern('*');
  await store.close();
}

function brokenRedisHandler(): RedisManager {
  // A handler whose raw client rejects every command (the _broken_redis_handler twin).
  const handler = {
    getRawClient: () => ({
      zadd: async () => { throw new Error('down'); },
      zremrangebyscore: async () => { throw new Error('down'); },
      zcard: async () => { throw new Error('down'); },
      expire: async () => { throw new Error('down'); },
    }),
    prefix: 'test:',
  };
  return handler as unknown as RedisManager;
}

describe('checkRateLimitByIp (in-memory window)', () => {
  it('under the limit stays allowed', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 2, rateLimitWindow: 60 });
    expect(await checkRateLimitByIp('203.0.113.1', config)).toBe(true);
    expect(await checkRateLimitByIp('203.0.113.1', config)).toBe(true);
  });

  it('over the limit becomes blocked', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    expect(await checkRateLimitByIp('203.0.113.2', config)).toBe(true);
    expect(await checkRateLimitByIp('203.0.113.2', config)).toBe(false);
  });

  it('window expiry recovers after a block', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 1 });
    expect(await checkRateLimitByIp('203.0.113.3', config)).toBe(true);
    expect(await checkRateLimitByIp('203.0.113.3', config)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(await checkRateLimitByIp('203.0.113.3', config)).toBe(true);
  }, 10_000);

  it('falls back to the in-memory window when no redis handler is supplied', async () => {
    const config = createTestConfig({ enableRedis: true, rateLimit: 1, rateLimitWindow: 60 });
    expect(await checkRateLimitByIp('203.0.113.5', config)).toBe(true);
    expect(await checkRateLimitByIp('203.0.113.5', config)).toBe(false);
  });

  it('endpointPath namespaces isolate budgets', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    const ip = '203.0.113.8';
    expect(await checkRateLimitByIp(ip, config, null, 'a')).toBe(true);
    expect(await checkRateLimitByIp(ip, config, null, 'a')).toBe(false);
    expect(await checkRateLimitByIp(ip, config, null, 'b')).toBe(true);
  });

  it('enableRateLimiting false answers true', async () => {
    const config = createTestConfig({ enableRateLimiting: false });
    expect(await checkRateLimitByIp('203.0.113.10', config)).toBe(true);
  });

  it('the primitive never mutates the pipeline RateLimitManager', async () => {
    const configA = createTestConfig({ enableRedis: false, rateLimit: 5, rateLimitWindow: 60 });
    const pipelineManager = new RateLimitManager(captureLogger(), configA);

    const configB = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    await checkRateLimitByIp('203.0.113.7', configB);

    expect((pipelineManager as unknown as { requestTimestamps: Map<string, number[]> }).requestTimestamps.size).toBe(0);
    expect(byIpRequestTimestamps.size).toBe(1);
  });

  it('the in-memory key never contains the endpoint path text', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 5, rateLimitWindow: 60 });
    const secretPath = '/orders/password=hunter2topsecretvalue';
    const ip = '203.0.113.41';

    await checkRateLimitByIp(ip, config, null, secretPath);

    const matchingKeys = [...byIpRequestTimestamps.keys()].filter((k) => k.startsWith(`${ip}:`));
    expect(matchingKeys.length).toBeGreaterThan(0);
    for (const key of matchingKeys) {
      expect(key).not.toContain(secretPath);
      expect(key).not.toContain('hunter2topsecretvalue');
      expect(key).toBe(`${ip}:${hashIdentitySegment(secretPath)}`);
    }
  });

  it('rejected input records no hit when rate limiting is enabled', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    await expect(checkRateLimitByIp('not-an-ip', config)).rejects.toThrow(TypeError);
    expect(await checkRateLimitByIp('203.0.113.21', config)).toBe(true);
  });

  it('rejected input records no hit when rate limiting is disabled', async () => {
    const disabled = createTestConfig({ enableRateLimiting: false });
    await expect(checkRateLimitByIp('not-an-ip', disabled)).rejects.toThrow(TypeError);

    const enabled = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    expect(await checkRateLimitByIp('203.0.113.22', enabled)).toBe(true);
  });

  it('a rejected endpointPath records no hit', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 1, rateLimitWindow: 60 });
    await expect(checkRateLimitByIp('203.0.113.23', config, null, 'a:b')).rejects.toThrow(TypeError);
    expect(await checkRateLimitByIp('203.0.113.23', config)).toBe(true);
  });

  it('accepts a valid IPv4 and an IPv6 literal', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 5, rateLimitWindow: 60 });
    expect(await checkRateLimitByIp('203.0.113.24', config)).toBe(true);
    expect(await checkRateLimitByIp('2001:db8::1', config)).toBe(true);
  });

  it('rejects unparseable ips', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 5, rateLimitWindow: 60 });
    await expect(checkRateLimitByIp('1.2.3.4:ws', config)).rejects.toThrow(TypeError);
    await expect(checkRateLimitByIp('', config)).rejects.toThrow(TypeError);
    await expect(checkRateLimitByIp('not-an-ip', config)).rejects.toThrow(TypeError);
  });

  it('a colon in endpointPath raises with the path redacted', async () => {
    const config = createTestConfig({ enableRedis: false, rateLimit: 5, rateLimitWindow: 60 });
    const secret = 'password=hunter2topsecretvalue';

    try {
      await checkRateLimitByIp('203.0.113.20', config, null, `a:${secret}`);
      expect.unreachable('expected TypeError');
    } catch (e) {
      expect((e as TypeError).message).not.toContain('hunter2');
      expect((e as TypeError).message).toContain('[REDACTED]');
    }
  });

  it('the in-memory store evicts the oldest key at capacity', async () => {
    setMaxTrackedRateLimitKeys(3);
    const config = createTestConfig({ enableRedis: false, rateLimit: 1000, rateLimitWindow: 60 });

    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) {
      await checkRateLimitByIp(ip, config);
    }
    expect([...byIpRequestTimestamps.keys()]).toEqual(['10.0.0.1', '10.0.0.2', '10.0.0.3']);

    await checkRateLimitByIp('10.0.0.4', config);

    expect(byIpRequestTimestamps.size).toBe(3);
    expect(byIpRequestTimestamps.has('10.0.0.1')).toBe(false);
    expect(byIpRequestTimestamps.has('10.0.0.4')).toBe(true);
  });

  it('a touched key survives eviction', async () => {
    setMaxTrackedRateLimitKeys(3);
    const config = createTestConfig({ enableRedis: false, rateLimit: 1000, rateLimitWindow: 60 });

    for (const ip of ['10.0.1.1', '10.0.1.2', '10.0.1.3']) {
      await checkRateLimitByIp(ip, config);
    }

    await checkRateLimitByIp('10.0.1.1', config);
    await checkRateLimitByIp('10.0.1.4', config);

    expect(byIpRequestTimestamps.has('10.0.1.1')).toBe(true);
    expect(byIpRequestTimestamps.has('10.0.1.2')).toBe(false);
    expect(byIpRequestTimestamps.size).toBe(3);
  });
});

describe('checkRateLimitByIp (redis window)', () => {
  /* The zset members are millisecond timestamps; two hits inside the same
     millisecond collide into one member (ZADD updates the score). The
     Python suite gets microsecond separation for free - these tests take
     an explicit tick between hits. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  async function freshStore(prefix: string, rateLimit: number) {
    const { RedisManager } = await import('../../src/handlers/redis.js');
    const { defaultLogger } = await import('../../src/models/logger.js');
    const config = createTestConfig({
      enableRedis: true, redisUrl: process.env.REDIS_URL, redisPrefix: prefix,
      rateLimit, rateLimitWindow: 60,
    });
    const store = new RedisManager(config, defaultLogger);
    await store.initialize();
    return { config, store };
  }

  it('enforces the limit through Redis', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 2);
    try {
      const ip = '203.0.113.4';
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(true);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(true);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(false);
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });

  it('a redis error raises GuardRedisError when fail-open is false', async () => {
    const config = createTestConfig({ enableRedis: true, rateLimit: 1, rateLimitWindow: 60 });
    await expect(checkRateLimitByIp('203.0.113.6', config, brokenRedisHandler()))
      .rejects.toThrow(GuardRedisError);
  });

  it('a redis error falls back to the in-memory count when fail-open is true', async () => {
    const config = createTestConfig({
      enableRedis: true, rateLimit: 1, rateLimitWindow: 60, redisFailOpen: true,
    });
    const redis = brokenRedisHandler();
    expect(await checkRateLimitByIp('203.0.113.106', config, redis)).toBe(true);
    expect(await checkRateLimitByIp('203.0.113.106', config, redis)).toBe(false);
  });

  it('the default endpointPath shares the pipeline bucket bidirectionally', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 3);
    try {
      const ip = '203.0.113.9';
      const pipeline = new RateLimitManager(captureLogger(), config);
      await pipeline.initializeRedis(store);
      const counter = (pipeline as unknown as {
        getRedisRequestCount: (key: string, now: number, window: number, limit: number) => Promise<number | null>;
      });

      expect(await counter.getRedisRequestCount(ip, Date.now() / 1000, 60, 10)).toBe(1);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store)).toBe(true);
      await tick();
      expect(await counter.getRedisRequestCount(ip, Date.now() / 1000, 60, 10)).toBe(3);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store)).toBe(false);
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });

  it('endpointPath ws is disjoint from the pipeline bucket', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 2);
    try {
      const ip = '203.0.113.12';
      const pipeline = new RateLimitManager(captureLogger(), config);
      await pipeline.initializeRedis(store);
      const counter = (pipeline as unknown as {
        getRedisRequestCount: (key: string, now: number, window: number, limit: number) => Promise<number | null>;
      });

      expect(await counter.getRedisRequestCount(ip, Date.now() / 1000, 60, 10)).toBe(1);
      await tick();
      expect(await counter.getRedisRequestCount(ip, Date.now() / 1000, 60, 10)).toBe(2);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(true);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(true);
      await tick();
      expect(await checkRateLimitByIp(ip, config, store, 'ws')).toBe(false);
      await tick();
      expect(await counter.getRedisRequestCount(ip, Date.now() / 1000, 60, 10)).toBe(3);
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });

  it('the redis key never contains the endpoint path text', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 5);
    try {
      const secretPath = '/orders/password=hunter2topsecretvalue';
      const ip = '203.0.113.40';
      await checkRateLimitByIp(ip, config, store, secretPath);

      const client = store.getRawClient()!;
      const keys = await client.keys(`${prefix}rate_limit:rate:${ip}:*`) as string[];
      expect(keys.length).toBeGreaterThan(0);
      for (const rawKey of keys) {
        const keyText = typeof rawKey === 'string' ? rawKey : String(rawKey);
        expect(keyText).not.toContain(secretPath);
        expect(keyText).not.toContain('hunter2topsecretvalue');
      }
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });

  it('equal paths share a key, different paths do not', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 100);
    try {
      const ip = '203.0.113.42';
      await checkRateLimitByIp(ip, config, store, '/orders/1');
      await checkRateLimitByIp(ip, config, store, '/orders/1');
      await checkRateLimitByIp(ip, config, store, '/orders/2');

      const client = store.getRawClient()!;
      const keys = await client.keys(`${prefix}rate_limit:rate:${ip}:*`) as unknown[];
      expect(keys.length).toBe(2);
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });

  it('the primitive raises instead of colliding with a hashed pipeline bucket', async () => {
    if (!process.env.REDIS_URL) return;
    const prefix = `guard-ts-rlip-${Math.random().toString(36).slice(2)}:`;
    const { config, store } = await freshStore(prefix, 2);
    try {
      const pipeline = new RateLimitManager(captureLogger(), config);
      await pipeline.initializeRedis(store);
      const counter = (pipeline as unknown as {
        getRedisRequestCount: (key: string, now: number, window: number, limit: number, ep?: string) => Promise<number | null>;
      });
      expect(await counter.getRedisRequestCount('1.2.3.4', Date.now() / 1000, 60, 10, 'ws')).toBe(1);

      await expect(checkRateLimitByIp('1.2.3.4:ws', config, store)).rejects.toThrow(TypeError);

      await tick();
      expect(await counter.getRedisRequestCount('1.2.3.4', Date.now() / 1000, 60, 10, 'ws')).toBe(2);
    } finally {
      await store.deletePattern('*');
      await store.close();
    }
  });
});
describe('checkRateLimitByIp (auto-ban feed)', () => {
  type BanCalls = Array<[string, number, string]>;

  function recordingBanManager(config: ResolvedSecurityConfig): { manager: IPBanManager; banCalls: BanCalls } {
    const logger = captureLogger();
    const manager = new IPBanManager(logger);
    const banCalls: BanCalls = [];
    const realBanIp = manager.banIp.bind(manager);
    (manager as unknown as { banIp: unknown }).banIp = async (
      ip: string, duration: number, reason: string,
    ) => {
      banCalls.push([ip, duration, reason]);
      void realBanIp;
      return true;
    };
    void config;
    return { manager, banCalls };
  }

  it('the knob-off default never bans on repeated violations', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableIpBanning: true, autoBanThreshold: 1,
    });
    expect(config.enableRateLimitAutoBan).toBe(false);
    const { banCalls } = recordingBanManager(config);
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });

    const ip = '192.0.2.101';
    await checkRateLimitByIp(ip, config);
    await checkRateLimitByIp(ip, config);
    await checkRateLimitByIp(ip, config);

    expect(banCalls).toEqual([]);
    vi.restoreAllMocks();
  });

  it('crossing the threshold bans with the configured duration and reason', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true,
      autoBanThreshold: 2, autoBanDuration: 1234,
    });
    const banCalls: BanCalls = [];
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });

    const ip = '192.0.2.102';
    expect(await checkRateLimitByIp(ip, config)).toBe(true);
    expect(await checkRateLimitByIp(ip, config)).toBe(false);
    expect(banCalls).toEqual([]);

    expect(await checkRateLimitByIp(ip, config)).toBe(false);
    expect(banCalls).toEqual([[ip, 1234, 'rate_limit_exceeded']]);
    vi.restoreAllMocks();
  });

  it('a per-category threatBanConfig override is honored', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true,
      autoBanThreshold: 1000, autoBanDuration: 60,
      threatBanConfig: { rate_limit: { threshold: 1, duration: 999 } },
    });
    const banCalls: BanCalls = [];
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });

    const ip = '192.0.2.103';
    expect(await checkRateLimitByIp(ip, config)).toBe(true);
    expect(await checkRateLimitByIp(ip, config)).toBe(false);

    expect(banCalls).toEqual([[ip, 999, 'rate_limit_exceeded:rate_limit']]);
    vi.restoreAllMocks();
  });

  it('passive mode suppresses counting and bans', async () => {
    const config = createTestConfig({
      passiveMode: true,
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true, autoBanThreshold: 1,
    });
    const banCalls: BanCalls = [];
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });

    const ip = '192.0.2.104';
    expect(await checkRateLimitByIp(ip, config)).toBe(true);
    expect(await checkRateLimitByIp(ip, config)).toBe(false);

    expect(banCalls).toEqual([]);
    expect(byIpAutobanCounts.has(ip)).toBe(false);
    vi.restoreAllMocks();
  });

  it('enableIpBanning false suppresses bans', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: false, autoBanThreshold: 1,
    });
    const banCalls: BanCalls = [];
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });

    await checkRateLimitByIp('192.0.2.105', config);
    await checkRateLimitByIp('192.0.2.105', config);

    expect(banCalls).toEqual([]);
    vi.restoreAllMocks();
  });

  it('a rejected ip input records no autoban count', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true, autoBanThreshold: 1,
    });
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockResolvedValue(true);

    const badIp = 'not-an-ip-192.0.2.106';
    await expect(checkRateLimitByIp(badIp, config)).rejects.toThrow(TypeError);

    expect(byIpAutobanCounts.has(badIp)).toBe(false);
    vi.restoreAllMocks();
  });

  it('a redis-backed over-limit feeds the autoban counter', async () => {
    const config = createTestConfig({
      enableRedis: true, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true,
      autoBanThreshold: 1, autoBanDuration: 111,
    });
    const banCalls: BanCalls = [];
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      return true;
    });
    // A redis window that answers 5 (the reference monkeypatched
    // _redis_request_count returning (5, None)): over limit, autoban fed.
    const redis = {
      getRawClient: () => ({
        zadd: async () => 1,
        zremrangebyscore: async () => 0,
        zcard: async () => 5,
        expire: async () => 1,
      }),
      prefix: 'test:',
    } as unknown as RedisManager;

    const ip = '192.0.2.107';
    expect(await checkRateLimitByIp(ip, config, redis)).toBe(false);
    expect(banCalls).toEqual([[ip, 111, 'rate_limit_exceeded']]);
    vi.restoreAllMocks();
  });

  it('an already banned ip makes zero additional ban calls and freezes the counter', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true,
      autoBanThreshold: 2, autoBanDuration: 1234,
    });
    const banCalls: BanCalls = [];
    let banned = false;
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockImplementation(async () => banned);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockImplementation(async (...args: unknown[]) => {
      banCalls.push(args as unknown as [string, number, string]);
      banned = true;
      return true;
    });

    const ip = '192.0.2.110';
    expect(await checkRateLimitByIp(ip, config)).toBe(true);
    expect(await checkRateLimitByIp(ip, config)).toBe(false);
    expect(banCalls).toEqual([]);

    expect(await checkRateLimitByIp(ip, config)).toBe(false);
    expect(banCalls).toEqual([[ip, 1234, 'rate_limit_exceeded']]);
    expect(byIpAutobanCounts.get(ip)).toBe(2);

    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimitByIp(ip, config)).toBe(false);
    }

    expect(banCalls).toEqual([[ip, 1234, 'rate_limit_exceeded']]);
    expect(byIpAutobanCounts.get(ip)).toBe(2);
    vi.restoreAllMocks();
  });

  it('the dedicated counter is isolated from the middleware suspicious counts', async () => {
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true, autoBanThreshold: 1000,
    });
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockResolvedValue(true);

    const middleware = {
      suspiciousRequestCounts: new Map<string, Map<string, number>>(),
    } as unknown as Parameters<typeof incrementSuspiciousCounts>[0];

    // The pipeline path bumps middleware.suspiciousRequestCounts only.
    const { incrementSuspiciousCounts } = await import('../../src/core/checks/helpers.js');
    incrementSuspiciousCounts(middleware, '192.0.2.108', 'rate_limit');

    const primitiveIp = '192.0.2.109';
    await checkRateLimitByIp(primitiveIp, config);
    await checkRateLimitByIp(primitiveIp, config);

    const counts = (middleware as unknown as { suspiciousRequestCounts: Map<string, Map<string, number>> }).suspiciousRequestCounts;
    expect(counts.get('192.0.2.108')?.get('rate_limit')).toBe(1);
    expect(counts.has(primitiveIp)).toBe(false);
    expect(byIpAutobanCounts.get(primitiveIp)).toBe(1);
    expect(byIpAutobanCounts.has('192.0.2.108')).toBe(false);
    vi.restoreAllMocks();
  });

  it('the autoban counter evicts the oldest ip and a touched ip survives', async () => {
    setMaxTrackedRateLimitKeys(3);
    const config = createTestConfig({
      enableRedis: false, rateLimit: 1, rateLimitWindow: 60,
      enableRateLimitAutoBan: true, enableIpBanning: true, autoBanThreshold: 1_000_000,
    });
    vi.spyOn(IPBanManager.prototype, 'isIpBanned').mockResolvedValue(false);
    vi.spyOn(IPBanManager.prototype, 'banIp').mockResolvedValue(true);

    for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      await checkRateLimitByIp(ip, config);
      await checkRateLimitByIp(ip, config);
    }

    expect([...byIpAutobanCounts.keys()]).toEqual([
      '198.51.100.1', '198.51.100.2', '198.51.100.3',
    ]);

    await checkRateLimitByIp('198.51.100.1', config);
    await checkRateLimitByIp('198.51.100.1', config);
    await checkRateLimitByIp('198.51.100.4', config);
    await checkRateLimitByIp('198.51.100.4', config);

    expect(byIpAutobanCounts.size).toBe(3);
    expect(byIpAutobanCounts.has('198.51.100.2')).toBe(false);
    expect(byIpAutobanCounts.has('198.51.100.1')).toBe(true);
    expect(byIpAutobanCounts.has('198.51.100.4')).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('module helpers', () => {
  it('hashIdentitySegment is the sha256 hexdigest twin', () => {
    expect(hashIdentitySegment('ws')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('inMemoryRequestCountByIp answers the pre-hit count and trims the window', () => {
    const now = Date.now() / 1000;
    expect(inMemoryRequestCountByIp('203.0.113.200', now - 60, now)).toBe(0);
    expect(inMemoryRequestCountByIp('203.0.113.200', now - 60, now + 0.1)).toBe(1);
    expect(inMemoryRequestCountByIp('203.0.113.200', now - 60, now + 0.2)).toBe(2);
  });

  it('redisRequestCountByIp answers null when the raw client is missing', async () => {
    const redis = { getRawClient: () => null, prefix: 'test:' } as unknown as RedisManager;
    expect(await redisRequestCountByIp(redis, '203.0.113.201', 1, 0, 60)).toBeNull();
  });

  it('module-level stores reset cleanly between suites', () => {
    expect(byIpRequestTimestamps.size).toBe(0);
    expect(byIpAutobanCounts.size).toBe(0);
    void flushRedis;
  });
});
