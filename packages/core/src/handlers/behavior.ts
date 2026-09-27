import type { ResolvedSecurityConfig } from '../models/config.js';
import type { Logger } from '../models/logger.js';
import type { BehaviorAction, BehaviorRule } from '../models/behavior-rule.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { GuardResponse } from '../protocols/response.js';
import type { RedisManager } from './redis.js';
import type { IPBanManager } from './ip-ban.js';

/* Tracker bounds mirror _MAX_TRACKED_ENDPOINTS and
   _MAX_TRACKED_CLIENTS_PER_ENDPOINT (guard_core/handlers/behavior_handler.py):
   the local stores hold at most this many endpoint buckets and client rows
   per bucket. */
const MAX_TRACKED_ENDPOINTS = 10_000;
const MAX_TRACKED_CLIENTS_PER_ENDPOINT = 10_000;

/* DefaultBehaviorBanDurationSeconds mirrors _execute_ban_action's fallback
   when a ban rule carries no ban_duration. */
const DEFAULT_BEHAVIOR_BAN_DURATION_SECONDS = 3600;

export class BehaviorTracker {
  private usageCounts = new Map<string, Map<string, number[]>>();
  private returnPatterns = new Map<string, Map<string, number[]>>();
  private redisHandler: RedisManager | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private ipBanManager: IPBanManager | null = null;

  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
  ) {}

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  initializeIpBan(ipBanManager: IPBanManager | null): void {
    this.ipBanManager = ipBanManager;
  }

  async trackEndpointUsage(endpointId: string, clientIp: string, rule: BehaviorRule): Promise<boolean> {
    const now = Date.now() / 1000;
    const windowStart = now - rule.window;
    const timestamps = this.localRow(this.usageCounts, endpointId, clientIp);

    const validIdx = timestamps.findIndex((t) => t > windowStart);
    if (validIdx > 0) timestamps.splice(0, validIdx);
    else if (validIdx === -1) timestamps.length = 0;

    timestamps.push(now);

    return timestamps.length > rule.threshold;
  }

  /* Tri-state mirror of track_return_pattern
     (guard_core/handlers/behavior_handler.py + _behavior_response_pattern.py):
     only matching responses advance the sliding window, and with the scan
     flag off a body pattern is not evaluated at all (null: no verdict). */
  async trackReturnPattern(
    endpointId: string,
    clientIp: string,
    response: GuardResponse,
    rule: BehaviorRule,
    effectiveThreshold = rule.threshold,
  ): Promise<boolean | null> {
    if (!rule.pattern) return false;

    const matched = this.checkResponsePattern(response, rule.pattern);
    if (matched === null || matched === false) return matched === false ? false : null;

    const now = Date.now() / 1000;
    const windowStart = now - rule.window;
    const key = `${endpointId}:${rule.pattern}`;
    const timestamps = this.localRow(this.returnPatterns, key, clientIp);

    const validIdx = timestamps.findIndex((t) => t > windowStart);
    if (validIdx > 0) timestamps.splice(0, validIdx);
    else if (validIdx === -1) timestamps.length = 0;

    timestamps.push(now);

    return timestamps.length > effectiveThreshold;
  }

  /* Bounded local row: the twin of _lru_pop_or_create's caps, dropping one
     arbitrary bucket when the store is full (Python evicts LRU-first; the
     choice differs, the bound does not). */
  private localRow(
    store: Map<string, Map<string, number[]>>,
    bucket: string,
    key: string,
  ): number[] {
    let rows = store.get(bucket);
    if (!rows) {
      if (store.size >= MAX_TRACKED_ENDPOINTS) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      rows = new Map();
      store.set(bucket, rows);
    }
    let timestamps = rows.get(key);
    if (!timestamps) {
      if (rows.size >= MAX_TRACKED_CLIENTS_PER_ENDPOINT) {
        const oldest = rows.keys().next().value;
        if (oldest !== undefined) rows.delete(oldest);
      }
      timestamps = [];
      rows.set(key, timestamps);
    }
    return timestamps;
  }

  /* The twin of _check_response_pattern (_behavior_response_pattern.py +
     _behavior_json_pattern.py): status: / json:<path>==<expected> /
     regex: (case-insensitive search) / bare substring
     (case-insensitive contains). null means "not evaluated": with the
     scan flag off, a non-status pattern never reads the body. */
  private checkResponsePattern(response: GuardResponse, pattern: string): boolean | null {
    try {
      if (pattern.startsWith('status:')) {
        const code = parseInt(pattern.slice(7), 10);
        return Number.isNaN(code) ? false : response.statusCode === code;
      }

      if (!this.config.behaviorScanResponseBody) return null;

      const maxBytes = this.config.behaviorMaxResponseBodyInspectBytes;
      const body = response.bodyText ? response.bodyText.slice(0, maxBytes) : '';
      if (!body) return false;

      if (pattern.startsWith('json:')) {
        const jsonPattern = pattern.slice(5);
        let data: unknown;
        try {
          data = JSON.parse(body);
        } catch {
          return false;
        }
        return this.matchJsonPattern(data, jsonPattern);
      }

      if (pattern.startsWith('regex:')) {
        return new RegExp(pattern.slice(6), 'i').test(body);
      }

      return body.toLowerCase().includes(pattern.toLowerCase());
    } catch (e) {
      this.logger.error(`Error checking response pattern: ${e}`);
      return false;
    }
  }

  /* The twin of _match_json_pattern: "path.to.field==expected" with
     case-insensitive comparison, an "[]" segment matching any array
     element, and any structural mismatch counting as no-match. */
  private matchJsonPattern(data: unknown, pattern: string): boolean {
    const eq = pattern.indexOf('==');
    if (eq === -1) return false;
    const path = pattern.slice(0, eq).trim();
    const expected = pattern.slice(eq + 2).trim().replace(/^["']|["']$/g, '');

    let current: unknown = data;
    for (const part of path.split('.')) {
      if (part.endsWith('[]')) {
        if (current === null || typeof current !== 'object') return false;
        const list = (current as Record<string, unknown>)[part.slice(0, -2)];
        if (!Array.isArray(list)) return false;
        return list.some((item) => this.jsonScalar(item) === expected.toLowerCase());
      }
      if (current === null || typeof current !== 'object') return false;
      current = (current as Record<string, unknown>)[part];
      if (current === undefined) return false;
    }
    return this.jsonScalar(current) === expected.toLowerCase();
  }

  /* jsonScalarToString: Python str() over the JSON-decoded scalar. */
  private jsonScalar(v: unknown): string {
    if (typeof v === 'string') return v.toLowerCase();
    if (v === null || v === undefined) return 'none';
    if (typeof v === 'object') return JSON.stringify(v).toLowerCase();
    return String(v).toLowerCase();
  }

  /* The twin of apply_action (BehaviorActionDispatchMixin): passive mode
     only logs, active mode bans (ban_duration override, else 3600s, reason
     "behavioral_violation"), alerts, or logs, and the agent receives the
     behavioral_violation security event either way. */
  async applyAction(
    rule: BehaviorRule,
    clientIp: string,
    endpointId: string,
    details: string,
  ): Promise<void> {
    let actionTaken: string;

    if (this.config.passiveMode) {
      actionTaken = 'logged_only';
      this.logPassiveModeAction(rule, clientIp, details);
    } else {
      actionTaken = await this.executeActiveModeAction(rule, clientIp, endpointId, details);
    }

    if (this.agentHandler) {
      try {
        await this.agentHandler.sendEvent({
          eventType: 'behavioral_violation',
          ipAddress: clientIp,
          actionTaken,
          reason: `Behavioral rule violated: ${details}`,
          metadata: { endpoint: endpointId, rule_type: rule.ruleType, threshold: rule.threshold, window: rule.window },
        });
      } catch { /* never throw from event dispatch */ }
    }
  }

  private async executeActiveModeAction(
    rule: BehaviorRule,
    clientIp: string,
    endpointId: string,
    details: string,
  ): Promise<string> {
    if (rule.customAction) {
      try { rule.customAction(rule.action, clientIp, endpointId, details); } catch { /* fail-safe */ }
      return rule.action;
    }

    if (rule.action === 'ban') {
      const duration = rule.banDuration ?? DEFAULT_BEHAVIOR_BAN_DURATION_SECONDS;
      const applied = this.ipBanManager
        ? await this.ipBanManager.banIp(clientIp, duration, 'behavioral_violation')
        : false;
      if (!applied) return 'tracked';
      this.logAtSuspiciousLevel(`IP ${clientIp} banned for behavioral violation: ${details}`);
      return 'ban';
    }

    if (rule.action === 'alert') {
      this.logger.error(`ALERT - Behavioral anomaly: ${details}`);
      return rule.action;
    }

    if (rule.action === 'log') {
      this.logAtSuspiciousLevel(`Behavioral anomaly detected: ${details}`);
    } else if (rule.action === 'throttle') {
      this.logAtSuspiciousLevel(`Throttling IP ${clientIp}: ${details}`);
    }
    return rule.action;
  }

  private logPassiveModeAction(rule: BehaviorRule, clientIp: string, details: string): void {
    const prefix = '[PASSIVE MODE] ';
    if (rule.action === 'alert') {
      this.logger.error(`${prefix}ALERT - Behavioral anomaly: ${details}`);
      return;
    }
    const level = this.config.logSuspiciousLevel;
    if (level === null) return;
    if (rule.action === 'ban') {
      this.logAtLevel(level, `${prefix}Would ban IP ${clientIp} for behavioral violation: ${details}`);
    } else if (rule.action === 'log') {
      this.logAtLevel(level, `${prefix}Behavioral anomaly detected: ${details}`);
    } else if (rule.action === 'throttle') {
      this.logAtLevel(level, `${prefix}Would throttle IP ${clientIp}: ${details}`);
    }
  }

  /* _log_at_level over log_suspicious_level. */
  private logAtSuspiciousLevel(message: string): void {
    const level = this.config.logSuspiciousLevel ?? 'WARNING';
    this.logAtLevel(level, message);
  }

  private logAtLevel(level: string, message: string): void {
    if (level === 'CRITICAL' || level === 'ERROR') this.logger.error(message);
    else if (level === 'WARNING') this.logger.warn(message);
    else if (level === 'DEBUG') this.logger.debug(message);
    else this.logger.info(message);
  }

  async reset(): Promise<void> {
    this.usageCounts.clear();
    this.returnPatterns.clear();
  }
}

/* Utility re-export guard: BehaviorAction stays part of the public surface. */
export type { BehaviorAction };
