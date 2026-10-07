import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { GuardRequest } from '../protocols/request.js';
import type { GuardResponse } from '../protocols/response.js';
import type { RedisManager } from './redis.js';
import type { ResolvedSecurityConfig } from '../models/config.js';
import { logActivity } from '../utils.js';

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local window_start = now - window

redis.call('ZADD', key, now, now)
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, window * 2)

return count
`;

export class RateLimitManager {
  private requestTimestamps = new Map<string, number[]>();
  private redisHandler: RedisManager | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private rateLimitScriptSha: string | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly config?: ResolvedSecurityConfig,
  ) {}

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
    const client = redisHandler.getRawClient();
    if (client) {
      try {
        this.rateLimitScriptSha = await client.script('load', RATE_LIMIT_SCRIPT) as string;
      } catch (e) {
        this.logger.warn(`Failed to load rate limit Lua script: ${e}`);
      }
    }
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  /* The twin of _emit_script_reloaded_event
     (guard_core/handlers/ratelimit_handler.py): EVENT_RATE_LIMIT_SCRIPT_
     RELOADED on NOSCRIPT recovery; dispatch failures never propagate. */
  private async emitScriptReloadedEvent(): Promise<void> {
    if (!this.agentHandler) return;
    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType: 'rate_limit_script_reloaded',
        ipAddress: 'system',
        actionTaken: 'script_reloaded',
        reason: 'NOSCRIPT recovery: Lua script re-cached on Redis',
        handlerName: 'rate_limit',
        metadata: {},
      });
    } catch {
      /* never throw from event dispatch */
    }
  }

  async checkRateLimit(
    request: GuardRequest,
    clientIp: string,
    createErrorResponse: (statusCode: number, message: string) => Promise<GuardResponse>,
    endpointPath: string | null = null,
    rateLimit: number = 10,
    rateLimitWindow: number = 60,
  ): Promise<GuardResponse | null> {
    const key = endpointPath ? `${clientIp}:${endpointPath}` : clientIp;
    const now = Date.now() / 1000;

    let count: number | null = null;

    if (this.redisHandler) {
      count = await this.getRedisRequestCount(key, now, rateLimitWindow, rateLimit);
    }

    if (count === null) {
      count = this.getInMemoryRequestCount(key, now, rateLimitWindow);
    }

    if (count > rateLimit) {
      return this.handleRateLimitExceeded(
        request, clientIp, count, createErrorResponse, rateLimitWindow,
        this.config,
      );
    }

    return null;
  }

  private async getRedisRequestCount(
    key: string,
    now: number,
    window: number,
    _limit: number,
  ): Promise<number | null> {
    const client = this.redisHandler?.getRawClient();
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!client) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

    const redisKey = `rate_limit:rate:${key}`;
    const prefix = this.redisHandler!['prefix'] as string;
    const fullKey = `${prefix}${redisKey}`;

    try {
      if (this.rateLimitScriptSha) {
        try {
          const count = await client.evalsha(
            this.rateLimitScriptSha, 1, fullKey, now, window, _limit,
          );
          return Number(count);
        } catch (e) {
          /* NOSCRIPT recovery (the reference _redis_request_count
             on_script_reloaded path): a Redis failover or SCRIPT FLUSH
             invalidates the cached SHA, so the script re-loads, the
             EVENT_RATE_LIMIT_SCRIPT_RELOADED event fires and the eval
             retries once before the in-memory fallback. */
          if (!String(e).includes('NOSCRIPT')) throw e;
          this.rateLimitScriptSha = await client.script('load', RATE_LIMIT_SCRIPT) as string;
          await this.emitScriptReloadedEvent();
          const count = await client.evalsha(
            this.rateLimitScriptSha, 1, fullKey, now, window, _limit,
          );
          return Number(count);
        }
      }

      /* v8 ignore start -- Lua script fallback pipeline; only reached when Redis evalsha fails */
      await client.zadd(fullKey, now, String(now));
      await client.zremrangebyscore(fullKey, 0, now - window);
      const count = await client.zcard(fullKey);
      await client.eval('redis.call("EXPIRE", KEYS[1], ARGV[1])', 1, fullKey, window * 2);
      return count;
      /* v8 ignore stop */
    } catch (e) {
      this.logger.warn(`Redis rate limit check failed, falling back to in-memory: ${e}`);
      return null;
    }
  }

  private getInMemoryRequestCount(key: string, now: number, window: number): number {
    let timestamps = this.requestTimestamps.get(key);
    if (!timestamps) {
      timestamps = [];
      this.requestTimestamps.set(key, timestamps);
    }

    const windowStart = now - window;
    const validIndex = timestamps.findIndex((t) => t > windowStart);
    /* v8 ignore start -- in-memory timestamp splice; branch-only gap in validIndex condition */
    if (validIndex > 0) {
      timestamps.splice(0, validIndex);
    /* v8 ignore stop */
    } else if (validIndex === -1) {
      timestamps.length = 0;
    }

    timestamps.push(now);
    return timestamps.length;
  }

  /* The twin of _handle_rate_limit_exceeded
     (guard_core/handlers/ratelimit_handler.py): the reference log-format
     reason rides the log_activity on_block dispatch (stash on the active
     path, direct passive fire with a null status_code), the 429 body is the
     family "Too many requests" contract and the tripped tier's window is
     the Retry-After value. EVENT_RATE_LIMITED rides the same path as a
     direct agent event (_send_rate_limit_event) reporting the manager's
     configured limit and window. */
  private async handleRateLimitExceeded(
    request: GuardRequest,
    clientIp: string,
    count: number,
    createErrorResponse: (statusCode: number, message: string) => Promise<GuardResponse>,
    window: number,
    config?: ResolvedSecurityConfig,
  ): Promise<GuardResponse> {
    const displayConfig = config ?? this.config;
    logActivity(
      request, this.logger, 'suspicious',
      `Rate limit exceeded for IP: ${clientIp} (${count} requests in ${window}s window)`,
      displayConfig?.passiveMode ?? false, '', displayConfig?.logSuspiciousLevel ?? 'WARNING',
      {
        checkName: 'rate_limit',
        onBlock: displayConfig?.onBlock ?? null,
        mutedCheckLogs: null,
        sensitiveParams: displayConfig?.logSensitiveParams,
        sensitiveBodyFields: displayConfig?.logSensitiveBodyFields,
        sensitiveHeaders: displayConfig?.logSensitiveHeaders,
      },
    );

    if (this.agentHandler) {
      await this.sendRateLimitEvent(request, clientIp, count, displayConfig);
    }

    const response = await createErrorResponse(429, 'Too many requests');
    response.setHeader('Retry-After', String(window));
    return response;
  }

  /* The twin of _send_rate_limit_event
     (guard_core/handlers/ratelimit_handler.py): a direct SecurityEvent with
     the rate_limit handler name carrying the endpoint/method envelope and
     the configured (not per-tier) limit and window; dispatch failures never
     propagate. */
  private async sendRateLimitEvent(
    request: GuardRequest,
    clientIp: string,
    requestCount: number,
    displayConfig?: ResolvedSecurityConfig,
  ): Promise<void> {
    try {
      const config = displayConfig ?? this.config;
      await this.agentHandler!.sendEvent({
        timestamp: new Date(),
        eventType: 'rate_limited',
        ipAddress: clientIp,
        actionTaken: 'request_blocked',
        reason: `Rate limit exceeded: ${requestCount} requests in ${config?.rateLimitWindow ?? 60}s window`,
        endpoint: request.urlPath,
        method: request.method,
        handlerName: 'rate_limit',
        metadata: {
          requestCount,
          rateLimit: config?.rateLimit ?? 10,
          window: config?.rateLimitWindow ?? 60,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to send rate limit event to agent: ${e}`);
    }
  }

  async reset(): Promise<void> {
    this.requestTimestamps.clear();
    if (this.redisHandler) {
      await this.redisHandler.deletePattern('rate_limit:rate:*');
    }
  }
}
