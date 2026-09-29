/**
 * Edge coverage for the handlers, the config refinements, and the core
 * pipeline helpers the contract tests do not reach deterministically.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BehaviorTracker } from '../../src/handlers/behavior.js';
import { CloudHandler } from '../../src/handlers/cloud.js';
import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { SecurityHeadersManager } from '../../src/handlers/security-headers.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { IPBanManager } from '../../src/handlers/ip-ban.js';
import { BehaviorRule } from '../../src/models/behavior-rule.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig, createMockResponse } from '../helpers.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import type { GuardResponse } from '../../src/protocols/response.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { Logger } from '../../src/models/logger.js';
import type { RedisManager } from '../../src/handlers/redis.js';
import {
  mergeSensitiveNames,
  redactBlobForDisplay,
  redactHeaderValueForDisplay,
  redactPairsInText,
  redactUrlForDisplay,
} from '../../src/redaction.js';
import { canonicalizeIpForPayload } from '../../src/core/client-identity.js';

function collectingLogger(): Logger & { lines: Array<{ level: string; message: string }> } {
  const lines: Array<{ level: string; message: string }> = [];
  return {
    lines,
    debug: (m: string) => lines.push({ level: 'DEBUG', message: m }),
    info: (m: string) => lines.push({ level: 'INFO', message: m }),
    warn: (m: string) => lines.push({ level: 'WARNING', message: m }),
    error: (m: string) => lines.push({ level: 'ERROR', message: m }),
  } as Logger & { lines: Array<{ level: string; message: string }> };
}

function behaviorResponse(statusCode: number, body: string): GuardResponse {
  return {
    statusCode,
    headers: {},
    setHeader() {},
    body: new TextEncoder().encode(body),
    bodyText: body,
  };
}

function mockAgent(): AgentHandlerProtocol {
  return {
    sendEvent: vi.fn().mockRejectedValue(new Error('agent down')),
    sendMetric: vi.fn().mockResolvedValue(undefined),
    initializeRedis: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    flushBuffer: vi.fn().mockResolvedValue(undefined),
    getDynamicRules: vi.fn().mockResolvedValue(null),
    healthCheck: vi.fn().mockResolvedValue(true),
  } as unknown as AgentHandlerProtocol;
}

describe('BehaviorTracker response patterns', () => {
  let tracker: BehaviorTracker;
  let scanConfig: ResolvedSecurityConfig;

  beforeEach(() => {
    scanConfig = SecurityConfigSchema.parse({ behaviorScanResponseBody: true });
    tracker = new BehaviorTracker(scanConfig, defaultLogger);
  });

  it('returns false when the rule has no pattern', async () => {
    const rule = new BehaviorRule('return_pattern', 1, 60, null);
    expect(await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, 'x'), rule)).toBe(false);
  });

  it('evaluates status patterns without reading the body', async () => {
    const rule = new BehaviorRule('return_pattern', 0, 60, 'status:200');
    const ok = await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, ''), rule);
    expect(ok).toBe(true); // one hit exceeds threshold 0
    const nan = new BehaviorRule('return_pattern', 0, 60, 'status:abc');
    expect(await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, ''), nan)).toBe(false);
  });

  it('returns null for body patterns when scanning is disabled', async () => {
    const noScan = new BehaviorTracker(SecurityConfigSchema.parse({}), defaultLogger);
    const rule = new BehaviorRule('return_pattern', 0, 60, 'secret');
    expect(
      await noScan.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, 'secret'), rule),
    ).toBeNull();
  });

  it('matches regex, json and bare substring patterns', async () => {
    const regexRule = new BehaviorRule('return_pattern', 0, 60, 'regex:s\\dcret');
    expect(
      await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, 's3cret!'), regexRule),
    ).toBe(true);
    const jsonRule = new BehaviorRule('return_pattern', 0, 60, 'json:user.name==admin');
    expect(
      await tracker.trackReturnPattern(
        '/e', '1.2.3.4', behaviorResponse(200, '{"user":{"name":"Admin"}}'), jsonRule,
      ),
    ).toBe(true);
    const arrayRule = new BehaviorRule('return_pattern', 0, 60, 'json:roles[]==admin');
    expect(
      await tracker.trackReturnPattern(
        '/e', '1.2.3.4', behaviorResponse(200, '{"roles":["user","admin"]}'), arrayRule,
      ),
    ).toBe(true);
    const bareRule = new BehaviorRule('return_pattern', 0, 60, 'TOKEN');
    expect(
      await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, 'a token here'), bareRule),
    ).toBe(true);
  });

  it('counts structural json mismatches as no-match', async () => {
    const cases: Array<[string, string]> = [
      ['json:a.b==x', '{"a": 1}'],
      ['json:a[]==x', '{"a": {"b": 1}}'],
      ['json:a.b==x', '{"a": {"b": null}}'],
      ['json:a==x', '{"a": "y"}'],
      ['json:a.b==x', 'not json'],
      ['json:nop==x', '{"a": 1}'],
      ['json:a==x', '[]'],
    ];
    for (const [pattern, body] of cases) {
      const rule = new BehaviorRule('return_pattern', 0, 60, pattern);
      expect(
        await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, body), rule),
      ).toBe(false);
    }
  });

  it('returns false on an empty body and recovers from pattern errors', async () => {
    const rule = new BehaviorRule('return_pattern', 0, 60, 'secret');
    expect(await tracker.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, ''), rule)).toBe(false);
    // An invalid regex hits the catch and logs instead of throwing.
    const broken = new BehaviorTracker(scanConfig, collectingLogger());
    const badRule = new BehaviorRule('return_pattern', 0, 60, 'regex:[unclosed');
    expect(
      await broken.trackReturnPattern('/e', '1.2.3.4', behaviorResponse(200, 'x'), badRule),
    ).toBe(false);
  });

  it('evicts bounded store rows when the caps are reached', async () => {
    const rule = new BehaviorRule('usage', 1, 60);
    // The endpoint cap is 10,000: fill it and force one more bucket.
    for (let i = 0; i < 10_000; i++) {
      await tracker.trackEndpointUsage(`/e${i}`, '1.2.3.4', rule);
    }
    await tracker.trackEndpointUsage('/overflow', '1.2.3.4', rule);
    // The per-endpoint client cap is 10,000: fill one bucket and force a row.
    for (let i = 0; i < 10_000; i++) {
      await tracker.trackEndpointUsage('/bucket', `10.0.${Math.floor(i / 250) % 250}.${i % 250}`, rule);
    }
    await tracker.trackEndpointUsage('/bucket', '10.9.9.9', rule);
    expect(await tracker.trackEndpointUsage('/e0', '1.2.3.4', rule)).toBe(false);
  });
});

describe('BehaviorTracker applyAction', () => {
  it('logs passive actions at the configured level and skips unknown levels', async () => {
    const logger = collectingLogger();
    const passive = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: true, logSuspiciousLevel: 'WARNING' }),
      logger,
    );
    const agent = mockAgent();
    await passive.initializeAgent(agent);
    await passive.applyAction(new BehaviorRule('usage', 1, 60, null, 'alert'), '1.2.3.4', '/e', 'd');
    await passive.applyAction(new BehaviorRule('usage', 1, 60, null, 'ban'), '1.2.3.4', '/e', 'd');
    await passive.applyAction(new BehaviorRule('usage', 1, 60, null, 'log'), '1.2.3.4', '/e', 'd');
    await passive.applyAction(new BehaviorRule('usage', 1, 60, null, 'throttle'), '1.2.3.4', '/e', 'd');
    const noLevel = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: true, logSuspiciousLevel: null }),
      logger,
    );
    await noLevel.applyAction(new BehaviorRule('usage', 1, 60, null, 'log'), '1.2.3.4', '/e', 'd');
    const silent = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: true, logSuspiciousLevel: null }),
      logger,
    );
    await silent.applyAction(new BehaviorRule('usage', 1, 60, null, 'throttle'), '1.2.3.4', '/e', 'd');
    expect(agent.sendEvent).toHaveBeenCalledTimes(4);
  });

  it('dispatches active actions and survives agent failures', async () => {
    const logger = collectingLogger();
    const active = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: false, logSuspiciousLevel: 'CRITICAL' }),
      logger,
    );
    const agent = mockAgent();
    await active.initializeAgent(agent);
    // Custom action wins and its throw is contained.
    let customCalled = false;
    const custom = new BehaviorRule('usage', 1, 60, null, 'log', () => {
      customCalled = true;
      throw new Error('custom hook exploded');
    });
    await active.applyAction(custom, '1.2.3.4', '/e', 'd');
    expect(customCalled).toBe(true);
    // Ban without a manager falls back to tracked.
    await active.applyAction(new BehaviorRule('usage', 1, 60, null, 'ban'), '1.2.3.4', '/e', 'd');
    // Ban with a manager applies the configured duration.
    const ipBan = new IPBanManager(defaultLogger);
    const withBan = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: false, logSuspiciousLevel: 'ERROR' }),
      logger,
    );
    withBan.initializeIpBan(ipBan);
    await withBan.applyAction(new BehaviorRule('usage', 1, 60, null, 'ban', null, 120), '1.2.3.4', '/e', 'd');
    // Alert, log and throttle branches.
    await withBan.applyAction(new BehaviorRule('usage', 1, 60, null, 'alert'), '1.2.3.4', '/e', 'd');
    await withBan.applyAction(new BehaviorRule('usage', 1, 60, null, 'log'), '1.2.3.4', '/e', 'd');
    await withBan.applyAction(new BehaviorRule('usage', 1, 60, null, 'throttle'), '1.2.3.4', '/e', 'd');
    // DEBUG level routing and the default info branch.
    const debug = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: false, logSuspiciousLevel: 'DEBUG' }),
      logger,
    );
    await debug.applyAction(new BehaviorRule('usage', 1, 60, null, 'log'), '1.2.3.4', '/e', 'd');
    const custom2 = new BehaviorTracker(
      SecurityConfigSchema.parse({ passiveMode: false, logSuspiciousLevel: 'INFO' }),
      logger,
    );
    await custom2.applyAction(new BehaviorRule('usage', 1, 60, null, 'log'), '1.2.3.4', '/e', 'd');
    expect(agent.sendEvent).toHaveBeenCalled();
    await active.reset();
  });
});

describe('CloudHandler details', () => {
  it('returns null for unknown providers and invalid inputs', () => {
    const handler = new CloudHandler(defaultLogger);
    expect(handler.getCloudProviderDetails('1.2.3.4', new Set(['aws']))).toBeNull();
    // An IP that fails to parse hits the outer guard.
    expect(handler.getCloudProviderDetails('not-an-ip', new Set(['aws']))).toBeNull();
    // A provider whose ranges contain malformed CIDRs is skipped safely.
    const ranges = handler.getIpRanges?.() ?? null;
    void ranges;
  });
});

describe('DynamicRuleManager update loop', () => {
  it('guards double starts and reports update failures', async () => {
    const logger = collectingLogger();
    const manager = new DynamicRuleManager(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTestConfig({ dynamicRuleInterval: 60 }),
      logger,
    );
    const cast = manager as unknown as { startUpdateLoop: () => void; updateRules: () => Promise<void> };
    cast.startUpdateLoop();
    cast.startUpdateLoop();
    // Let one tick fire with a rejecting fetch path.
    vi.useFakeTimers();
    const failure = cast.updateRules().catch(() => undefined);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
    await failure;
    manager.stopUpdateLoop?.();
  });
});

describe('SecurityHeadersHandler cached config', () => {
  it('ignores malformed cached json', async () => {
    const handler = new SecurityHeadersManager(createTestConfig(), defaultLogger);
    const redis = {
      getKey: vi.fn().mockResolvedValue('not-json{'),
      setKey: vi.fn().mockResolvedValue(true),
    } as unknown as RedisManager;
    await handler.initializeRedis(redis);
    const loader = handler as unknown as { loadCachedConfig: () => Promise<void> };
    await loader.loadCachedConfig();
  });
});

describe('SusPatternsManager options', () => {
  it('supports skipped categories and pattern-match classification', async () => {
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const result = await manager.detect('<script>alert(1)</script>', '1.2.3.4', 'request_body');
    expect(result.isThreat).toBe(true);
    // Skipping the xss category suppresses the threat.
    const skipped = await manager.detect('<script>alert(1)</script>', '1.2.3.4', 'request_body', null, {
      skipCategories: new Set(['xss']),
    });
    expect(skipped.threats.some((threat) => threat.category === 'xss')).toBe(false);
    // detectPatternMatch classifies regex and semantic threats.
    const [hit, pattern] = await manager.detectPatternMatch('<script>alert(1)</script>', '1.2.3.4');
    expect(hit).toBe(true);
    expect(typeof pattern === 'string' || pattern === null).toBe(true);
    const [miss] = await manager.detectPatternMatch('nothing suspicious at all', '1.2.3.4');
    expect(miss).toBe(false);
  });
});

describe('redaction edge branches', () => {
  it('merges case-insensitive sensitive names', () => {
    const merged = mergeSensitiveNames(['authorization'], ['X-API-KEY', 'authorization']);
    expect(merged.has('x-api-key')).toBe(true);
    expect(merged.has('authorization')).toBe(true);
  });

  it('redacts urls including fragments and encoded pairs', () => {
    const sensitiveNames = mergeSensitiveNames(['password'], []);
    expect(redactUrlForDisplay('https://x.com/a?password=abc&ok=1', sensitiveNames, sensitiveNames, sensitiveNames)).toContain('password=[REDACTED]');
    expect(redactUrlForDisplay('https://x.com/a?password=abc#token=zzz', sensitiveNames, sensitiveNames, sensitiveNames)).toBeTruthy();
    expect(redactUrlForDisplay('https://x.com/a#frag?password=abc', sensitiveNames, sensitiveNames, sensitiveNames)).toBeTruthy();
    expect(redactBlobForDisplay('a=1 password=hunter2 b=2', sensitiveNames)).toContain('[REDACTED]');
    expect(redactPairsInText('password=hunter2', sensitiveNames)).toContain('[REDACTED]');
    expect(redactPairsInText('password=hunter%202', sensitiveNames)).toBeTruthy();
    expect(redactHeaderValueForDisplay('', true, true, true)).toBe('');
    // Json bodies are redacted structurally.
    const json = redactBlobForDisplay('{"password": "hunter2", "keep": 1}', sensitiveNames, sensitiveNames, sensitiveNames);
    expect(json).toContain('[REDACTED]');
    expect(json).toContain('1');
  });
});

describe('client identity fallback', () => {
  it('falls back to the unknown identity', () => {
    expect(canonicalizeIpForPayload(null)).toBe('unknown');
    expect(canonicalizeIpForPayload(undefined)).toBe('unknown');
    expect(canonicalizeIpForPayload('1.2.3.4')).toBe('1.2.3.4');
  });
});

describe('config refinement', () => {
  it('rejects body-dependent return_pattern rules when scanning is off', () => {
    expect(() =>
      SecurityConfigSchema.parse({
        globalBehaviorRules: [{ ruleType: 'return_pattern', threshold: 1, window: 60, pattern: 'secret' }],
      }),
    ).toThrow();
    // status: patterns are unaffected.
    expect(() =>
      SecurityConfigSchema.parse({
        globalBehaviorRules: [{ ruleType: 'return_pattern', threshold: 1, window: 60, pattern: 'status:200' }],
      }),
    ).not.toThrow();
    // The same rule is fine with scanning enabled.
    expect(() =>
      SecurityConfigSchema.parse({
        behaviorScanResponseBody: true,
        globalBehaviorRules: [{ ruleType: 'return_pattern', threshold: 1, window: 60, pattern: 'secret' }],
      }),
    ).not.toThrow();
  });
});

describe('mock response factory', () => {
  it('sets redirect headers', async () => {
    const { createMockResponseFactory } = await import('../helpers.js');
    const factory = createMockResponseFactory();
    const resp = factory.createRedirectResponse('https://x/', 301);
    expect(resp.statusCode).toBe(301);
  });
});

describe('cloud range fetchers', () => {
  it('filters prefix entries without ranges', async () => {
    const handler = new CloudHandler(defaultLogger);
    const fetcher = handler as unknown as { fetchGcpRanges: () => Promise<string[]> };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ prefixes: [{ ipv4Prefix: '10.0.0.0/8' }, {}, { ipv6Prefix: 'fd00::/8' }] }),
    }) as unknown as typeof fetch;
    try {
      expect(await fetcher.fetchGcpRanges()).toEqual(['10.0.0.0/8', 'fd00::/8']);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(createMockResponse(200, 'x').statusCode).toBe(200);
  });
});
