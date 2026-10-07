import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudHandler } from '../../src/handlers/cloud.js';
import {
  InMemoryCloudIpStore,
  RedisCloudIpStore,
  encodeCachedEntries,
  decodeCachedEntries,
} from '../../src/handlers/cloud-ip-stores.js';
import { defaultLogger } from '../../src/models/logger.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CloudHandler', () => {
  let handler: CloudHandler;

  beforeEach(() => {
    handler = new CloudHandler(defaultLogger);
    mockFetch.mockReset();
  });

  it('isCloudIp returns false with no ranges loaded', () => {
    expect(handler.isCloudIp('1.2.3.4', new Set(['AWS']))).toBe(false);
  });

  it('isCloudIp returns false for invalid IP', () => {
    expect(handler.isCloudIp('not-an-ip', new Set(['AWS']))).toBe(false);
  });

  it('getCloudProviderDetails returns null with no ranges', () => {
    expect(handler.getCloudProviderDetails('1.2.3.4', new Set(['AWS']))).toBeNull();
  });

  it('refreshAsync fetches AWS ranges', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });

    await handler.refreshAsync(new Set(['AWS']));
    expect(handler.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(true);
    expect(handler.isCloudIp('8.8.8.8', new Set(['AWS']))).toBe(false);
  });

  it('refreshAsync fetches GCP ranges', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ipv4Prefix: '35.0.0.0/8' }] }),
    });

    await handler.refreshAsync(new Set(['GCP']));
    expect(handler.isCloudIp('35.1.2.3', new Set(['GCP']))).toBe(true);
  });

  it('refreshAsync handles Azure (two-step fetch)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        text: async () => '<a href="https://download.microsoft.com/test.json">Download</a>',
      })
      .mockResolvedValueOnce({
        json: async () => ({ values: [{ properties: { addressPrefixes: ['40.0.0.0/8'] } }] }),
      });

    await handler.refreshAsync(new Set(['Azure']));
    expect(handler.isCloudIp('40.1.2.3', new Set(['Azure']))).toBe(true);
  });

  it('refreshAsync handles Azure with no download URL', async () => {
    mockFetch.mockResolvedValueOnce({
      text: async () => '<html>No download link here</html>',
    });

    await handler.refreshAsync(new Set(['Azure']));
    expect(handler.isCloudIp('40.1.2.3', new Set(['Azure']))).toBe(false);
  });

  it('refreshAsync handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    await handler.refreshAsync(new Set(['AWS']));
  });

  it('getCloudProviderDetails returns provider and CIDR', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });

    await handler.refreshAsync(new Set(['AWS']));
    const result = handler.getCloudProviderDetails('52.1.2.3', new Set(['AWS']));
    expect(result).not.toBeNull();
    expect(result![0]).toBe('AWS');
    expect(result![1]).toBe('52.0.0.0/8');
  });

  it('reset clears all ranges', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });

    await handler.refreshAsync(new Set(['AWS']));
    expect(handler.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(true);

    await handler.reset();
    expect(handler.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(false);
  });

  it('initializeAgent sets handler', async () => {
    const agent = { sendEvent: vi.fn() };
    await handler.initializeAgent(agent as never);
  });

  it('handles unknown provider', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}) });
    await handler.refreshAsync(new Set(['Unknown' as 'AWS']));
  });

  it('loads from the Redis store when the cache is warm (no fetch)', async () => {
    mockFetch.mockRejectedValue(new Error('network'));

    const mockRedis = {
      getKey: vi.fn().mockResolvedValue('["10.0.0.0/8"]'),
      setKey: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
      deletePattern: vi.fn(),
    };
    await handler.initializeRedis(mockRedis as never, new Set(['AWS']));
    expect(handler.isCloudIp('10.1.2.3', new Set(['AWS']))).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('initializeAgent + refreshAsync with agent', async () => {
    const agent = { sendEvent: vi.fn() };
    await handler.initializeAgent(agent as never);

    mockFetch.mockResolvedValue({
      json: async () => ({ prefixes: [{ ip_prefix: '1.0.0.0/8', service: 'AMAZON' }] }),
    });

    await handler.refreshAsync(new Set(['AWS']));
  });
});

describe('CloudIpStoreProtocol seam (reference cloud_ip_stores.py)', () => {
  let handler: CloudHandler;

  beforeEach(() => {
    handler = new CloudHandler(defaultLogger);
    mockFetch.mockReset();
  });

  function mockRedis() {
    return {
      getKey: vi.fn().mockResolvedValue(null),
      setKey: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
      initialize: vi.fn(),
      getConnection: vi.fn(),
    };
  }

  it('reads from an injected store on refresh', async () => {
    const store = new InMemoryCloudIpStore();
    await store.set('AWS', new Set(['10.0.0.0/8']));
    const manager = new CloudHandler(defaultLogger, store);

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('10.1.2.3', new Set(['AWS']))).toBe(true);
  });

  it('writes to the store after an API fetch', async () => {
    const store = new InMemoryCloudIpStore();
    const manager = new CloudHandler(defaultLogger, store);
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '172.16.0.0/12', service: 'AMAZON' }] }),
    });

    await manager.refreshAsync(new Set(['AWS']));

    expect(await store.get('AWS')).toEqual(new Set(['172.16.0.0/12']));
    expect(manager.isCloudIp('172.16.1.1', new Set(['AWS']))).toBe(true);
  });

  it('the default in-memory store skips the second fetch (cache-first)', async () => {
    const manager = new CloudHandler(defaultLogger);
    mockFetch.mockResolvedValue({
      json: async () => ({ prefixes: [{ ipv4Prefix: '10.0.0.0/8' }] }),
    });

    await manager.refreshAsync(new Set(['GCP']));
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await manager.refreshAsync(new Set(['GCP']));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('setStore(null) with a Redis handler rides the legacy cloud_ranges_v2 path', async () => {
    const manager = new CloudHandler(defaultLogger);
    manager.setStore(null);
    const redis = mockRedis();
    vi.mocked(redis.getKey).mockResolvedValue('10.0.0.0/8');
    // emulate the private redis handler wiring
    (manager as unknown as { redisHandler: unknown }).redisHandler = redis;

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('10.1.2.3', new Set(['AWS']))).toBe(true);
  });

  it('the legacy redis-handler path writes back after a fetch', async () => {
    const manager = new CloudHandler(defaultLogger);
    manager.setStore(null);
    const redis = mockRedis();
    (manager as unknown as { redisHandler: unknown }).redisHandler = redis;
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });

    await manager.refreshAsync(new Set(['AWS']), 600);

    expect(redis.setKey).toHaveBeenCalledWith(
      'cloud_ranges_v2', 'AWS', '52.0.0.0/8', 600,
    );
    expect(manager.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(true);
  });

  it('the legacy redis-handler path keeps a new provider empty on a fetch failure', async () => {
    const manager = new CloudHandler(defaultLogger);
    manager.setStore(null);
    const redis = mockRedis();
    (manager as unknown as { redisHandler: unknown }).redisHandler = redis;
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    await manager.refreshAsync(new Set(['Azure']));

    expect(manager.isCloudIp('40.1.2.3', new Set(['Azure']))).toBe(false);
  });

  it('the legacy redis-handler path loads region annotations from the cache', async () => {
    const manager = new CloudHandler(defaultLogger);
    manager.setStore(null);
    const redis = mockRedis();
    vi.mocked(redis.getKey).mockResolvedValue('203.0.113.0/24|us-east');
    (manager as unknown as { redisHandler: unknown }).redisHandler = redis;

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('203.0.113.5', new Set(['AWS']))).toBe(true);
  });

  it('setStore(null) with no Redis falls back to the bare API', async () => {
    const manager = new CloudHandler(defaultLogger);
    manager.setStore(null);
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '203.0.113.0/24', service: 'AMAZON' }] }),
    });

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('203.0.113.5', new Set(['AWS']))).toBe(true);
  });

  it('a store-path fetch exception leaves a new provider empty', async () => {
    const store = new InMemoryCloudIpStore();
    const manager = new CloudHandler(defaultLogger, store);
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    await manager.refreshAsync(new Set(['Azure']));

    expect(manager.isCloudIp('40.1.2.3', new Set(['Azure']))).toBe(false);
  });

  it('a store write failure preserves existing ranges', async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
      clear: vi.fn(),
    };
    const manager = new CloudHandler(defaultLogger, store as never);
    (manager as unknown as { ipRanges: Map<string, string[]> }).ipRanges.set('AWS', ['10.0.0.0/8']);
    mockFetch.mockResolvedValue({
      json: async () => ({ prefixes: [{ ip_prefix: '172.16.0.0/12', service: 'AMAZON' }] }),
    });

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('10.1.2.3', new Set(['AWS']))).toBe(true);
    expect(manager.isCloudIp('172.16.1.1', new Set(['AWS']))).toBe(false);
  });

  it('a store write failure keeps a new provider empty', async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
      clear: vi.fn(),
    };
    const manager = new CloudHandler(defaultLogger, store as never);
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '172.16.0.0/12', service: 'AMAZON' }] }),
    });

    await manager.refreshAsync(new Set(['AWS']));

    expect(manager.isCloudIp('172.16.1.1', new Set(['AWS']))).toBe(false);
  });

  it('initializeRedis upgrades a still-default store to the Redis store', async () => {
    const redis = mockRedis();
    await handler.initializeRedis(redis as never, new Set(['AWS']));
    expect(handler.getStore()).toBeInstanceOf(RedisCloudIpStore);
  });

  it('initializeRedis keeps an injected custom (non-default) store', async () => {
    const custom = {
      get: vi.fn().mockResolvedValue(new Set(['10.0.0.0/8'])),
      set: vi.fn(),
      clear: vi.fn(),
    };
    const manager = new CloudHandler(defaultLogger, custom as never);
    const redis = mockRedis();
    await manager.initializeRedis(redis as never, new Set(['AWS']));
    expect(manager.getStore()).toBe(custom);
    expect(manager.isCloudIp('10.1.2.3', new Set(['AWS']))).toBe(true);
  });

  it('sync refresh throws when Redis is enabled', async () => {
    const redis = mockRedis();
    (handler as unknown as { redisHandler: unknown }).redisHandler = redis;
    await expect(handler.refresh(new Set(['AWS']))).rejects.toThrow(
      'Use refreshAsync() when Redis is enabled',
    );
  });

  it('sync refresh fetches directly without the store', async () => {
    const store = new InMemoryCloudIpStore();
    const manager = new CloudHandler(defaultLogger, store);
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });

    await manager.refresh(new Set(['AWS']));

    expect(manager.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(true);
    expect(await store.get('AWS')).toBeNull();
  });

  it('sync refresh survives a fetch failure and keeps a new provider empty', async () => {
    const manager = new CloudHandler(defaultLogger);
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    await manager.refresh(new Set(['AWS']));

    expect(manager.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(false);
  });

  it('sync refresh logs range changes and quiet refetches of identical ranges', async () => {
    const manager = new CloudHandler(defaultLogger);
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });
    await manager.refresh(new Set(['AWS']));

    // Identical ranges: the change log stays quiet (the equal-set arm).
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });
    await manager.refresh(new Set(['AWS']));

    // Changed ranges: +1 added, -1 removed.
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '53.0.0.0/8', service: 'AMAZON' }] }),
    });
    await manager.refresh(new Set(['AWS']));

    expect(manager.isCloudIp('53.1.2.3', new Set(['AWS']))).toBe(true);
    expect(manager.isCloudIp('52.1.2.3', new Set(['AWS']))).toBe(false);
  });

  it('getStatus answers ready/lastRefreshed/entries per built-in provider', async () => {
    const before = handler.getStatus();
    expect(before['AWS']).toEqual({ ready: false, lastRefreshed: null, entries: 0 });

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
    });
    await handler.refreshAsync(new Set(['AWS']));

    const after = handler.getStatus();
    expect(after['AWS']!.ready).toBe(true);
    expect(after['AWS']!.entries).toBe(1);
    expect(after['AWS']!.lastRefreshed).toBeInstanceOf(Date);
    expect(after['GCP']!.ready).toBe(false);
  });
});

describe('InMemoryCloudIpStore (reference InMemoryCloudIpStore)', () => {
  it('round-trips a provider range set', async () => {
    const store = new InMemoryCloudIpStore();
    await store.set('AWS', new Set(['10.0.0.0/8']));
    expect(await store.get('AWS')).toEqual(new Set(['10.0.0.0/8']));
  });

  it('the answer is isolated from the source set', async () => {
    const store = new InMemoryCloudIpStore();
    const source = new Set(['10.0.0.0/8']);
    await store.set('AWS', source);
    source.add('192.168.0.0/16');
    expect(await store.get('AWS')).toEqual(new Set(['10.0.0.0/8']));
  });

  it('an expired ttl answers a miss', async () => {
    const store = new InMemoryCloudIpStore();
    await store.set('AWS', new Set(['10.0.0.0/8']), 0);
    expect(await store.get('AWS')).toBeNull();
  });

  it('clear drops every provider', async () => {
    const store = new InMemoryCloudIpStore();
    await store.set('AWS', new Set(['10.0.0.0/8']));
    await store.set('GCP', new Set(['10.0.0.0/8']));
    await store.clear();
    expect(await store.get('AWS')).toBeNull();
    expect(await store.get('GCP')).toBeNull();
  });
});

describe('RedisCloudIpStore (reference RedisCloudIpStore)', () => {
  function mockRedis() {
    return {
      getKey: vi.fn().mockResolvedValue(null),
      setKey: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
      initialize: vi.fn(),
      getConnection: vi.fn(),
    };
  }

  it('set writes sorted JSON with the ttl', async () => {
    const redis = mockRedis();
    const store = new RedisCloudIpStore(redis as never);
    await store.set('AWS', new Set(['192.168.0.0/16', '10.0.0.0/8']), 120);
    expect(redis.setKey).toHaveBeenCalledWith(
      'cloud_ip_v2', 'AWS', '["10.0.0.0/8", "192.168.0.0/16"]', 120,
    );
  });

  it('set without a ttl writes no expiry', async () => {
    const redis = mockRedis();
    const store = new RedisCloudIpStore(redis as never);
    await store.set('AWS', new Set(['10.0.0.0/8']), null);
    expect(redis.setKey).toHaveBeenCalledWith(
      'cloud_ip_v2', 'AWS', '["10.0.0.0/8"]', null,
    );
  });

  it('get returns null on a miss', async () => {
    const redis = mockRedis();
    const store = new RedisCloudIpStore(redis as never);
    expect(await store.get('AWS')).toBeNull();
  });

  it('get parses the JSON payload', async () => {
    const redis = mockRedis();
    vi.mocked(redis.getKey).mockResolvedValue('["10.0.0.0/8"]');
    const store = new RedisCloudIpStore(redis as never);
    expect(await store.get('AWS')).toEqual(new Set(['10.0.0.0/8']));
  });

  it('get returns null on invalid JSON', async () => {
    const redis = mockRedis();
    vi.mocked(redis.getKey).mockResolvedValue('{not json');
    const store = new RedisCloudIpStore(redis as never);
    expect(await store.get('AWS')).toBeNull();
  });

  it('get returns null when the payload is not a list', async () => {
    const redis = mockRedis();
    vi.mocked(redis.getKey).mockResolvedValue('{"a": 1}');
    const store = new RedisCloudIpStore(redis as never);
    expect(await store.get('AWS')).toBeNull();
  });

  it('clear deletes every matching provider key', async () => {
    const redis = mockRedis();
    vi.mocked(redis.keys).mockResolvedValue([
      'prefix:cloud_ip_v2:AWS',
      'prefix:cloud_ip_v2:GCP',
    ]);
    const store = new RedisCloudIpStore(redis as never);
    await store.clear();
    expect(redis.delete).toHaveBeenCalledTimes(2);
    expect(redis.delete).toHaveBeenCalledWith('cloud_ip_v2', 'AWS');
    expect(redis.delete).toHaveBeenCalledWith('cloud_ip_v2', 'GCP');
  });

  it('clear returns when there are no keys', async () => {
    const redis = mockRedis();
    const store = new RedisCloudIpStore(redis as never);
    await store.clear();
    expect(redis.delete).not.toHaveBeenCalled();
  });

  it('clear skips keys without a provider suffix', async () => {
    const redis = mockRedis();
    vi.mocked(redis.keys).mockResolvedValue(['prefix:cloud_ip_v2:']);
    const store = new RedisCloudIpStore(redis as never);
    await store.clear();
    expect(redis.delete).not.toHaveBeenCalled();
  });

  it('a custom key prefix is respected', async () => {
    const redis = mockRedis();
    const store = new RedisCloudIpStore(redis as never, 'custom_prefix');
    await store.set('AWS', new Set(['10.0.0.0/8']), null);
    expect(redis.setKey).toHaveBeenCalledWith(
      'custom_prefix', 'AWS', '["10.0.0.0/8"]', null,
    );
  });
});

describe('cached entry encoding (reference _encode_cached/_decode_cached)', () => {
  it('entries without regions round-trip as bare CIDRs', async () => {
    const encoded = encodeCachedEntries(['10.0.0.0/8'], new Map());
    expect(encoded).toEqual(new Set(['10.0.0.0/8']));
    const [ranges, regions] = decodeCachedEntries(encoded);
    expect(ranges).toEqual(new Set(['10.0.0.0/8']));
    expect(regions.size).toBe(0);
  });

  it('entries carry region annotations through the | suffix', async () => {
    const encoded = encodeCachedEntries(
      ['203.0.113.0/24'], new Map([['203.0.113.0/24', 'us-east']]),
    );
    expect(encoded).toEqual(new Set(['203.0.113.0/24|us-east']));
    const [ranges, regions] = decodeCachedEntries(encoded);
    expect(ranges).toEqual(new Set(['203.0.113.0/24']));
    expect(regions.get('203.0.113.0/24')).toBe('us-east');
  });
});
