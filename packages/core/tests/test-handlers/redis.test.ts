import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisManager } from '../../src/handlers/redis.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { GuardRedisError } from '../../src/errors.js';

vi.mock('ioredis', () => {
  const store = new Map<string, string>();
  function MockRedis() { return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve('OK'); }),
    setex: vi.fn((key: string, _ttl: number, value: string) => { store.set(key, value); return Promise.resolve('OK'); }),
    incr: vi.fn((key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    exists: vi.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    del: vi.fn((...keys: string[]) => {
      let count = 0;
      for (const k of keys) { if (store.delete(k)) count++; }
      return Promise.resolve(count);
    }),
    keys: vi.fn((pattern: string) => {
      /* Strip every wildcard: replace('*') left a stray literal '*' inside
         compound patterns like 'ns:a*:b', dead-ending the prefix (CodeQL
         js/incomplete-sanitization). */
      const prefix = pattern.replaceAll('*', '');
      const matches = [...store.keys()].filter((k) => k.startsWith(prefix));
      return Promise.resolve(matches);
    }),
    ping: vi.fn(() => Promise.resolve('PONG')),
    quit: vi.fn(() => Promise.resolve('OK')),
    script: vi.fn(() => Promise.resolve('sha123')),
    on: vi.fn(),
    disconnect: vi.fn(),
  }; }
  return { default: MockRedis };
});

describe('RedisManager', () => {
  let manager: RedisManager;

  beforeEach(async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://localhost:6379' });
    manager = new RedisManager(config, defaultLogger);
    await manager.initialize();
  });

  it('initializes and pings', () => {
    expect(manager.getRawClient()).not.toBeNull();
  });

  it('getKey returns value', async () => {
    await manager.setKey('test', 'key1', 'value1');
    const result = await manager.getKey('test', 'key1');
    expect(result).toBe('value1');
  });

  it('setKey with TTL', async () => {
    const result = await manager.setKey('test', 'ttlkey', 'val', 60);
    expect(result).toBe(true);
  });

  it('setKey without TTL', async () => {
    const result = await manager.setKey('test', 'nttlkey', 'val');
    expect(result).toBe(true);
  });

  it('setKey serializes non-string values', async () => {
    const result = await manager.setKey('test', 'json', { foo: 'bar' });
    expect(result).toBe(true);
  });

  it('delete removes key', async () => {
    await manager.setKey('test', 'delme', 'val');
    const result = await manager.delete('test', 'delme');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('exists checks key presence', async () => {
    await manager.setKey('test', 'exists-key', 'val');
    expect(await manager.exists('test', 'exists-key')).toBe(true);
  });

  it('exists returns false for missing key', async () => {
    expect(await manager.exists('test', 'nonexistent')).toBe(false);
  });

  it('incr increments counter', async () => {
    const result = await manager.incr('test', 'counter');
    expect(result).toBe(1);
    const result2 = await manager.incr('test', 'counter');
    expect(result2).toBe(2);
  });

  it('incr with TTL', async () => {
    const result = await manager.incr('test', 'counter-ttl', 60);
    expect(result).toBe(1);
  });

  it('keys returns matching keys', async () => {
    await manager.setKey('ns', 'a', '1');
    await manager.setKey('ns', 'b', '2');
    const result = await manager.keys('ns:*');
    expect(result).not.toBeNull();
  });

  it('keys with multiple wildcards strips every star from the match prefix', async () => {
    await manager.setKey('ns', 'a', '1');
    await manager.setKey('ns', 'b', '2');
    /* The mock approximates globs by startsWith(pattern minus '*' chars);
       replace('*') kept a stray star in multi-wildcard patterns and matched
       nothing. */
    const result = await manager.keys('*ns*');
    expect(result).toHaveLength(2);
  });

  it('deletePattern removes matching keys', async () => {
    await manager.setKey('dp', 'x', '1');
    const result = await manager.deletePattern('dp:*');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('close closes connection', async () => {
    await manager.close();
    expect(await manager.getKey('test', 'any')).toBeNull();
  });

  it('initializeAgent sets agent', async () => {
    await manager.initializeAgent({ sendEvent: vi.fn() } as never);
  });

  it('getConnection returns disposable', () => {
    const conn = manager.getConnection();
    expect(conn).toBeDefined();
  });

  it('returns null when Redis disabled', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const disabled = new RedisManager(config, defaultLogger);
    await disabled.initialize();
    expect(disabled.getRawClient()).toBeNull();
    expect(await disabled.getKey('ns', 'key')).toBeNull();
    expect(await disabled.setKey('ns', 'key', 'val')).toBeNull();
    expect(await disabled.delete('ns', 'key')).toBeNull();
    expect(await disabled.keys('*')).toBeNull();
    expect(await disabled.deletePattern('*')).toBeNull();
    expect(await disabled.incr('ns', 'key')).toBeNull();
    expect(await disabled.exists('ns', 'key')).toBeNull();
  });
});

describe('RedisManager error handling', () => {
  it('getKey raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      get: vi.fn().mockRejectedValue(new Error('connection lost')),
    };


    await expect(manager.getKey('ns', 'key')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('setKey raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      setex: vi.fn().mockRejectedValue(new Error('write fail')),
      set: vi.fn().mockRejectedValue(new Error('write fail')),
    };


    await expect(manager.setKey('ns', 'key', 'val', 60)).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('delete raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      del: vi.fn().mockRejectedValue(new Error('del fail')),
    };


    await expect(manager.delete('ns', 'key')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('keys raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      keys: vi.fn().mockRejectedValue(new Error('keys fail')),
    };


    await expect(manager.keys('pattern')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('deletePattern raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      keys: vi.fn().mockRejectedValue(new Error('keys fail')),
    };


    await expect(manager.deletePattern('pattern:*')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('deletePattern returns 0 for empty key list', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      keys: vi.fn().mockResolvedValue([]),
    };

    const result = await manager.deletePattern('empty:*');
    expect(result).toBe(0);
  });

  it('incr raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      incr: vi.fn().mockRejectedValue(new Error('incr fail')),
    };


    await expect(manager.incr('ns', 'key')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('exists raises GuardRedisError on error', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);

    (manager as unknown as Record<string, unknown>)['client'] = {
      exists: vi.fn().mockRejectedValue(new Error('exists fail')),
    };


    await expect(manager.exists('ns', 'key')).rejects.toBeInstanceOf(GuardRedisError);
  });

  it('close handles already closed gracefully', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true });
    const manager = new RedisManager(config, defaultLogger);
    await manager.close();
    await manager.close();
  });

  it('formatKey uses prefix', () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisPrefix: 'test:' });
    const manager = new RedisManager(config, defaultLogger);
    const key = (manager as unknown as Record<string, (...args: string[]) => string>)['formatKey']('ns', 'key');
    expect(key).toBe('test:ns:key');
  });
});
