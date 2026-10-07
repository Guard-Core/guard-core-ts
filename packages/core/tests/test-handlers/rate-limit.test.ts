import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitManager } from '../../src/handlers/rate-limit.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockResponse } from '../helpers.js';
import type { GuardRequest, GuardRequestState } from '../../src/protocols/request.js';
import type { GuardResponse } from '../../src/protocols/response.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';

function createRateLimitRequest(ip: string, path = '/api/test'): GuardRequest {
  return {
    urlPath: path,
    urlScheme: 'https',
    urlFull: `https://example.com${path}`,
    urlReplaceScheme: (s: string) => `${s}://example.com${path}`,
    method: 'GET',
    clientHost: ip,
    headers: { 'user-agent': 'TestAgent/1.0' },
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: {} as GuardRequestState,
    scope: {},
  };
}

async function createError(statusCode: number, message: string): Promise<GuardResponse> {
  return {
    statusCode,
    headers: {},
    setHeader() {},
    body: new TextEncoder().encode(message),
    bodyText: message,
  };
}

function createMockAgent(): AgentHandlerProtocol {
  return {
    sendEvent: vi.fn().mockResolvedValue(undefined),
    sendMetric: vi.fn().mockResolvedValue(undefined),
    initializeRedis: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    flushBuffer: vi.fn().mockResolvedValue(undefined),
    getDynamicRules: vi.fn().mockResolvedValue(null),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    getKey: vi.fn(async (_ns: string, key: string) => store.get(key) ?? null),
    setKey: vi.fn(async (_ns: string, key: string, value: unknown) => { store.set(key, String(value)); return true; }),
    delete: vi.fn(async (_ns: string, key: string) => { store.delete(key); return 1; }),
    deletePattern: vi.fn(async () => 0),
    keys: vi.fn(async () => []),
    initialize: vi.fn(),
    getRawClient: vi.fn(() => ({
      script: vi.fn().mockResolvedValue('sha'),
      evalsha: vi.fn().mockResolvedValue(1),
      zadd: vi.fn(),
      zremrangebyscore: vi.fn(),
      zcard: vi.fn().mockResolvedValue(1),
      eval: vi.fn(),
    })),
    getConnection: vi.fn(),
    initializeAgent: vi.fn(),
    prefix: 'guard_core:',
  };
}

describe('RateLimitManager', () => {
  let manager: RateLimitManager;

  beforeEach(async () => {
    manager = new RateLimitManager(defaultLogger);
  });

  it('allows requests within rate limit', async () => {
    const request = createRateLimitRequest('1.2.3.4');
    const result = await manager.checkRateLimit(request, '1.2.3.4', createError, null, 10, 60);
    expect(result).toBeNull();
  });

  it('blocks after exceeding rate limit', async () => {
    const request = createRateLimitRequest('1.2.3.4');

    for (let i = 0; i < 11; i++) {
      await manager.checkRateLimit(request, '1.2.3.4', createError, null, 5, 60);
    }

    const result = await manager.checkRateLimit(request, '1.2.3.4', createError, null, 5, 60);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(429);
  });

  it('tracks different IPs independently', async () => {
    const req1 = createRateLimitRequest('1.1.1.1');
    const req2 = createRateLimitRequest('2.2.2.2');

    for (let i = 0; i < 6; i++) {
      await manager.checkRateLimit(req1, '1.1.1.1', createError, null, 5, 60);
    }

    const result1 = await manager.checkRateLimit(req1, '1.1.1.1', createError, null, 5, 60);
    const result2 = await manager.checkRateLimit(req2, '2.2.2.2', createError, null, 5, 60);

    expect(result1).not.toBeNull();
    expect(result2).toBeNull();
  });

  it('tracks different endpoints independently', async () => {
    for (let i = 0; i < 6; i++) {
      await manager.checkRateLimit(createRateLimitRequest('1.1.1.1', '/a'), '1.1.1.1', createError, '/a', 5, 60);
    }

    const resultA = await manager.checkRateLimit(createRateLimitRequest('1.1.1.1', '/a'), '1.1.1.1', createError, '/a', 5, 60);
    const resultB = await manager.checkRateLimit(createRateLimitRequest('1.1.1.1', '/b'), '1.1.1.1', createError, '/b', 5, 60);

    expect(resultA).not.toBeNull();
    expect(resultB).toBeNull();
  });

  it('resets all rate limit data', async () => {
    const request = createRateLimitRequest('1.2.3.4');
    for (let i = 0; i < 10; i++) {
      await manager.checkRateLimit(request, '1.2.3.4', createError, null, 5, 60);
    }
    await manager.reset();

    const result = await manager.checkRateLimit(request, '1.2.3.4', createError, null, 5, 60);
    expect(result).toBeNull();
  });
});

describe('RateLimitManager handleRateLimitExceeded agent path', () => {
  let manager: RateLimitManager;
  let agent: AgentHandlerProtocol;

  beforeEach(() => {
    manager = new RateLimitManager(defaultLogger);
    agent = createMockAgent();
  });

  it('answers the tripped tier with 429 Too many requests and Retry-After', async () => {
    await manager.initializeAgent(agent);

    const createErr = async (code: number, msg: string) => createMockResponse(code, msg);
    const request = createRateLimitRequest('10.0.0.1');

    let blocked: ReturnType<typeof createMockResponse> | null = null;
    for (let i = 0; i < 12; i++) {
      blocked = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    }

    expect(blocked).not.toBeNull();
    expect(blocked!.statusCode).toBe(429);
    expect(blocked!.bodyText).toBe('Too many requests');
    expect(blocked!.headers['Retry-After']).toBe('60');
    /* The reference emits the rate_limited agent event handler-direct
       (guard_core/handlers/ratelimit_handler.py _send_rate_limit_event). */
    expect(agent.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'rate_limited',
        ipAddress: '10.0.0.1',
        actionTaken: 'request_blocked',
        reason: 'Rate limit exceeded: 11 requests in 60s window',
        handlerName: 'rate_limit',
        metadata: { requestCount: 11, rateLimit: 10, window: 60 },
      }),
    );
    expect(agent.sendEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'rate_limit_exceeded',
        ipAddress: '10.0.0.1',
      }),
    );
  });
});

describe('RateLimitManager with Redis', () => {
  it('initializes Redis with Lua script', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const redis = createMockRedis();
    await manager.initializeRedis(redis as never);
    expect(redis.getRawClient).toHaveBeenCalled();
  });

  it('uses Redis for rate limit counting', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const redis = createMockRedis();
    await manager.initializeRedis(redis as never);

    const req = createRateLimitRequest('1.2.3.4');
    const result = await manager.checkRateLimit(
      req, '1.2.3.4',
      async (code, msg) => createMockResponse(code, msg),
      null, 100, 60,
    );
    expect(result).toBeNull();
  });

  it('blocked response carries the tripped tier window in Retry-After', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const agent = { sendEvent: vi.fn() };
    await manager.initializeAgent(agent as never);

    const req = createRateLimitRequest('1.2.3.4');
    let blocked: ReturnType<typeof createMockResponse> | null = null;
    for (let i = 0; i < 6; i++) {
      blocked = await manager.checkRateLimit(
        req, '1.2.3.4',
        async (code: number, msg: string) => createMockResponse(code, msg),
        null, 3, 60,
      );
    }
    expect(blocked).not.toBeNull();
    expect(blocked!.statusCode).toBe(429);
    expect(blocked!.headers['Retry-After']).toBe('60');
    expect(agent.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'rate_limited',
        handlerName: 'rate_limit',
      }),
    );
  });

  it('reset clears Redis data', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const redis = createMockRedis();
    await manager.initializeRedis(redis as never);
    await manager.reset();
    expect(redis.deletePattern).toHaveBeenCalled();
  });
});

describe('RateLimitManager Lua script failure path', () => {
  it('handles script load failure gracefully', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const mockRedis = {
      getRawClient: () => ({ script: vi.fn().mockRejectedValue(new Error('NOSCRIPT')) }),
      deletePattern: vi.fn(),
    };
    await manager.initializeRedis(mockRedis as never);
  });

  it('in-memory timestamp cleanup (validIndex > 0)', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const req = createRateLimitRequest('1.1.1.1');
    const createErr = async (c: number, m: string) => createMockResponse(c, m);

    await manager.checkRateLimit(req, '1.1.1.1', createErr, '/path', 100, 1);
    await new Promise((r) => setTimeout(r, 10));
    await manager.checkRateLimit(req, '1.1.1.1', createErr, '/path', 100, 0.001);
  });

  it('Lua SHA fallback to manual pipeline', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const client = {
      evalsha: vi.fn().mockRejectedValue(new Error('NOSCRIPT')),
      zadd: vi.fn().mockResolvedValue(1),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue('OK'),
      script: vi.fn().mockResolvedValue('sha'),
    };
    const mockRedis = {
      getRawClient: () => client,
      deletePattern: vi.fn(),
      prefix: 'guard:',
    };
    await manager.initializeRedis(mockRedis as never);

    const req = createRateLimitRequest('2.2.2.2');
    await manager.checkRateLimit(req, '2.2.2.2', async (c, m) => createMockResponse(c, m), '/api', 100, 60);
  });

  it('falls back to manual pipeline when evalsha throws', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const client = {
      script: vi.fn().mockResolvedValue('sha123'),
      evalsha: vi.fn().mockRejectedValue(new Error('NOSCRIPT')),
      zadd: vi.fn().mockResolvedValue(1),
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(2),
      eval: vi.fn().mockResolvedValue('OK'),
    };
    const redis = {
      getRawClient: () => client,
      deletePattern: vi.fn(),
      prefix: 'guard:',
    };
    Object.defineProperty(redis, 'prefix', { value: 'guard:', writable: false });
    await manager.initializeRedis(redis as never);

    const req: GuardRequest = {
      urlPath: '/api', urlScheme: 'https', urlFull: 'https://x/api',
      urlReplaceScheme: () => '', method: 'GET', clientHost: '5.5.5.5',
      headers: {}, queryParams: {},
      body: async () => new Uint8Array(0),
      state: {} as GuardRequestState, scope: {},
    };

    const result = await manager.checkRateLimit(
      req, '5.5.5.5', async (c, m) => createMockResponse(c, m), '/api', 100, 60,
    );
    expect(client.evalsha).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('splices old timestamps when validIndex > 0', async () => {
    const manager = new RateLimitManager(defaultLogger);
    const req: GuardRequest = {
      urlPath: '/x', urlScheme: 'https', urlFull: 'https://x/x',
      urlReplaceScheme: () => '', method: 'GET', clientHost: '6.6.6.6',
      headers: {}, queryParams: {},
      body: async () => new Uint8Array(0),
      state: {} as GuardRequestState, scope: {},
    };

    await manager.checkRateLimit(req, '6.6.6.6', async (c, m) => createMockResponse(c, m), '/x', 1000, 0.001);
    await new Promise((r) => setTimeout(r, 20));
    await manager.checkRateLimit(req, '6.6.6.6', async (c, m) => createMockResponse(c, m), '/x', 1000, 0.001);
  });
});
