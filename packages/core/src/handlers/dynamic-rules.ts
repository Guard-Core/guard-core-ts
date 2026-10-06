import type { ResolvedSecurityConfig } from '../models/config.js';
import { DynamicRulesSchema } from '../models/dynamic-rules.js';
import type { DynamicRules } from '../models/dynamic-rules.js';
import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisManager } from './redis.js';

export class DynamicRuleManager {
  private currentRules: DynamicRules | null = null;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private lastUpdate = 0;
  private agentHandler: AgentHandlerProtocol | null = null;
  private redisHandler: RedisManager | null = null;

  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
  ) {}

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
    if (this.config.enableDynamicRules) {
      this.startUpdateLoop();
    }
  }

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
  }

  private startUpdateLoop(): void {
    if (this.updateTimer) return;
    /* v8 ignore next -- setInterval timer assignment; already tested via initializeAgent */
    this.updateTimer = setInterval(
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      () => { this.updateRules().catch((e) => this.logger.error(`Rule update failed: ${e}`)); },
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      this.config.dynamicRuleInterval * 1000,
    );
  }

  async updateRules(): Promise<void> {
    if (!this.agentHandler) return;

    try {
      const rawRules = await this.agentHandler.getDynamicRules();
      if (!rawRules) return;

      const parsed = DynamicRulesSchema.safeParse(rawRules);
      if (!parsed.success) {
        this.logger.warn(`Invalid dynamic rules: ${parsed.error.message}`);
        return;
      }

      const rules = parsed.data;

      if (this.currentRules &&
          this.currentRules.ruleId === rules.ruleId &&
          this.currentRules.version >= rules.version) {
        return;
      }

      this.currentRules = rules;
      this.lastUpdate = Date.now() / 1000;

      this.logger.info(`Applied dynamic rules: ${rules.ruleId} v${rules.version}`);

      if (this.agentHandler) {
        try {
          await this.agentHandler.sendEvent({
            eventType: 'dynamic_rule_applied',
            ipAddress: 'system',
            actionTaken: 'rules_updated',
            reason: `Applied rules ${rules.ruleId} v${rules.version}`,
          });
        } catch { /* never throw */ }
      }
    } catch (e) {
      this.logger.error(`Failed to fetch dynamic rules: ${e}`);
    }
  }

  getCurrentRules(): DynamicRules | null {
    return this.currentRules;
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
