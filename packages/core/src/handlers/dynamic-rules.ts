import type { ResolvedSecurityConfig } from '../models/config.js';
import { DynamicRulesSchema } from '../models/dynamic-rules.js';
import type { DynamicRules } from '../models/dynamic-rules.js';
import {
  dumpLastKnownRulesSnapshot,
  loadLastKnownRulesSnapshot,
} from '../models/dynamic-rule-snapshot.js';
import type { Logger } from '../models/logger.js';
import { randomUUID } from 'node:crypto';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisManager } from './redis.js';
import type { IPBanManager } from './ip-ban.js';
import type { SusPatternsManager } from './sus-patterns.js';
import { PatternCompiler } from '../detection-engine/compiler.js';
import { redactBlobForDisplay } from '../redaction.js';

/* The live config fields a rule can change (the reference
   DynamicRuleManager._SNAPSHOT_FIELDS): snapshotted before an apply and
   restored on a failed apply or when the rule expires. */
const SNAPSHOT_FIELDS = [
  'blockedCountries',
  'whitelistCountries',
  'rateLimit',
  'rateLimitWindow',
  'endpointRateLimits',
  'blockCloudProviders',
  'blockedUserAgents',
  'enablePenetrationDetection',
  'enableIpBanning',
  'enableRateLimiting',
  'emergencyMode',
  'emergencyWhitelist',
  'autoBanThreshold',
  'autoBanDuration',
  'enableRateLimitAutoBan',
] as const;

type ConfigSnapshot = Partial<Record<(typeof SNAPSHOT_FIELDS)[number], unknown>>;

/* The handlers a rule acts on (the reference reaches them through the
   ip_ban_manager / sus_patterns_handler singletons). */
export interface DynamicRuleTargets {
  ipBanManager?: IPBanManager | null;
  susPatternsManager?: SusPatternsManager | null;
}

/* The Redis namespace + key of the last-known snapshot (the twin of
   DYNAMIC_RULES_REDIS_NAMESPACE / LAST_KNOWN_RULES_KEY in
   guard_core/handlers/_dynamic_rule_persistence.py). */
export const DYNAMIC_RULES_REDIS_NAMESPACE = 'dynamic_rules';
export const LAST_KNOWN_RULES_KEY = 'last_known';

/* The twin of _write_last_known_rules_file
   (guard_core/handlers/_dynamic_rule_snapshot.py): the payload lands
   through a same-directory temporary file and an atomic rename, so a crash
   mid-write never truncates the previous snapshot and concurrent readers
   never observe a partial file. The temp file is removed before the error
   rethrows (the reference unlink(missing_ok=True) cleanup). */
export async function writeLastKnownRulesFile(
  cachePath: string,
  payload: string,
): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const directory = path.dirname(cachePath);
  const name = path.basename(cachePath);
  const tempPath = path.join(directory, `${name}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, payload, 'utf-8');
    await fs.rename(tempPath, cachePath);
  } catch (e) {
    try {
      await fs.unlink(tempPath);
    } catch { /* best-effort cleanup, the write error propagates */ }
    throw e;
  }
}

export class DynamicRuleManager {
  private currentRules: DynamicRules | null = null;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private lastUpdate = 0;
  private agentHandler: AgentHandlerProtocol | null = null;
  private redisHandler: RedisManager | null = null;
  /* The once-guard around boot hydration (the reference
     _hydrated_last_known_rules flag): a second initialize_agent must not
     re-apply the snapshot. */
  private hydratedLastKnownRules = false;
  /* The (ruleId, version) of the last payload skipped as already-expired
     (the reference _last_skipped_expired_rule dedup pair). */
  private lastSkippedExpiredRule: string | null = null;

  /* The pre-rule config values, kept from the first applied rule until it
     expires (the reference _active_base_snapshot). */
  private activeBaseSnapshot: ConfigSnapshot | null = null;
  private updateInFlight: Promise<void> | null = null;

  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly targets: DynamicRuleTargets = {},
  ) {}

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
    if (this.config.enableDynamicRules) {
      if (!this.hydratedLastKnownRules) {
        this.hydratedLastKnownRules = true;
        await this.hydrateLastKnownRules();
      }
      this.startUpdateLoop();
    }
  }

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
  }

  /* The twin of _hydrate_last_known_rules
     (guard_core/handlers/_dynamic_rule_snapshot.py): restore the last-known
     snapshot before the update loop starts so a restart during a SaaS
     outage keeps the last applied rules. Every failure mode (Redis down,
     unreadable file, malformed payload, expired rules) degrades to base
     state, never to a throw. */
  async hydrateLastKnownRules(): Promise<void> {
    try {
      const rules = await this.loadLastKnownRules();
      if (rules === null) return;
      await this.applyRules(rules);
      this.currentRules = rules;
      this.lastUpdate = Date.now() / 1000;
      this.logger.info(
        `Hydrated last-known dynamic rules ${rules.ruleId} v${rules.version} before the update loop started`,
      );
      /* The reference hydrate runs through _apply_rules, whose tail persists
         the snapshot: the winning store's payload is written back to the
         other stores, so a Redis-only snapshot repopulates the cache file
         and vice versa. */
      await this.persistLastKnownRules(rules);
    } catch (e) {
      this.logger.error(`Failed to hydrate last-known dynamic rules: ${e}`);
    }
  }

  /* The twin of _load_last_known_rules: Redis first, then the
     dynamicRulesCachePath file; the first store whose payload parses and is
     still live wins. Unusable or expired snapshots are discarded with the
     reference error logs and the next store is tried. */
  async loadLastKnownRules(): Promise<DynamicRules | null> {
    const redisPayload = await this.readRedisPayload();
    const filePayload = await this.readFilePayload();
    for (const payload of [redisPayload, filePayload]) {
      if (payload === null) continue;
      const rules = this.parseLastKnownRules(payload);
      if (rules === null) continue;
      if (this.hasRuleExpired(rules)) {
        this.logger.error(
          `Discarding expired last-known dynamic rules ${rules.ruleId} v${rules.version}; trying the next store`,
        );
        continue;
      }
      return rules;
    }
    return null;
  }

  /* The twin of _read_redis_payload: Redis read failures and empty payloads
     degrade to null; bytes come back decoded (the reference
     errors="replace" utf-8 decode). */
  private async readRedisPayload(): Promise<string | null> {
    if (!this.redisHandler) return null;
    let raw: unknown;
    try {
      raw = await this.redisHandler.getKey(
        DYNAMIC_RULES_REDIS_NAMESPACE, LAST_KNOWN_RULES_KEY,
      );
    } catch (e) {
      this.logger.error(`Failed to read last-known dynamic rules from Redis: ${e}`);
      return null;
    }
    if (raw instanceof Uint8Array) {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(raw);
      return decoded.length > 0 ? decoded : null;
    }
    if (raw === null || raw === undefined || raw === '') return null;
    return String(raw);
  }

  /* The twin of _read_file_payload: an unset path or a missing file is a
     silent null (the reference is_file() gate); a file that exists but
     cannot be read or decoded is logged and a null (the reference
     OSError / UnicodeDecodeError arm). */
  private async readFilePayload(): Promise<string | null> {
    const cachePath = this.config.dynamicRulesCachePath;
    if (cachePath === null) return null;
    try {
      const fs = await import('node:fs/promises');
      const stat = await fs.stat(cachePath).catch((e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return null;
        throw e;
      });
      if (stat === null || !stat.isFile()) return null;
      return await fs.readFile(cachePath, 'utf-8');
    } catch (e) {
      this.logger.error(`Failed to read dynamic rules cache file ${cachePath}: ${e}`);
      return null;
    }
  }

  /* The twin of _parse_last_known_rules: an unusable payload is discarded
     with the reference error log. The loaded snapshot re-validates through
     the live DynamicRulesSchema (its Set field rides back as an array for
     the parse input). */
  private parseLastKnownRules(payload: string): DynamicRules | null {
    try {
      const loaded = loadLastKnownRulesSnapshot(payload);
      return DynamicRulesSchema.parse({
        ...loaded,
        blockedCloudProviders: [...loaded.blockedCloudProviders],
      });
    } catch (e) {
      this.logger.error(`Discarding unusable last-known dynamic rules payload: ${e}`);
      return null;
    }
  }

  /* The twin of _has_rule_expired: a snapshot whose expiresAt has passed is
     dead on arrival. */
  private hasRuleExpired(rules: DynamicRules): boolean {
    if (rules.expiresAt === null) return false;
    return new Date(rules.expiresAt).getTime() <= Date.now();
  }

  /* The twin of _persist_last_known_rules: on every accepted rule update
     the snapshot lands in Redis (when a handler is present) and in the
     dynamicRulesCachePath file (when configured). Every failure mode logs
     and continues: persistence is a redundancy tier, never the update's
     success criterion. */
  async persistLastKnownRules(rules: DynamicRules): Promise<void> {
    let payload: string;
    try {
      payload = dumpLastKnownRulesSnapshot(rules);
    } catch (e) {
      this.logger.error(`Failed to build last-known dynamic rules snapshot: ${e}`);
      return;
    }

    if (this.redisHandler) {
      try {
        await this.redisHandler.setKey(
          DYNAMIC_RULES_REDIS_NAMESPACE, LAST_KNOWN_RULES_KEY, payload,
        );
      } catch (e) {
        this.logger.error(`Failed to persist dynamic rules to Redis: ${e}`);
      }
    }

    const cachePath = this.config.dynamicRulesCachePath;
    if (cachePath === null) return;
    try {
      await writeLastKnownRulesFile(cachePath, payload);
    } catch (e) {
      this.logger.error(
        `Failed to persist dynamic rules to cache file ${cachePath}: ${e}`,
      );
    }
  }

  /* The reference _rule_update_loop fetches immediately and then sleeps one
     interval per cycle: the first fetch runs in the background (the
     reference creates a task), so initialization never waits on the SaaS. */
  private startUpdateLoop(): void {
    if (this.updateTimer) return;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const tick = () => { this.updateRules().catch((e) => this.logger.error(`Rule update failed: ${e}`)); };
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    this.updateTimer = setInterval(tick, this.config.dynamicRuleInterval * 1000);
    tick();
  }

  /* The twin of _send_rule_event (guard_core/handlers/_dynamic_rule_events.py):
     system-scoped events with the dynamic_rules handler name; dispatch
     failures never propagate. */
  private async sendRuleEvent(
    eventType: string,
    actionTaken: string,
    reason: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.agentHandler) return;
    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress: 'system',
        actionTaken,
        reason,
        handlerName: 'dynamic_rules',
        metadata,
      });
    } catch { /* never throw */ }
  }

  /* Overlapping updates share one run (the background first fetch and a
     forced update must not apply the same rule twice, which would halve the
     emergency auto-ban threshold twice). */
  async updateRules(): Promise<void> {
    if (this.updateInFlight !== null) return this.updateInFlight;
    this.updateInFlight = this.runUpdate().finally(() => { this.updateInFlight = null; });
    return this.updateInFlight;
  }

  private async runUpdate(): Promise<void> {
    if (!this.agentHandler) return;

    try {
      await this.checkRuleExpiry();

      const rawRules = await this.agentHandler.getDynamicRules();
      if (!rawRules) return;

      const parsed = DynamicRulesSchema.safeParse(rawRules);
      if (!parsed.success) {
        this.logger.warn(`Invalid dynamic rules: ${parsed.error.message}`);
        return;
      }

      const rules = parsed.data;

      if (this.rejectIfAlreadyExpired(rules)) return;

      if (this.currentRules &&
          this.currentRules.ruleId === rules.ruleId &&
          this.currentRules.version >= rules.version) {
        return;
      }

      /* Reference _send_rule_received_event: EVENT_DYNAMIC_RULE_UPDATED fires
         when a fresh rule payload is accepted, before it applies. */
      await this.sendRuleEvent(
        'dynamic_rule_updated', 'rules_received',
        `Received updated rules ${rules.ruleId} v${rules.version}`,
        {
          ruleId: rules.ruleId,
          version: rules.version,
          previousVersion: this.currentRules?.version ?? 0,
        },
      );

      const emergencyActivated = rules.emergencyMode &&
        this.currentRules?.emergencyMode !== true;

      await this.applyRules(rules);
      this.currentRules = rules;
      this.lastUpdate = Date.now() / 1000;

      this.logger.info(`Applied dynamic rules: ${rules.ruleId} v${rules.version}`);

      /* Reference order (dynamic_rule_handler.update_rules +
         _dynamic_rule_application._activate_emergency_mode): the emergency
         lockdown event fires during the apply step, before the
         EVENT_DYNAMIC_RULE_APPLIED close-out. */
      if (emergencyActivated) {
        await this.sendRuleEvent(
          'emergency_mode_activated', 'emergency_lockdown',
          '[EMERGENCY MODE] activated via dynamic rules',
          {
            whitelistCount: rules.emergencyWhitelist.length,
            whitelist: rules.emergencyWhitelist.slice(0, 10),
          },
        );
      }

      /* Reference _apply_rules tail: the accepted rules become the
         last-known snapshot (Redis + the dynamicRulesCachePath file) before
         the applied close-out. Persistence failures never fail the
         update. */
      await this.persistLastKnownRules(rules);

      /* Reference _send_rule_applied_event. */
      await this.sendRuleEvent(
        'dynamic_rule_applied', 'rules_updated',
        `Applied dynamic rules ${rules.ruleId} v${rules.version}`,
        {
          ruleId: rules.ruleId,
          version: rules.version,
          ipBans: rules.ipBlacklist.length,
          countryBlocks: rules.blockedCountries.length,
          emergencyMode: rules.emergencyMode,
        },
      );
    } catch (e) {
      this.logger.error(`Failed to fetch dynamic rules: ${e}`);
    }
  }

  getCurrentRules(): DynamicRules | null {
    return this.currentRules;
  }

  /* The twin of _check_rule_expiry: an active rule whose expiresAt has
     passed retires before the fetch, restoring the base config snapshot
     taken before the first rule applied. */
  private checkRuleExpiry(): void {
    const rules = this.currentRules;
    if (rules === null || rules.expiresAt === null) return;
    if (new Date(rules.expiresAt).getTime() > Date.now()) return;
    if (this.activeBaseSnapshot !== null) this.restoreConfig(this.activeBaseSnapshot);
    this.currentRules = null;
    this.activeBaseSnapshot = null;
    this.logger.info(
      `Dynamic rule ${rules.ruleId} v${rules.version} expired; restored base config`,
    );
  }

  /* The twin of _reject_if_already_expired: a payload that is dead on
     arrival never applies and never persists; the skip warning fires once
     per (ruleId, version) so a stuck expired payload cannot spam the log
     every cycle. */
  private rejectIfAlreadyExpired(rules: DynamicRules): boolean {
    if (!this.hasRuleExpired(rules)) return false;
    const key = `${rules.ruleId}:${rules.version}`;
    if (this.lastSkippedExpiredRule !== key) {
      this.lastSkippedExpiredRule = key;
      this.logger.warn(
        `Dynamic rule ${rules.ruleId} v${rules.version} already expired on receipt; ignoring`,
      );
    }
    return true;
  }

  private snapshotConfig(): ConfigSnapshot {
    const config = this.config as unknown as Record<string, unknown>;
    const snapshot: ConfigSnapshot = {};
    for (const field of SNAPSHOT_FIELDS) snapshot[field] = structuredClone(config[field]);
    return snapshot;
  }

  private restoreConfig(snapshot: ConfigSnapshot): void {
    const config = this.config as unknown as Record<string, unknown>;
    for (const field of SNAPSHOT_FIELDS) config[field] = structuredClone(snapshot[field]);
  }

  /* The twin of _apply_rules (guard_core/handlers/_dynamic_rule_application.py
     + dynamic_rule_handler.py): IP bans and unbans, the blocking lists, the
     rate limits, the feature toggles, then emergency mode, all mutating the
     live config the request checks read. Every apply starts from the base
     snapshot, so a new version replaces the previous one instead of stacking
     on it. A failed apply restores the config as it was before the call and
     rethrows; the first successful apply keeps its snapshot as the base that
     expiry restores. */
  private async applyRules(rules: DynamicRules): Promise<void> {
    const previous = this.snapshotConfig();
    /* Each version overlays the true base, never the previous version's
       result (the reference _apply_rules): restore the base first so the
       emergency halving and the replaced collections do not compound. */
    if (this.activeBaseSnapshot !== null) this.restoreConfig(this.activeBaseSnapshot);
    const snapshot = this.snapshotConfig();
    try {
      await this.applyIpRules(rules);
      await this.applyBlockingRules(rules);
      if (rules.globalRateLimit || Object.keys(rules.endpointRateLimits).length > 0) {
        this.applyRateLimitRules(rules);
      }
      this.applyFeatureToggles(rules);
      if (rules.emergencyMode) this.activateEmergencyMode(rules.emergencyWhitelist);
    } catch (e) {
      this.restoreConfig(previous);
      this.logger.error(`Failed to apply dynamic rules: ${e}`);
      throw e;
    }
    if (this.currentRules === null && this.activeBaseSnapshot === null) {
      this.activeBaseSnapshot = snapshot;
    }
  }

  private redactPatterns(patterns: string[]): string[] {
    return patterns.map((pattern) => redactBlobForDisplay(pattern, null, null, null));
  }

  /* _apply_ip_rules: per-IP failures log and continue. */
  private async applyIpRules(rules: DynamicRules): Promise<void> {
    const ban = this.targets.ipBanManager ?? null;
    for (const ip of rules.ipBlacklist) {
      try {
        if (ban === null) throw new Error('no IP ban manager attached');
        if (await ban.banIp(ip, rules.ipBanDuration, 'dynamic_rule')) {
          this.logger.info(`Dynamic rule: Banned IP ${ip} for ${rules.ipBanDuration}s`);
        }
      } catch (e) {
        this.logger.error(`Failed to ban IP ${ip}: ${e}`);
      }
    }
    for (const ip of rules.ipWhitelist) {
      try {
        if (ban === null) throw new Error('no IP ban manager attached');
        await ban.unbanIp(ip);
        this.logger.info(`Dynamic rule: Whitelisted IP ${ip}`);
      } catch (e) {
        this.logger.error(`Failed to whitelist IP ${ip}: ${e}`);
      }
    }
  }

  private async applyBlockingRules(rules: DynamicRules): Promise<void> {
    if (rules.blockedCountries.length > 0 || rules.whitelistCountries.length > 0) {
      this.applyCountryRules(rules.blockedCountries, rules.whitelistCountries);
    }
    if (rules.blockedCloudProviders.size > 0) {
      // The rule schema already restricts providers to the known set.
      this.config.blockCloudProviders = new Set(rules.blockedCloudProviders);
      this.logger.info(`Dynamic rule: Blocked cloud providers ${[...rules.blockedCloudProviders]}`);
    }
    if (rules.blockedUserAgents.length > 0) this.applyUserAgentRules(rules.blockedUserAgents);
    if (rules.suspiciousPatterns.length > 0) await this.applyPatternRules(rules.suspiciousPatterns);
  }

  /* _apply_country_rules: without a geo handler or ipinfo token nothing can
     resolve an IP to a country, so the rule warns and is skipped. */
  private applyCountryRules(blocked: string[], allowed: string[]): void {
    if (!this.config.geoIpHandler && !this.config.ipinfoToken) {
      this.logger.warn(
        `Dynamic rule: country rules cannot take effect (blocked=${blocked}, allowed=${allowed}); no geoIpHandler or ipinfoToken is configured to resolve IPs to countries`,
      );
      return;
    }
    if (blocked.length > 0) {
      this.config.blockedCountries = blocked.map((c) => c.toUpperCase());
      this.logger.info(`Dynamic rule: Blocked countries ${[...this.config.blockedCountries].sort()}`);
    }
    if (allowed.length > 0) {
      this.config.whitelistCountries = allowed.map((c) => c.toUpperCase());
      this.logger.info(`Dynamic rule: Whitelisted countries ${[...this.config.whitelistCountries].sort()}`);
    }
  }

  /* _apply_user_agent_rules: every pattern runs through the ReDoS validator
     before it joins the live list the user-agent check compiles per request. */
  private applyUserAgentRules(userAgents: string[]): void {
    const compiler = new PatternCompiler();
    const valid: string[] = [];
    const rejected: Array<[string, string]> = [];
    for (const pattern of userAgents) {
      const [isSafe, reason] = compiler.validatePatternSafety(pattern);
      if (isSafe) valid.push(pattern);
      else rejected.push([redactBlobForDisplay(pattern, null, null, null), reason]);
    }
    this.config.blockedUserAgents = valid;
    if (rejected.length > 0) {
      this.logger.warn(
        `Dynamic rule: rejected blockedUserAgents patterns failing the ReDoS validator: ${JSON.stringify(rejected)}`,
      );
    }
    this.logger.info(`Dynamic rule: Blocked user agents ${this.redactPatterns(valid)}`);
  }

  private async applyPatternRules(patterns: string[]): Promise<void> {
    const sus = this.targets.susPatternsManager ?? null;
    const added: string[] = [];
    const rejected: string[] = [];
    /* A pattern the registry already holds is skipped (the reference
       _apply_pattern_rules), so a later version does not re-add it. */
    const known = new Set(sus?.getAllPatterns() ?? []);
    for (const pattern of patterns.filter((p) => !known.has(p))) {
      if (sus !== null && await sus.addPattern(pattern)) added.push(pattern);
      else rejected.push(pattern);
    }
    if (added.length > 0) {
      this.logger.info(`Dynamic rule: Added suspicious patterns ${this.redactPatterns(added)}`);
    }
    if (rejected.length > 0) {
      this.logger.warn(`Dynamic rule: rejected patterns ${this.redactPatterns(rejected)}`);
    }
  }

  private applyRateLimitRules(rules: DynamicRules): void {
    if (rules.globalRateLimit) {
      this.config.rateLimit = rules.globalRateLimit;
      if (rules.globalRateWindow) this.config.rateLimitWindow = rules.globalRateWindow;
      this.logger.info(`Dynamic rule: Global rate limit ${rules.globalRateLimit} per ${rules.globalRateWindow}s`);
    }
    if (Object.keys(rules.endpointRateLimits).length > 0) {
      this.config.endpointRateLimits = { ...rules.endpointRateLimits };
      this.logger.info(
        `Dynamic rule: Applied endpoint-specific rate limits for ${Object.keys(rules.endpointRateLimits).length} endpoints: ${Object.keys(rules.endpointRateLimits)}`,
      );
    }
  }

  /* _apply_feature_toggles: only non-null overrides touch the live config. */
  private applyFeatureToggles(rules: DynamicRules): void {
    if (rules.enablePenetrationDetection !== null) {
      this.config.enablePenetrationDetection = rules.enablePenetrationDetection;
      this.logger.info(`Dynamic rule: Penetration detection ${rules.enablePenetrationDetection}`);
    }
    if (rules.enableIpBanning !== null) {
      this.config.enableIpBanning = rules.enableIpBanning;
      this.logger.info(`Dynamic rule: IP banning ${rules.enableIpBanning}`);
    }
    if (rules.enableRateLimiting !== null) {
      this.config.enableRateLimiting = rules.enableRateLimiting;
      this.logger.info(`Dynamic rule: Rate limiting ${rules.enableRateLimiting}`);
    }
    if (rules.enableRateLimitAutoBan !== null) {
      this.config.enableRateLimitAutoBan = rules.enableRateLimitAutoBan;
      this.logger.info(`Dynamic rule: Rate-limit auto-ban ${rules.enableRateLimitAutoBan}`);
    }
    if (rules.autoBanThreshold !== null) {
      this.config.autoBanThreshold = rules.autoBanThreshold;
      this.logger.info(`Dynamic rule: Auto-ban threshold ${rules.autoBanThreshold}`);
    }
    if (rules.autoBanDuration !== null) {
      this.config.autoBanDuration = rules.autoBanDuration;
      this.logger.info(`Dynamic rule: Auto-ban duration ${rules.autoBanDuration}`);
    }
  }

  /* _activate_emergency_mode: lockdown with the whitelist, and the auto-ban
     threshold halves (max(1, t // 2)). The activation event is sent by
     updateRules. */
  private activateEmergencyMode(whitelist: string[]): void {
    this.logger.error('[EMERGENCY MODE] ACTIVATED - Enhanced security posture enabled');
    this.config.emergencyMode = true;
    this.config.emergencyWhitelist = [...whitelist];
    const original = this.config.autoBanThreshold;
    this.config.autoBanThreshold = Math.max(1, Math.floor(original / 2));
    this.logger.warn(`[EMERGENCY MODE] Reduced auto-ban threshold from ${original} to ${this.config.autoBanThreshold}`);
  }

  /* matchEvent mirrors DynamicRuleManager.match_event
     (guard_core/handlers/dynamic_rule_handler.py): the active rule answers
     for the event when its IP is in the rule's lists, its country is
     blocked, or its type rides a rule the manager applied. Answers the
     (ruleId, version) correlation pair or null (the reference tuple|None).
     Consumed by the event enricher's guard.rule.id / guard.rule.version
     keys. */
  matchEvent(event: {
    eventType?: string | null;
    ipAddress?: string | null;
    country?: string | null;
  }): { ruleId: string; version: number } | null {
    const rules = this.currentRules;
    if (rules === null) return null;
    if (
      this.eventMatchesIp(event, rules) ||
      this.eventMatchesCountry(event, rules) ||
      this.eventMatchesType(event, rules)
    ) {
      return { ruleId: rules.ruleId, version: rules.version };
    }
    return null;
  }

  private eventMatchesIp(
    event: { ipAddress?: string | null },
    rules: DynamicRules,
  ): boolean {
    const ip = event.ipAddress;
    if (!ip) return false;
    return rules.ipBlacklist.includes(ip) || rules.ipWhitelist.includes(ip);
  }

  private eventMatchesCountry(
    event: { country?: string | null },
    rules: DynamicRules,
  ): boolean {
    const country = event.country;
    return Boolean(country) && rules.blockedCountries.includes(country as string);
  }

  private eventMatchesType(
    event: { eventType?: string | null },
    rules: DynamicRules,
  ): boolean {
    switch (event.eventType) {
      case 'rate_limited':
        return rules.globalRateLimit !== null || Object.keys(rules.endpointRateLimits).length > 0;
      case 'cloud_blocked':
        return rules.blockedCloudProviders.size > 0;
      case 'user_agent_blocked':
        return rules.blockedUserAgents.length > 0;
      default:
        return false;
    }
  }

  async forceUpdate(): Promise<void> {
    await this.updateRules();
  }

  async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}
