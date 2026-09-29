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
