import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  EventEnricher,
  threatScoreFor,
  DEFAULT_THREAT_SCORE,
  BEHAVIOR_CORRELATION_WINDOW_SECONDS,
  DEFAULT_OTEL_SERVICE_NAME,
  ENRICHMENT_KEY_PROJECT_ID,
  ENRICHMENT_KEY_SERVICE_NAME,
  ENRICHMENT_KEY_DEPLOYMENT_ENV,
  ENRICHMENT_KEY_THREAT_SCORE,
  ENRICHMENT_KEY_RULE_ID,
  ENRICHMENT_KEY_RULE_VERSION,
  ENRICHMENT_KEY_BEHAVIOR_KEY,
  ENRICHMENT_KEY_RECENT_EVENT_COUNT,
} from '../../src/core/events/enricher.js';
import { CompositeAgentHandler } from '../../src/core/events/composite-handler.js';
import { EventFilter } from '../../src/core/events/event-filter.js';
import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { BehaviorTracker } from '../../src/handlers/behavior.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig } from '../helpers.js';

/* Enrichment-layer tests, mirroring the reference suite:
   tests/test_enricher.py, test_enricher_identity.py,
   test_enricher_threat_score.py, test_enricher_behavior_correlation.py,
   test_enricher_rule_correlation.py and test_enricher_end_to_end.py. */

function enrichConfig(overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
  return createTestConfig({
    enableAgent: true,
    agentApiKey: 'k'.repeat(10),
    ...overrides,
  });
}

function fakeAgent(rules: unknown): { getDynamicRules: () => Promise<unknown> } {
  return { getDynamicRules: async () => rules };
}

const PINNED_NOW_MS = 1700000000000;

function testEnricher(
  config: ResolvedSecurityConfig,
  handles: { dynamicRuleHandler?: EnricherHandles; behaviorTracker?: BehaviorTracker | null } = {},
): EventEnricher {
  return new EventEnricher(
    {
      config,
      dynamicRuleHandler: handles.dynamicRuleHandler ?? null,
      behaviorTracker: handles.behaviorTracker ?? null,
    },
    { now: () => PINNED_NOW_MS },
  );
}
type EnricherHandles = import('../../src/core/events/enricher.js').DynamicRuleMatcher;

function seedTracker(ip: string, count: number, offsets: number[]): BehaviorTracker {
  const tracker = new BehaviorTracker(createTestConfig(), defaultLogger);
  const now = Date.now() / 1000;
  const store = (tracker as unknown as {
    usageCounts: Map<string, Map<string, number[]>>;
  }).usageCounts;
  for (let i = 0; i < count; i++) {
    const endpoint = `endpoint-${i % 2}`;
    let row = store.get(endpoint);
    if (!row) {
      row = new Map();
      store.set(endpoint, row);
    }
    row.set(ip, [...(row.get(ip) ?? []), now + offsets[i]]);
  }
  return tracker;
}

describe('threatScoreFor', () => {
  it('scores every reference tier', () => {
    expect(threatScoreFor('penetration_attempt')).toBe(90);
    expect(threatScoreFor('ip_banned')).toBe(70);
    expect(threatScoreFor('emergency_mode_activated')).toBe(60);
    for (const et of [
      'ip_blocked', 'behavioral_violation', 'cloud_blocked', 'country_blocked',
      'decorator_violation', 'authentication_failed', 'emergency_mode_block',
      'pattern_detected', 'suspicious_request', 'dynamic_rule_violation',
    ]) {
      expect(threatScoreFor(et)).toBe(50);
    }
    for (const et of [
      'dynamic_rule_applied', 'csp_violation', 'content_filtered',
      'custom_request_check', 'decoding_error', 'redis_error', 'ip_ban_failed',
      'detection_engine_callback_error', 'pattern_anomaly_timeout',
      'pattern_anomaly_slow_execution', 'pattern_anomaly_statistical_anomaly',
    ]) {
      expect(threatScoreFor(et)).toBe(40);
    }
    expect(threatScoreFor('access_denied')).toBe(30);
    expect(threatScoreFor('user_agent_blocked')).toBe(30);
    expect(threatScoreFor('security_bypass')).toBe(30);
    expect(threatScoreFor('rate_limited')).toBe(20);
    expect(threatScoreFor('geo_lookup_failed')).toBe(20);
    expect(threatScoreFor('redis_connection')).toBe(20);
    expect(threatScoreFor('route_unresolved')).toBe(20);
    expect(threatScoreFor('ip_unbanned')).toBe(10);
    expect(threatScoreFor('https_enforced')).toBe(10);
    expect(threatScoreFor('dynamic_rule_updated')).toBe(10);
    expect(threatScoreFor('path_excluded')).toBe(10);
    expect(threatScoreFor('pattern_added')).toBe(10);
    expect(threatScoreFor('pattern_removed')).toBe(10);
    expect(threatScoreFor('rate_limit_script_reloaded')).toBe(10);
    expect(threatScoreFor('security_headers_applied')).toBe(10);
  });

  it('defaults unknown event types to 20', () => {
    expect(threatScoreFor('completely_novel_event')).toBe(DEFAULT_THREAT_SCORE);
  });
});

describe('EventEnricher identity', () => {
  it('populates project and service from config', async () => {
    const enricher = testEnricher(enrichConfig({
      agentProjectId: 'proj-123',
      otelServiceName: 'api-prod',
    }));
    const event: { eventType: string; metadata: Record<string, unknown> } = {
      eventType: 'ip_blocked', metadata: {},
    };
    await enricher.enrichEvent(event);
    expect(event.metadata[ENRICHMENT_KEY_PROJECT_ID]).toBe('proj-123');
    expect(event.metadata[ENRICHMENT_KEY_SERVICE_NAME]).toBe('api-prod');
    expect(ENRICHMENT_KEY_DEPLOYMENT_ENV in event.metadata).toBe(false);
  });

  it('adds the deployment environment when the resource attribute is set', async () => {
    const enricher = testEnricher(enrichConfig({
      agentProjectId: 'proj-9',
      otelResourceAttributes: { 'deployment.environment': 'prod', 'service.version': '1.2.3' },
    }));
    const event = { eventType: 'ip_blocked', metadata: {} };
    await enricher.enrichEvent(event);
    expect(event.metadata[ENRICHMENT_KEY_DEPLOYMENT_ENV]).toBe('prod');
  });

  it('omits the project id when unset', async () => {
    const enricher = testEnricher(enrichConfig({ otelServiceName: 'svc' }));
    const event = { eventType: 'ip_blocked', metadata: {} };
    await enricher.enrichEvent(event);
    expect(ENRICHMENT_KEY_PROJECT_ID in event.metadata).toBe(false);
    expect(event.metadata[ENRICHMENT_KEY_SERVICE_NAME]).toBe('svc');
  });

  it('defaults the service name to guard-core', () => {
    expect(SecurityConfigSchema.parse({}).otelServiceName).toBe(DEFAULT_OTEL_SERVICE_NAME);
  });
});

describe('EventEnricher threat score', () => {
  it('populates the threat score', async () => {
    const enricher = testEnricher(enrichConfig());
    const event = { eventType: 'penetration_attempt', metadata: {} };
    await enricher.enrichEvent(event);
    expect(event.metadata[ENRICHMENT_KEY_THREAT_SCORE]).toBe(90);
  });

  it('skips the threat score when the event type is missing', async () => {
    const enricher = testEnricher(enrichConfig());
    const event = { metadata: {} };
    await enricher.enrichEvent(event);
    expect(ENRICHMENT_KEY_THREAT_SCORE in event.metadata).toBe(false);
  });

  it('gives unknown types the default score', async () => {
    const enricher = testEnricher(enrichConfig());
    const event = { eventType: 'unknown_type_here', metadata: {} };
    await enricher.enrichEvent(event);
    expect(event.metadata[ENRICHMENT_KEY_THREAT_SCORE]).toBe(DEFAULT_THREAT_SCORE);
  });
});

describe('EventEnricher rule correlation', () => {
  async function managerWithRules(rules: unknown): Promise<DynamicRuleManager> {
    const manager = new DynamicRuleManager(createTestConfig(), defaultLogger);
    await manager.initializeAgent(fakeAgent(rules) as never);
    await manager.updateRules();
    return manager;
  }

  it('populates rule id and version when the active rule matches', async () => {
    const manager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      ipBlacklist: ['1.2.3.4'],
    });
    const enricher = testEnricher(enrichConfig(), { dynamicRuleHandler: manager });
    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    await enricher.enrichEvent(event);
    expect(event.metadata[ENRICHMENT_KEY_RULE_ID]).toBe('rule-42');
    expect(event.metadata[ENRICHMENT_KEY_RULE_VERSION]).toBe(3);
    await manager.stop();
  });

  it('matches by country, rate-limit, cloud and user-agent rules', async () => {
    const limit = 100;
    const window = 60;
    const manager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      blockedCountries: ['KP'],
    });
    expect(manager.matchEvent({ eventType: 'country_blocked', country: 'KP' })).toEqual({
      ruleId: 'rule-42', version: 3,
    });
    expect(manager.matchEvent({ eventType: 'country_blocked', country: 'DE' })).toBeNull();

    const rateManager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      globalRateLimit: limit, globalRateWindow: window,
    });
    expect(rateManager.matchEvent({ eventType: 'rate_limited' })).not.toBeNull();

    const endpointManager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      endpointRateLimits: { '/api': [10, 60] },
    });
    expect(endpointManager.matchEvent({ eventType: 'rate_limited' })).not.toBeNull();

    const cloudManager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      blockedCloudProviders: ['AWS'],
    });
    expect(cloudManager.matchEvent({ eventType: 'cloud_blocked' })).not.toBeNull();

    const uaManager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      blockedUserAgents: ['badbot'],
    });
    expect(uaManager.matchEvent({ eventType: 'user_agent_blocked' })).not.toBeNull();

    const whitelistManager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
      ipWhitelist: ['9.9.9.9'],
    });
    expect(whitelistManager.matchEvent({ eventType: 'access_denied', ipAddress: '9.9.9.9' })).not.toBeNull();
    expect(whitelistManager.matchEvent({ eventType: 'access_denied', ipAddress: '5.5.5.5' })).toBeNull();

    for (const m of [manager, rateManager, endpointManager, cloudManager, uaManager, whitelistManager]) {
      await m.stop();
    }
  });

  it('skips rule fields without a handler or without a match', async () => {
    /* match_event returns None when no rules are active (the reference
       test_match_event_returns_none_when_no_current_rules). */
    const bare = new DynamicRuleManager(createTestConfig(), defaultLogger);
    expect(bare.matchEvent({ eventType: 'ip_blocked' })).toBeNull();
    await bare.stop();

    const noHandler = testEnricher(enrichConfig());
    const event = { eventType: 'ip_blocked', metadata: {} };
    await noHandler.enrichEvent(event);
    expect(ENRICHMENT_KEY_RULE_ID in event.metadata).toBe(false);

    const manager = await managerWithRules({
      ruleId: 'rule-42', version: 3, timestamp: '2024-01-01T00:00:00Z',
    });
    const noMatch = testEnricher(enrichConfig(), { dynamicRuleHandler: manager });
    const unmatched = { eventType: 'ip_blocked', ipAddress: '5.5.5.5', metadata: {} };
    await noMatch.enrichEvent(unmatched);
    expect(ENRICHMENT_KEY_RULE_ID in unmatched.metadata).toBe(false);
    await manager.stop();
  });
});

describe('EventEnricher behavior correlation', () => {
  it('getRecentEventCount mirrors the reference tracker semantics', () => {
    const empty = new BehaviorTracker(createTestConfig(), defaultLogger);
    expect(empty.getRecentEventCount('1.2.3.4', 300)).toBe(0);
    expect(empty.getRecentEventCount('', 300)).toBe(0);

    const summing = seedTracker('1.2.3.4', 3, [-10, -20, -30]);
    expect(summing.getRecentEventCount('1.2.3.4', 300)).toBe(3);

    const windowed = seedTracker('1.2.3.4', 3, [-10, -600, -700]);
    expect(windowed.getRecentEventCount('1.2.3.4', 300)).toBe(1);
  });

  it('attaches the correlation key and count', async () => {
    const tracker = seedTracker('1.2.3.4', 2, [-10, -20]);
    const enricher = testEnricher(enrichConfig({ otelServiceName: 'svc-1' }), { behaviorTracker: tracker });
    const event = { eventType: 'penetration_attempt', ipAddress: '1.2.3.4', metadata: {} };
    await enricher.enrichEvent(event);

    expect(event.metadata[ENRICHMENT_KEY_RECENT_EVENT_COUNT]).toBe(2);
    const key = event.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY];
    expect(typeof key).toBe('string');
    expect((key as string)).toHaveLength(16);

    const bucket = Math.floor(PINNED_NOW_MS / 1000 / BEHAVIOR_CORRELATION_WINDOW_SECONDS);
    const want = createHash('sha256').update(`1.2.3.4|svc-1|${bucket}`).digest('hex').slice(0, 16);
    expect(key).toBe(want);
  });

  it('same ip in the same window shares the key; different ips do not', async () => {
    const tracker = seedTracker('1.2.3.4', 1, [-5]);
    const enricher = testEnricher(enrichConfig(), { behaviorTracker: tracker });
    const first = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    const second = { eventType: 'rate_limited', ipAddress: '1.2.3.4', metadata: {} };
    await enricher.enrichEvent(first);
    await enricher.enrichEvent(second);
    expect(first.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY]).toBe(second.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY]);

    const fresh = new BehaviorTracker(createTestConfig(), defaultLogger);
    const other = testEnricher(enrichConfig(), { behaviorTracker: fresh });
    const a = { eventType: 'ip_blocked', ipAddress: '1.1.1.1', metadata: {} };
    const b = { eventType: 'ip_blocked', ipAddress: '2.2.2.2', metadata: {} };
    await other.enrichEvent(a);
    await other.enrichEvent(b);
    expect(a.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY]).not.toBe(b.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY]);
  });

  it('skips the behavior fields without a tracker or without an ip', async () => {
    const noTracker = testEnricher(enrichConfig());
    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    await noTracker.enrichEvent(event);
    expect(ENRICHMENT_KEY_BEHAVIOR_KEY in event.metadata).toBe(false);
    expect(ENRICHMENT_KEY_RECENT_EVENT_COUNT in event.metadata).toBe(false);

    const tracker = new BehaviorTracker(createTestConfig(), defaultLogger);
    const noIp = testEnricher(enrichConfig(), { behaviorTracker: tracker });
    const ipless = { eventType: 'ip_blocked', metadata: {} };
    await noIp.enrichEvent(ipless);
    expect(ENRICHMENT_KEY_BEHAVIOR_KEY in ipless.metadata).toBe(false);
  });

  it('defaults the clock and logger when no options are given', async () => {
    /* The reference reads time.time() directly; the default now() arrow is
       the Date.now seam and must run for real enrichment. */
    const tracker = seedTracker('1.2.3.4', 1, [-5]);
    const enricher = new EventEnricher({
      config: enrichConfig({ otelServiceName: 'svc-1' }),
      behaviorTracker: tracker,
    });
    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    await enricher.enrichEvent(event);
    const key = event.metadata[ENRICHMENT_KEY_BEHAVIOR_KEY];
    expect(typeof key).toBe('string');
    expect(key as string).toHaveLength(16);
    expect(event.metadata[ENRICHMENT_KEY_RECENT_EVENT_COUNT]).toBe(1);
  });
});

describe('EventEnricher payload guards', () => {
  it('ships events without a metadata map untouched', async () => {
    const enricher = testEnricher(enrichConfig());
    await enricher.enrichEvent({ eventType: 'ip_blocked' });
    await enricher.enrichEvent({ eventType: 'ip_blocked', metadata: null });
    await enricher.enrichEvent({ eventType: 'ip_blocked', metadata: 'not-a-map' });
    await enricher.enrichEvent(null);
  });

  it('ships metrics without a tags map untouched', async () => {
    const enricher = testEnricher(enrichConfig());
    await enricher.enrichMetric({ metricType: 'response_time' });
    await enricher.enrichMetric({ metricType: 'response_time', tags: null });
    await enricher.enrichMetric({ metricType: 'response_time', tags: [] });
    await enricher.enrichMetric(undefined);
  });

  it('keeps existing payload keys and enriches metric tags', async () => {
    const enricher = testEnricher(enrichConfig({
      agentProjectId: 'proj-metric',
      otelResourceAttributes: { 'deployment.environment': 'staging' },
    }));
    const metric = { metricType: 'response_time', tags: { endpoint: '/x' } };
    await enricher.enrichMetric(metric);
    expect(metric.tags.endpoint).toBe('/x');
    expect(metric.tags[ENRICHMENT_KEY_PROJECT_ID]).toBe('proj-metric');
    expect(metric.tags[ENRICHMENT_KEY_SERVICE_NAME]).toBe(DEFAULT_OTEL_SERVICE_NAME);
    expect(metric.tags[ENRICHMENT_KEY_DEPLOYMENT_ENV]).toBe('staging');
  });

  it('contains strategy failures and ships unenriched', async () => {
    const errors: string[] = [];
    const enricher = new EventEnricher(
      {
        config: enrichConfig(),
        dynamicRuleHandler: {
          matchEvent() { throw new Error('matcher explode'); },
        },
        behaviorTracker: {
          getRecentEventCount() { throw new Error('tracker explode'); },
        },
      },
      { logger: { ...defaultLogger, error: (m: string) => errors.push(m) }, now: () => PINNED_NOW_MS },
    );
    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    await enricher.enrichEvent(event);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('event enrichment failed; event will be sent unenriched');

    const metricErrors: string[] = [];
    const metricEnricher = new EventEnricher(
      {
        config: enrichConfig(),
        behaviorTracker: {
          getRecentEventCount() { return 0; },
        },
      },
      {
        logger: { ...defaultLogger, error: (m: string) => metricErrors.push(m) },
        now: () => PINNED_NOW_MS,
      },
    );
    (metricEnricher as unknown as { applyIdentity: () => void }).applyIdentity = () => {
      throw new Error('identity explode');
    };
    const metric = { metricType: 'response_time', tags: {} };
    await metricEnricher.enrichMetric(metric);
    expect(metricErrors).toHaveLength(1);
    expect(metricErrors[0]).toContain('metric enrichment failed; metric will be sent unenriched');
  });
});

describe('enrichment through the composite', () => {
  function fakeSink(): { events: unknown[]; metrics: unknown[] } & Record<string, unknown> {
    const events: unknown[] = [];
    const metrics: unknown[] = [];
    return {
      events,
      metrics,
      async initializeRedis(): Promise<void> {},
      async sendEvent(event: unknown): Promise<void> { events.push(event); },
      async sendMetric(metric: unknown): Promise<void> { metrics.push(metric); },
      async start(): Promise<void> {},
      async stop(): Promise<void> {},
      async flushBuffer(): Promise<void> {},
      async getDynamicRules(): Promise<unknown | null> { return null; },
      async healthCheck(): Promise<boolean> { return true; },
    };
  }

  it('end to end: enriched fields land on the emitted event and metric', async () => {
    const config = enrichConfig({
      agentProjectId: 'proj-e2e',
      otelServiceName: 'api-e2e',
      enableEnrichment: true,
      otelResourceAttributes: { 'deployment.environment': 'prod' },
    });
    const manager = new DynamicRuleManager(config, defaultLogger);
    await manager.initializeAgent(fakeAgent({
      ruleId: 'rule-abc', version: 7, timestamp: '2024-01-01T00:00:00Z',
      ipBlacklist: ['1.2.3.4'],
    }) as never);
    await manager.updateRules();
    const tracker = seedTracker('1.2.3.4', 1, [-5]);
    const enricher = new EventEnricher(
      { config, dynamicRuleHandler: manager, behaviorTracker: tracker },
      { now: () => PINNED_NOW_MS },
    );
    const sink = fakeSink();
    const composite = new CompositeAgentHandler(
      [sink as never], { eventFilter: new EventFilter(), enricher },
    );

    await composite.sendEvent({ eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} });
    expect(sink.events).toHaveLength(1);
    const meta = (sink.events[0] as { metadata: Record<string, unknown> }).metadata;
    expect(meta[ENRICHMENT_KEY_PROJECT_ID]).toBe('proj-e2e');
    expect(meta[ENRICHMENT_KEY_SERVICE_NAME]).toBe('api-e2e');
    expect(meta[ENRICHMENT_KEY_DEPLOYMENT_ENV]).toBe('prod');
    expect(meta[ENRICHMENT_KEY_THREAT_SCORE]).toBe(50);
    expect(meta[ENRICHMENT_KEY_RULE_ID]).toBe('rule-abc');
    expect(meta[ENRICHMENT_KEY_RULE_VERSION]).toBe(7);
    expect(meta[ENRICHMENT_KEY_RECENT_EVENT_COUNT]).toBe(1);
    expect(meta[ENRICHMENT_KEY_BEHAVIOR_KEY]).toHaveLength(16);

    await composite.sendMetric({ metricType: 'response_time', value: 0.2, tags: { endpoint: '/api' } });
    expect(sink.metrics).toHaveLength(1);
    const tags = (sink.metrics[0] as { tags: Record<string, unknown> }).tags;
    expect(tags.endpoint).toBe('/api');
    expect(tags[ENRICHMENT_KEY_PROJECT_ID]).toBe('proj-e2e');
    expect(tags[ENRICHMENT_KEY_SERVICE_NAME]).toBe('api-e2e');
    expect(tags[ENRICHMENT_KEY_DEPLOYMENT_ENV]).toBe('prod');
    await manager.stop();
  });

  it('muted events are neither enriched nor dispatched', async () => {
    const config = enrichConfig({ enableEnrichment: true });
    const enricher = testEnricher(config);
    const sink = fakeSink();
    const composite = new CompositeAgentHandler([sink as never], {
      eventFilter: new EventFilter(['ip_blocked']),
      enricher,
    });

    const event = { eventType: 'ip_blocked', ipAddress: '1.2.3.4', metadata: {} };
    await composite.sendEvent(event);
    expect(sink.events).toHaveLength(0);
    expect(Object.keys(event.metadata)).toHaveLength(0);
  });
});

describe('enrichment config validation', () => {
  it('rejects enableEnrichment without enableAgent', () => {
    const result = SecurityConfigSchema.safeParse({ enableEnrichment: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('enableEnrichment requires enableAgent=true');
    }
  });

  it('accepts enableEnrichment with enableAgent', () => {
    const resolved = SecurityConfigSchema.parse({
      enableEnrichment: true,
      enableAgent: true,
      agentApiKey: 'k'.repeat(10),
    });
    expect(resolved.enableEnrichment).toBe(true);
  });
});
