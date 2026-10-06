/* Event enrichment layer, the TS port of
   guard_core/core/events/enricher.py plus the ENRICHMENT_KEY_* constants of
   guard_core/core/events/event_types.py: every event and metric riding the
   agent stream gains the guard.* metadata keys the Guard Agent and the
   OTel/Logfire sinks consume.

   Parity behaviors:
   - identity keys (project id when configured, service name always,
     deployment environment when the resource attribute is set) ride both
     events and metrics
   - events additionally gain the deterministic threat score, the matched
     dynamic rule (id + version) and the per-IP behavioral correlation pair
   - enrichment order is identity, threat score, rule correlation, behavior
     correlation (the reference enrich_event strategy chain)
   - an event without a metadata map ships unenriched, exactly like the
     reference's `metadata is None` early return (and likewise a metric
     without a tags map); a strategy failure logs and the payload ships
     unenriched (the reference's caught enrich_event body)
   - the dotted guard.* key strings are the cross-language wire contract and
     stay snake_case even though the TS envelope fields are camelCase

   The redaction interaction is unchanged: the event bus redacts endpoints
   and user agents when the event is BUILT, enrichment happens later on the
   composite's dispatch path and only adds derived, non-sensitive guard.*
   keys, which the OTel/Logfire handlers forward verbatim. */

import { createHash } from 'node:crypto';

import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import { defaultLogger } from '../../models/logger.js';
import type { AgentEventEnricher } from './event-filter.js';

/* ENRICHMENT_KEY_* (event_types.py). */
export const ENRICHMENT_KEY_PROJECT_ID = 'guard.project_id';
export const ENRICHMENT_KEY_SERVICE_NAME = 'guard.service.name';
export const ENRICHMENT_KEY_DEPLOYMENT_ENV = 'guard.deployment.environment';
export const ENRICHMENT_KEY_THREAT_SCORE = 'guard.threat_score';
export const ENRICHMENT_KEY_RULE_ID = 'guard.rule.id';
export const ENRICHMENT_KEY_RULE_VERSION = 'guard.rule.version';
export const ENRICHMENT_KEY_BEHAVIOR_KEY = 'guard.behavior.correlation_key';
export const ENRICHMENT_KEY_RECENT_EVENT_COUNT = 'guard.behavior.recent_event_count';

/* _DEFAULT_THREAT_SCORE: the score every event type outside the map gets. */
export const DEFAULT_THREAT_SCORE = 20;

/* _BEHAVIOR_CORRELATION_WINDOW_SECONDS: the sliding window behind both the
   recent-event count and the correlation-key time bucket. */
export const BEHAVIOR_CORRELATION_WINDOW_SECONDS = 300;

/* The reference otel_service_name default. */
export const DEFAULT_OTEL_SERVICE_NAME = 'guard-core';

/* _THREAT_SCORE_MAP: one deterministic score per event type
   (ThreatScorer.score_for). */
export const THREAT_SCORE_MAP: Readonly<Record<string, number>> = {
  penetration_attempt: 90,
  ip_banned: 70,
  emergency_mode_activated: 60,
  ip_blocked: 50,
  behavioral_violation: 50,
  cloud_blocked: 50,
  country_blocked: 50,
  decorator_violation: 50,
  authentication_failed: 50,
  emergency_mode_block: 50,
  dynamic_rule_violation: 50,
  pattern_detected: 50,
  suspicious_request: 50,
  dynamic_rule_applied: 40,
  csp_violation: 40,
  content_filtered: 40,
  custom_request_check: 40,
  decoding_error: 40,
  redis_error: 40,
  ip_ban_failed: 40,
  detection_engine_callback_error: 40,
  pattern_anomaly_timeout: 40,
  pattern_anomaly_slow_execution: 40,
  pattern_anomaly_statistical_anomaly: 40,
  access_denied: 30,
  user_agent_blocked: 30,
  security_bypass: 30,
  rate_limited: 20,
  geo_lookup_failed: 20,
  redis_connection: 20,
  route_unresolved: 20,
  ip_unbanned: 10,
  https_enforced: 10,
  dynamic_rule_updated: 10,
  path_excluded: 10,
  pattern_added: 10,
  pattern_removed: 10,
  rate_limit_script_reloaded: 10,
  security_headers_applied: 10,
};

/* threatScoreFor mirrors ThreatScorer.score_for: the mapped score for the
   event type, or DEFAULT_THREAT_SCORE (20) for anything unmapped. */
export function threatScoreFor(eventType: string): number {
  return THREAT_SCORE_MAP[eventType] ?? DEFAULT_THREAT_SCORE;
}

/* The event surface the enricher reads (the reference duck types over
   event.event_type / event.ip_address / event.metadata). */
export interface EnrichableEvent {
  eventType?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

/* The metric surface the enricher reads (metric.tags). */
export interface EnrichableMetric {
  metricType?: string | null;
  tags?: Record<string, string> | null;
}

/* DynamicRuleMatcher is the rule-correlation seam (the reference duck-typed
   dynamic_rule_handler.match_event tuple; TS answers a match object or
   null). DynamicRuleManager implements it. */
export interface DynamicRuleMatcher {
  matchEvent(event: EnrichableEvent): { ruleId: string; version: number } | null;
}

/* BehaviorCounter is the behavior-correlation seam (the reference
   duck-typed behavior_tracker.get_recent_event_count). BehaviorTracker
   implements it. */
export interface BehaviorCounter {
  getRecentEventCount(ip: string, windowSeconds: number): number;
}

/* EnrichmentContext carries the enrichment dependencies (the reference
   EnrichmentContext dataclass). A null handle skips its strategy. */
export interface EnrichmentContext {
  config: ResolvedSecurityConfig;
  dynamicRuleHandler?: DynamicRuleMatcher | null;
  behaviorTracker?: BehaviorCounter | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class EventEnricher implements AgentEventEnricher {
  private readonly context: EnrichmentContext;
  private readonly logger: Logger;
  /* Injectable clock (epoch ms) so tests can pin the correlation bucket. */
  private readonly now: () => number;

  constructor(context: EnrichmentContext, options?: { logger?: Logger; now?: () => number }) {
    this.context = context;
    this.logger = options?.logger ?? defaultLogger;
    this.now = options?.now ?? (() => Date.now());
  }

  /* enrichEvent applies the full strategy chain (the reference
     enrich_event): identity, threat score, rule correlation, behavior
     correlation. An event without a metadata map ships untouched. */
  async enrichEvent(event: unknown): Promise<void> {
    try {
      const metadata = this.payloadOf(event, 'metadata');
      if (metadata === null) return;
      const enriched = event as EnrichableEvent;
      this.applyIdentity(metadata);
      this.applyThreatScore(metadata, enriched);
      await this.applyRuleCorrelation(metadata, enriched);
      this.applyBehaviorCorrelation(metadata, enriched);
    } catch (e) {
      this.logger.error(`event enrichment failed; event will be sent unenriched: ${e}`);
    }
  }

  /* enrichMetric applies the identity strategy to the metric tags (the
     reference enrich_metric - metrics carry identity only). A metric
     without a tags map ships untouched. */
  async enrichMetric(metric: unknown): Promise<void> {
    try {
      const tags = this.payloadOf(metric, 'tags');
      if (tags === null) return;
      this.applyIdentity(tags);
    } catch (e) {
      this.logger.error(`metric enrichment failed; metric will be sent unenriched: ${e}`);
    }
  }

  /* payloadOf reads the mutable bag the reference enriches
     (event.metadata / metric.tags): a plain object is required, anything
     else (missing, null, non-object) means "ship unenriched". */
  private payloadOf(payload: unknown, bag: 'metadata' | 'tags'): Record<string, unknown> | null {
    if (!isPlainObject(payload)) return null;
    const candidate = (payload as Record<string, unknown>)[bag];
    if (!isPlainObject(candidate)) return null;
    return candidate;
  }

  /* applyIdentity mirrors _apply_identity: project id only when set,
     service name always, deployment environment only when the resource
     attribute is present. */
  private applyIdentity(bag: Record<string, unknown>): void {
    const config = this.context.config;
    const projectId = (config.agentProjectId ?? '') as string;
    if (projectId) {
      bag[ENRICHMENT_KEY_PROJECT_ID] = projectId;
    }
    bag[ENRICHMENT_KEY_SERVICE_NAME] = config.otelServiceName;
    const deploymentEnv = config.otelResourceAttributes?.['deployment.environment'];
    if (deploymentEnv) {
      bag[ENRICHMENT_KEY_DEPLOYMENT_ENV] = deploymentEnv;
    }
  }

  /* applyThreatScore mirrors _apply_threat_score: the score rides only when
     the event carries a type. */
  private applyThreatScore(bag: Record<string, unknown>, event: EnrichableEvent): void {
    if (!event.eventType) return;
    bag[ENRICHMENT_KEY_THREAT_SCORE] = threatScoreFor(event.eventType);
  }

  /* applyRuleCorrelation mirrors _apply_rule_correlation: with a rule
     handler whose matchEvent answers, the rule id and version ride. */
  private async applyRuleCorrelation(bag: Record<string, unknown>, event: EnrichableEvent): Promise<void> {
    const handler = this.context.dynamicRuleHandler;
    if (handler === null || handler === undefined) return;
    const match = await handler.matchEvent(event);
    if (match === null) return;
    bag[ENRICHMENT_KEY_RULE_ID] = match.ruleId;
    bag[ENRICHMENT_KEY_RULE_VERSION] = match.version;
  }

  /* applyBehaviorCorrelation mirrors _apply_behavior_correlation: with a
     tracker and a non-empty ip, the recent event count over the 300s window
     rides, plus the deterministic correlation key
     sha256(f"{ip}|{service}|{bucket}")[:16] with bucket = unix // 300. */
  private applyBehaviorCorrelation(bag: Record<string, unknown>, event: EnrichableEvent): void {
    const tracker = this.context.behaviorTracker;
    const ip = event.ipAddress;
    if (tracker === null || tracker === undefined || !ip) return;
    bag[ENRICHMENT_KEY_RECENT_EVENT_COUNT] = tracker.getRecentEventCount(ip, BEHAVIOR_CORRELATION_WINDOW_SECONDS);
    const bucket = Math.floor(this.now() / 1000 / BEHAVIOR_CORRELATION_WINDOW_SECONDS);
    const service = this.context.config.otelServiceName;
    bag[ENRICHMENT_KEY_BEHAVIOR_KEY] = createHash('sha256')
      .update(`${ip}|${service}|${bucket}`)
      .digest('hex')
      .slice(0, 16);
  }
}
