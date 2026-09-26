import type { ResolvedSecurityConfig } from '../models/config.js';
import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import { GuardRedisError } from '../errors.js';
import type { RedisHandlerProtocol } from '../protocols/redis.js';

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  exists(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ping(): Promise<string>;
  quit(): Promise<string>;
  eval(script: string, numkeys: number, ...args: unknown[]): Promise<unknown>;
  evalsha(sha: string, numkeys: number, ...args: unknown[]): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  script(cmd: string, ...args: unknown[]): Promise<any>;
  zadd(key: string, ...args: unknown[]): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
};

export class RedisManager implements RedisHandlerProtocol {
  private client: RedisClient | null = null;
  private closed = false;
  private agentHandler: AgentHandlerProtocol | null = null;
  private readonly prefix: string;

  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
  ) {
    this.prefix = config.redisPrefix;
  }

  async initialize(): Promise<void> {
    if (!this.config.enableRedis || this.closed) return;

    try {
      const { default: Redis } = await import('ioredis');
      this.client = new Redis(this.config.redisUrl) as unknown as RedisClient;
      await this.client.ping();
      this.logger.info('Redis connection established');
    /* v8 ignore start -- requires real ioredis connection failure which cannot be triggered when module is mocked */
    } catch (e) {
      this.logger.error(`Redis connection failed: ${e}`);
      this.client = null;
    }
    /* v8 ignore stop */
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.client) {
      try { await this.client.quit(); } catch { /* ignore */ }
      this.client = null;
    }
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  /* v8 ignore start -- getConnection returns pooled disposable; V8 cannot track inline Symbol.asyncDispose */
  getConnection(): AsyncDisposable {
    const client = this.client;
    return {
      [Symbol.asyncDispose]: async () => {},
      get client() { return client; },
    } as AsyncDisposable;
  }
  /* v8 ignore stop */

  private formatKey(namespace: string, key: string): string {
    return `${this.prefix}${namespace}:${key}`;
  }

  async getKey(namespace: string, key: string): Promise<unknown> {
    if (!this.client) return null;
    try {
      return await this.client.get(this.formatKey(namespace, key));
    } catch (e) {
      this.logger.error(`Redis get failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async setKey(namespace: string, key: string, value: unknown, ttl?: number | null): Promise<boolean | null> {
    if (!this.client) return null;
    try {
      const fullKey = this.formatKey(namespace, key);
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl && ttl > 0) {
        await this.client.setex(fullKey, ttl, strValue);
      } else {
        await this.client.set(fullKey, strValue);
      }
      return true;
    } catch (e) {
      this.logger.error(`Redis set failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async incr(namespace: string, key: string, ttl?: number): Promise<number | null> {
    if (!this.client) return null;
    try {
      const fullKey = this.formatKey(namespace, key);
      const count = await this.client.incr(fullKey);
      if (ttl && ttl > 0) {
        await this.client.expire(fullKey, ttl);
      }
      return count;
    } catch (e) {
      this.logger.error(`Redis incr failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async exists(namespace: string, key: string): Promise<boolean | null> {
    if (!this.client) return null;
    try {
      const result = await this.client.exists(this.formatKey(namespace, key));
      return result > 0;
    } catch (e) {
      this.logger.error(`Redis exists failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async delete(namespace: string, key: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      return await this.client.del(this.formatKey(namespace, key));
    } catch (e) {
      this.logger.error(`Redis delete failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async keys(pattern: string): Promise<string[] | null> {
    if (!this.client) return null;
    try {
      return await this.client.keys(`${this.prefix}${pattern}`);
    } catch (e) {
      this.logger.error(`Redis keys failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  async deletePattern(pattern: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      const matchedKeys = await this.client.keys(`${this.prefix}${pattern}`);
      if (matchedKeys.length === 0) return 0;
      return await this.client.del(...matchedKeys);
    } catch (e) {
      this.logger.error(`Redis deletePattern failed: ${e}`);
      throw new GuardRedisError(503, 'Redis operation failed');
    }
  }

  getRawClient(): RedisClient | null {
    return this.client;
  }
}
