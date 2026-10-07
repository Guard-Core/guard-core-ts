import type { ResolvedSecurityConfig } from '../models/config.js';
import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import { GuardRedisError } from '../errors.js';
import type { RedisHandlerProtocol } from '../protocols/redis.js';

/* Reference EVENT_REDIS_CONNECTION / EVENT_REDIS_ERROR
   (guard_core/core/events/event_types.py) and the _REDIS_HANDLER_NAME the
   reference events carry. */
const REDIS_HANDLER_NAME = 'redis';

/**
 * The twin of _redact_redis_url (guard_core/handlers/redis_handler.py): drop
 * the userinfo from the authority so a password in redis_url never reaches an
 * agent event payload. Scheme, host, port, path, query and fragment survive.
 */
export function redactRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return 'unparseable_redis_url';
  }
}

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
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  disconnect(): void;
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
      const client = new Redis(this.config.redisUrl) as unknown as RedisClient;
      /* A connection failure must not surface as an unhandled 'error' event
         (ioredis retries in the background); initialize() reports the
         failure and the client below is torn down so no retrying orphan is
         left holding open handles. */
      client.on('error', () => {});
      try {
        await client.ping();
      } catch (e) {
        client.disconnect();
        throw e;
      }
      this.client = client;
      this.logger.info('Redis connection established');

      /* Reference EVENT_REDIS_CONNECTION on a successful initialize
         (guard_core/handlers/redis_handler.py). */
      await this.sendRedisEvent(
        'redis_connection', 'connection_established',
        'Redis connection successfully established',
        { redisUrl: redactRedisUrl(this.config.redisUrl) },
      );
    } catch (e) {
      this.logger.error(`Redis connection failed: ${e}`);
      this.client = null;

      /* Reference EVENT_REDIS_ERROR on a failed initialize. */
      await this.sendRedisEvent(
        'redis_error', 'connection_failed',
        `Redis connection failed: ${e}`,
        { redisUrl: redactRedisUrl(this.config.redisUrl), errorType: 'connection_error' },
      );
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.client) {
      try { await this.client.quit(); } catch { /* ignore */ }
      this.client = null;
      /* Reference EVENT_REDIS_CONNECTION on a graceful close. */
      await this.sendRedisEvent(
        'redis_connection', 'connection_closed',
        'Redis connection closed gracefully',
      );
    }
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  /* The twin of _send_redis_event (guard_core/handlers/redis_handler.py):
     system-scoped SecurityEvent with the handler name in the metadata;
     event dispatch failures never propagate. */
  private async sendRedisEvent(
    eventType: string,
    actionTaken: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.agentHandler) return;

    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress: 'system',
        actionTaken,
        reason,
        handlerName: REDIS_HANDLER_NAME,
        metadata,
      });
    } catch {
      /* never throw from event dispatch */
    }
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

  /* Shared operation-failure reporting (the reference get_connection /
     safe_operation catch paths): log, emit EVENT_REDIS_ERROR, then surface
     the GuardRedisError contract. */
  private async reportOperationError(operation: string, e: unknown): Promise<never> {
    this.logger.error(`Redis ${operation} failed: ${e}`);
    await this.sendRedisEvent(
      'redis_error', 'operation_failed',
      `Redis operation failed: ${e}`,
      { errorType: 'operation_error', operation },
    );
    throw new GuardRedisError(503, 'Redis operation failed');
  }

  async getKey(namespace: string, key: string): Promise<unknown> {
    if (!this.client) return null;
    try {
      return await this.client.get(this.formatKey(namespace, key));
    } catch (e) {
      throw await this.reportOperationError('get', e);
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
      throw await this.reportOperationError('set', e);
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
      throw await this.reportOperationError('incr', e);
    }
  }

  async exists(namespace: string, key: string): Promise<boolean | null> {
    if (!this.client) return null;
    try {
      const result = await this.client.exists(this.formatKey(namespace, key));
      return result > 0;
    } catch (e) {
      throw await this.reportOperationError('exists', e);
    }
  }

  async delete(namespace: string, key: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      return await this.client.del(this.formatKey(namespace, key));
    } catch (e) {
      throw await this.reportOperationError('delete', e);
    }
  }

  async keys(pattern: string): Promise<string[] | null> {
    if (!this.client) return null;
    try {
      return await this.client.keys(`${this.prefix}${pattern}`);
    } catch (e) {
      throw await this.reportOperationError('keys', e);
    }
  }

  async deletePattern(pattern: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      const matchedKeys = await this.client.keys(`${this.prefix}${pattern}`);
      if (matchedKeys.length === 0) return 0;
      return await this.client.del(...matchedKeys);
    } catch (e) {
      throw await this.reportOperationError('deletePattern', e);
    }
  }

  getRawClient(): RedisClient | null {
    return this.client;
  }
}
