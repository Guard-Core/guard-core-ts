import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisManager, redactRedisUrl } from '../../src/handlers/redis.js';
import { RateLimitManager } from '../../src/handlers/rate-limit.js';
import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { IPBanManager } from '../../src/handlers/ip-ban.js';
import { CloudHandler } from '../../src/handlers/cloud.js';
import { IPInfoManager } from '../../src/handlers/geoip.js';
import { SecurityHeadersManager } from '../../src/handlers/security-headers.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';

function capturingAgent(): { agent: AgentHandlerProtocol; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const agent = {
    async sendEvent(event: unknown) { events.push(event as Record<string, unknown>); },
    async sendMetric() {},
    async start() {},
    async stop() {},
    async flushBuffer() {},
    async getDynamicRules() { return null; },
    async healthCheck() { return true; },
    async initializeRedis() {},
  };
  return { agent: agent as unknown as AgentHandlerProtocol, events };
}

/* Fault-injectable maxmind mock for the geo_download_failure path. */
const maxmindState = { failOpen: false };

vi.mock('maxmind', () => ({
  open: async () => {
    if (maxmindState.failOpen) throw new Error('mmdb missing');
    throw new Error('real mmdb unavailable in unit tests');
  },
}));

const dynamicRulesPayload = (overrides: Record<string, unknown> = {}) => ({
  ruleId: 'rule-1',
  version: 7,
  timestamp: '2026-01-01T00:00:00.000Z',
  emergencyMode: false,
  emergencyWhitelist: [],
  ...overrides,
});

vi.mock('ioredis', () => {
  const state = { failPing: false, evalshaError: null as Error | null };
  function MockRedis() {
    return {
      get: vi.fn(() => Promise.resolve(null)),
      set: vi.fn(() => Promise.resolve('OK')),
      setex: vi.fn(() => Promise.resolve('OK')),
      incr: vi.fn(() => Promise.resolve(1)),
      expire: vi.fn(() => Promise.resolve(1)),
      exists: vi.fn(() => Promise.resolve(0)),
      del: vi.fn(() => Promise.resolve(1)),
      keys: vi.fn(() => Promise.resolve([])),
      ping: vi.fn(() => state.failPing ? Promise.reject(new Error('connect ECONNREFUSED')) : Promise.resolve('PONG')),
      quit: vi.fn(() => Promise.resolve('OK')),
      evalsha: vi.fn(() => state.evalshaError ? Promise.reject(state.evalshaError) : Promise.resolve(3)),
      eval: vi.fn(() => Promise.resolve(3)),
      zadd: vi.fn(() => Promise.resolve(1)),
      zremrangebyscore: vi.fn(() => Promise.resolve(1)),
      zcard: vi.fn(() => Promise.resolve(3)),
      script: vi.fn((_cmd: string, ..._args: unknown[]) => Promise.resolve('a'.repeat(40))),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  return { default: MockRedis, __mockState: state };
});

describe('redis_connection / redis_error events', () => {
  it('redacts credentials and flags unparseable urls', () => {
    expect(redactRedisUrl('redis://:secret@localhost:6379/0')).toBe('redis://localhost:6379/0');
    expect(redactRedisUrl('not a url at all')).toBe('unparseable_redis_url');
  });

  it('reports connection_established on initialize and connection_closed on close', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://:secret@localhost:6379/0' });
    const manager = new RedisManager(config, defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    await manager.initialize();
    await manager.close();
    expect(events[0]).toMatchObject({
      eventType: 'redis_connection',
      ipAddress: 'system',
      actionTaken: 'connection_established',
      reason: 'Redis connection successfully established',
      handlerName: 'redis',
      metadata: { redisUrl: 'redis://localhost:6379/0' },
    });
    expect(events[1]).toMatchObject({
      eventType: 'redis_connection',
      actionTaken: 'connection_closed',
      reason: 'Redis connection closed gracefully',
    });
  });

  it('reports connection_failed when the ping fails', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://localhost:6379/0' });
    const manager = new RedisManager(config, defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    const ioredis = (await import('ioredis')) as unknown as { __mockState: { failPing: boolean } };
    ioredis.__mockState.failPing = true;
    await manager.initialize();
    ioredis.__mockState.failPing = false;
    const error = events.find((e) => e['eventType'] === 'redis_error');
    expect(error).toMatchObject({
      actionTaken: 'connection_failed',
      metadata: { redisUrl: 'redis://localhost:6379/0', errorType: 'connection_error' },
    });
    // The success event must be absent.
    expect(events.find((e) => e['eventType'] === 'redis_connection')).toBeUndefined();
  });

  it('reports operation_failed for failing key operations and swallows dispatch errors', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: true, redisUrl: 'redis://localhost:6379/0' });
    const manager = new RedisManager(config, defaultLogger);
    const failingAgent = {
      async sendEvent(event: unknown) {
        if ((event as Record<string, unknown>)['eventType'] === 'redis_error') {
          throw new Error('transport down');
        }
      },
    } as unknown as AgentHandlerProtocol;
    await manager.initializeAgent(failingAgent);
    await manager.initialize();
    const client = manager.getRawClient();
    // Force the underlying get to fail.
    (client as unknown as { get: () => Promise<never> }).get = () => Promise.reject(new Error('boom'));
    await expect(manager.getKey('ns', 'key')).rejects.toThrow();
  });
});

describe('rate_limited + rate_limit_script_reloaded events', () => {
  it('emits rate_limited handler-direct when the tier trips', async () => {
    const manager = new RateLimitManager(defaultLogger, createTestConfig());
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    const request = createMockRequest();
    const createErr = async (code: number, msg: string) => {
      const response = {
        statusCode: code, headers: {} as Record<string, string>, body: null, bodyText: msg, setHeader: () => {},
      };
      return response as never;
    };
    let blocked = null;
    for (let i = 0; i < 12; i++) {
      blocked = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    }
    expect((blocked as unknown as { statusCode: number }).statusCode).toBe(429);
    expect(events[0]).toMatchObject({
      eventType: 'rate_limited',
      ipAddress: '10.0.0.1',
      actionTaken: 'request_blocked',
      reason: 'Rate limit exceeded: 11 requests in 60s window',
      handlerName: 'rate_limit',
      metadata: { requestCount: 11, rateLimit: 10, window: 60 },
    });
  });

  it('swallows rate_limited dispatch failures', async () => {
    const manager = new RateLimitManager(defaultLogger, createTestConfig());
    await manager.initializeAgent({
      async sendEvent() { throw new Error('down'); },
    } as unknown as AgentHandlerProtocol);
    const request = createMockRequest();
    const createErr = async (code: number) => ({
      statusCode: code, headers: {}, body: null, bodyText: '', setHeader: () => {},
    } as never);
    let blocked = null;
    for (let i = 0; i < 12; i++) {
      blocked = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    }
    expect((blocked as unknown as { statusCode: number }).statusCode).toBe(429);
  });

  it('recovers from NOSCRIPT and emits rate_limit_script_reloaded', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      enableRateLimiting: true,
      redisUrl: 'redis://localhost:6379/0',
    });
    const redis = new RedisManager(config, defaultLogger);
    await redis.initialize();
    const manager = new RateLimitManager(defaultLogger, config);
    const { agent, events } = capturingAgent();
    await manager.initializeRedis(redis);
    await manager.initializeAgent(agent);
    // Force the NOSCRIPT path.
    manager['rateLimitScriptSha'] = 'f'.repeat(40);
    const ioredis = (await import('ioredis')) as unknown as { __mockState: { evalshaError: Error | null } };
    const state = ioredis.__mockState;
    state.evalshaError = new Error('NOSCRIPT No matching script. Please use EVAL.');
    const request = createMockRequest();
    const createErr = async (code: number, msg: string) => ({
      statusCode: code, headers: {}, body: null, bodyText: msg, setHeader: () => {},
    } as never);
    const count = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    expect(count).toBeNull();
    state.evalshaError = null;
    // Second attempt with the same stale sha now recovers through reload + event.
    manager['rateLimitScriptSha'] = 'f'.repeat(40);
    const second = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    expect(second).toBeNull();

    // A non-NOSCRIPT error rethrows past the recovery arm into the fallback.
    state.evalshaError = new Error('READONLY You cannot write against a read only replica');
    manager['rateLimitScriptSha'] = 'f'.repeat(40);
    const third = await manager.checkRateLimit(request, '10.0.0.1', createErr, null, 10, 60);
    expect(third).toBeNull();
    state.evalshaError = null;
    const reload = events.find((e) => e['eventType'] === 'rate_limit_script_reloaded');
    expect(reload).toMatchObject({
      ipAddress: 'system',
      actionTaken: 'script_reloaded',
      reason: 'NOSCRIPT recovery: Lua script re-cached on Redis',
      handlerName: 'rate_limit',
      metadata: {},
    });
    redis['closed'] = true;
    redis['client'] = null;
  });

  it('stays silent without an agent handler on the reload path', async () => {
    const manager = new RateLimitManager(defaultLogger, createTestConfig());
    // No agent: emitScriptReloadedEvent returns early.
    await expect(manager['emitScriptReloadedEvent']()).resolves.toBeUndefined();
  });
});

describe('dynamic_rule_updated + emergency_mode_activated events', () => {
  it('emits updated, emergency lockdown and applied in reference order', async () => {
    const manager = new DynamicRuleManager(createTestConfig({ enableDynamicRules: false }), defaultLogger);
    const { agent, events } = capturingAgent();
    (agent as unknown as { getDynamicRules: () => Promise<unknown> }).getDynamicRules =
      async () => dynamicRulesPayload({
        emergencyMode: true,
        emergencyWhitelist: ['198.51.100.5', '198.51.100.6', '198.51.100.7', '198.51.100.8',
          '198.51.100.9', '198.51.100.10', '198.51.100.11', '198.51.100.12',
          '198.51.100.13', '198.51.100.14', '198.51.100.15'],
      });
    await manager.initializeAgent(agent);
    await manager.updateRules();
    expect(events.map((e) => e['eventType'])).toEqual([
      'dynamic_rule_updated', 'emergency_mode_activated', 'dynamic_rule_applied',
    ]);
    expect(events[0]).toMatchObject({
      ipAddress: 'system',
      actionTaken: 'rules_received',
      reason: 'Received updated rules rule-1 v7',
      handlerName: 'dynamic_rules',
      metadata: { ruleId: 'rule-1', version: 7, previousVersion: 0 },
    });
    expect(events[1]).toMatchObject({
      actionTaken: 'emergency_lockdown',
      reason: '[EMERGENCY MODE] activated via dynamic rules',
      metadata: { whitelistCount: 11, whitelist: events[1]['metadata']['whitelist'] },
    });
    expect((events[1]['metadata']['whitelist'] as string[]).length).toBe(10);
    expect(events[2]).toMatchObject({
      actionTaken: 'rules_updated',
      metadata: { emergencyMode: true, ipBans: 0, countryBlocks: 0 },
    });
  });

  it('fires the lockdown event only on the transition into emergency mode', async () => {
    const manager = new DynamicRuleManager(createTestConfig({ enableDynamicRules: false }), defaultLogger);
    const { agent, events } = capturingAgent();
    (agent as unknown as { getDynamicRules: () => Promise<unknown> }).getDynamicRules =
      async () => dynamicRulesPayload({ version: 8, emergencyMode: true, emergencyWhitelist: ['198.51.100.5'] });
    await manager.initializeAgent(agent);
    await manager.updateRules();
    await manager.updateRules();
    const lockdowns = events.filter((e) => e['eventType'] === 'emergency_mode_activated');
    expect(lockdowns.length).toBe(1);
  });

  it('swallows rule event dispatch failures', async () => {
    const manager = new DynamicRuleManager(createTestConfig({ enableDynamicRules: false }), defaultLogger);
    const failing = {
      async getDynamicRules() { return dynamicRulesPayload(); },
      async sendEvent() { throw new Error('down'); },
    } as unknown as AgentHandlerProtocol;
    await manager.initializeAgent(failing);
    await expect(manager.updateRules()).resolves.toBeUndefined();
    expect(manager.getCurrentRules()).not.toBeNull();
  });

  it('skips rule events when the handler disappears mid-flight', async () => {
    const manager = new DynamicRuleManager(createTestConfig({ enableDynamicRules: false }), defaultLogger);
    const { agent, events } = capturingAgent();
    const mutable = agent as unknown as { getDynamicRules: () => Promise<unknown> };
    mutable.getDynamicRules = async () => {
      manager['agentHandler'] = null;
      return dynamicRulesPayload();
    };
    await manager.initializeAgent(agent);
    await manager.updateRules();
    expect(events).toEqual([]);
  });
});

describe('ip_banned / ip_unbanned envelopes', () => {
  it('reports the reference ban contract', async () => {
    const manager = new IPBanManager(defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    await manager.banIp('1.2.3.4', 3600, 'threshold');
    await manager.unbanIp('1.2.3.4');
    expect(events[0]).toMatchObject({
      eventType: 'ip_banned',
      ipAddress: '1.2.3.4',
      actionTaken: 'banned',
      handlerName: 'ip_ban',
      metadata: { duration: 3600 },
    });
    expect(events[1]).toMatchObject({
      eventType: 'ip_unbanned',
      actionTaken: 'unbanned',
      reason: 'dynamic_rule_whitelist',
      handlerName: 'ip_ban',
      metadata: { action: 'unban' },
    });
  });

  it('swallows ban/unban dispatch failures', async () => {
    const manager = new IPBanManager(defaultLogger);
    await manager.initializeAgent({
      async sendEvent() { throw new Error('down'); },
    } as unknown as AgentHandlerProtocol);
    await expect(manager.banIp('1.2.3.4', 60, 'r')).resolves.toBe(true);
    await expect(manager.unbanIp('1.2.3.4')).resolves.toBeUndefined();
  });
});

describe('cloud_blocked direct event', () => {
  it('sends the handler-direct envelope', async () => {
    const handler = new CloudHandler(defaultLogger);
    const { agent, events } = capturingAgent();
    await handler.initializeAgent(agent);
    await handler.sendCloudDetectionEvent('1.2.3.4', 'AWS', '203.0.113.0/24');
    expect(events[0]).toMatchObject({
      eventType: 'cloud_blocked',
      ipAddress: '1.2.3.4',
      actionTaken: 'request_blocked',
      reason: 'IP belongs to blocked cloud provider: AWS',
      handlerName: 'cloud',
      metadata: { cloudProvider: 'AWS', network: '203.0.113.0/24' },
    });
  });

  it('defaults the action and swallows dispatch failures', async () => {
    const handler = new CloudHandler(defaultLogger);
    await handler.initializeAgent({
      async sendEvent() { throw new Error('down'); },
    } as unknown as AgentHandlerProtocol);
    await expect(handler.sendCloudDetectionEvent('1.2.3.4', 'AWS', '10.0.0.0/8')).resolves.toBeUndefined();
    // No agent: silent.
    const bare = new CloudHandler(defaultLogger);
    await expect(bare.sendCloudDetectionEvent('1.2.3.4', 'AWS', '10.0.0.0/8')).resolves.toBeUndefined();
  });
});

describe('geo_lookup_failed + country_blocked events', () => {
  it('reports database_download_failed on a failed initialize', async () => {
    maxmindState.failOpen = true;
    try {
      const manager = new IPInfoManager(defaultLogger);
      const { agent, events } = capturingAgent();
      await manager.initializeAgent(agent);
      await manager.initialize();
      expect(events[0]).toMatchObject({
        eventType: 'geo_lookup_failed',
        ipAddress: 'system',
        actionTaken: 'database_download_failed',
        reason: 'Failed to download IPInfo database: Error',
        handlerName: 'ipinfo',
        metadata: {},
      });
    } finally {
      maxmindState.failOpen = false;
    }
  });

  it('reports lookup_failed fire-and-forget when the reader throws', async () => {
    const manager = new IPInfoManager(defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    manager['reader'] = { get: () => { throw new Error('reader exploded'); } };
    expect(manager.getCountry('1.2.3.4')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events[0]).toMatchObject({
      eventType: 'geo_lookup_failed',
      ipAddress: '1.2.3.4',
      actionTaken: 'lookup_failed',
      reason: 'Geographic lookup failed: Error',
    });
  });

  it('checkCountryAccess emits country_blocked with the rule type', async () => {
    const manager = new IPInfoManager(defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    manager['getCountry'] = (): string | null => 'CN';

    const [blockedBlacklist] = await manager.checkCountryAccess('1.2.3.4', ['CN']);
    expect(blockedBlacklist).toBe(false);
    const [blockedWhitelist] = await manager.checkCountryAccess('1.2.3.4', [], ['US']);
    expect(blockedWhitelist).toBe(false);
    const [allowedCountry] = await manager.checkCountryAccess('1.2.3.4', ['RU'], ['CN']);
    expect(allowedCountry).toBe(true);

    manager['getCountry'] = (): string | null => null;
    const [noCountryNoWhitelist] = await manager.checkCountryAccess('1.2.3.4', ['CN']);
    expect(noCountryNoWhitelist).toBe(true);
    const [noCountryWhitelist] = await manager.checkCountryAccess('1.2.3.4', ['CN'], ['US']);
    expect(noCountryWhitelist).toBe(false);

    const blocked = events.filter((e) => e['eventType'] === 'country_blocked');
    expect(blocked.length).toBe(2);
    expect(blocked[0]).toMatchObject({
      ipAddress: '1.2.3.4',
      actionTaken: 'request_blocked',
      reason: 'Country CN is blocked',
      handlerName: 'ipinfo',
      metadata: { country: 'CN', ruleType: 'country_blacklist' },
    });
    expect(blocked[1]).toMatchObject({
      reason: 'Country CN not in allowed list',
      metadata: { country: 'CN', ruleType: 'country_whitelist' },
    });
  });

  it('stays silent without an agent handler', async () => {
    const manager = new IPInfoManager(defaultLogger);
    manager['getCountry'] = (): string | null => 'CN';
    const [blocked] = await manager.checkCountryAccess('1.2.3.4', ['CN']);
    expect(blocked).toBe(false);
  });
});

describe('security_headers_applied + csp_violation events', () => {
  let manager: SecurityHeadersManager;
  let events: Array<Record<string, unknown>>;

  beforeEach(async () => {
    manager = new SecurityHeadersManager(defaultLogger);
    const capture = capturingAgent();
    events = capture.events;
    await manager.initializeAgent(capture.agent);
  });

  it('emits security_headers_applied on a fresh build only', async () => {
    await manager.getHeaders('/api');
    expect(events[0]).toMatchObject({
      eventType: 'security_headers_applied',
      ipAddress: '',
      actionTaken: 'headers_added',
      handlerName: 'security_headers',
    });
    const meta = events[0]['metadata'] as Record<string, unknown>;
    expect(meta['path']).toBe('/api');
    expect(meta['hasCsp']).toBe(false);
    // Cache hit: no second event.
    events.length = 0;
    await manager.getHeaders('/api');
    expect(events).toEqual([]);
  });

  it('stays silent without a request path context', async () => {
    manager['agentHandler'] = null;
    await manager.getHeaders('/api');
    expect(events).toEqual([]);
  });

  it('validates a CSP report and emits csp_violation', async () => {
    const valid = await manager.validateCspReport({
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example/x.js',
        'source-file': 'https://example.com/app.js',
        'line-number': '42',
      },
    });
    expect(valid).toBe(true);
    expect(events[0]).toMatchObject({
      eventType: 'csp_violation',
      ipAddress: '',
      actionTaken: 'logged',
      handlerName: 'security_headers',
    });
    expect(events[0]['metadata']).toMatchObject({
      documentUri: 'https://example.com/page',
      violatedDirective: 'script-src',
      blockedUri: 'https://evil.example/x.js',
      sourceFile: 'https://example.com/app.js',
      lineNumber: 42,
    });
  });

  it('rejects malformed reports without emitting', async () => {
    const valid = await manager.validateCspReport({ 'csp-report': { 'document-uri': 'x' } });
    expect(valid).toBe(false);
    expect(events).toEqual([]);
  });

  it('renders a missing source-file as None and non-numeric line numbers as null', async () => {
    await manager.validateCspReport({
      'csp-report': {
        'document-uri': 'https://example.com/',
        'violated-directive': 'default-src',
        'blocked-uri': 'inline',
      },
    });
    expect(events[0]['metadata']).toMatchObject({ sourceFile: 'None', lineNumber: null });
  });

  it('swallows CSP dispatch failures', async () => {
    manager['agentHandler'] = {
      async sendEvent() { throw new Error('down'); },
    } as never;
    await expect(manager.validateCspReport({
      'csp-report': {
        'document-uri': 'https://example.com/',
        'violated-directive': 'default-src',
        'blocked-uri': 'inline',
      },
    })).resolves.toBe(true);
  });
});

describe('pattern_detected / pattern_added / pattern_removed events', () => {
  it('emits pattern_detected on a threat verdict', async () => {
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    const result = await manager.detect('<script>alert(1)</script>', '1.2.3.4', 'request_body');
    expect(result.isThreat).toBe(true);
    const event = events.find((e) => e['eventType'] === 'pattern_detected');
    expect(event).toBeDefined();
    expect(event).toMatchObject({
      ipAddress: '1.2.3.4',
      actionTaken: 'threat_detected',
      reason: 'Threat detected in request_body',
      handlerName: 'sus_patterns',
    });
    const meta = event?.['metadata'] as Record<string, unknown>;
    expect(meta['context']).toBe('request_body');
    expect(meta['detectionMethod']).toBe('enhanced');
    expect((meta['threatCategories'] as string[]).length).toBeGreaterThan(0);
  });

  it('emits pattern_added with the reference metadata', async () => {
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    await manager.addPattern('corpuspattern-[a-z]+');
    expect(events[0]).toMatchObject({
      eventType: 'pattern_added',
      ipAddress: 'system',
      actionTaken: 'pattern_added',
      reason: 'Custom pattern added to detection system',
      handlerName: 'sus_patterns',
      metadata: { pattern: 'corpuspattern-[a-z]+', patternType: 'custom', totalPatterns: 1 },
    });
  });

  it('emits pattern_removed only when the pattern was registered', async () => {
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const { agent, events } = capturingAgent();
    await manager.initializeAgent(agent);
    await manager.removePattern('never-there-[a-z]+');
    expect(events).toEqual([]);

    await manager.addPattern('corpuspattern-[a-z]+');
    events.length = 0;
    await manager.removePattern('corpuspattern-[a-z]+');
    expect(events[0]).toMatchObject({
      eventType: 'pattern_removed',
      actionTaken: 'pattern_removed',
      reason: 'Custom pattern removed from detection system',
      metadata: { patternType: 'custom', totalPatterns: 0 },
    });
  });

  it('swallows pattern event dispatch failures', async () => {
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    await manager.initializeAgent({
      async sendEvent() { throw new Error('down'); },
    } as unknown as AgentHandlerProtocol);
    await expect(manager.addPattern('corpuspattern-[a-z]+')).resolves.toBeUndefined();
    await expect(manager.removePattern('corpuspattern-[a-z]+')).resolves.toBeUndefined();
  });
});
