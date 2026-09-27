import type { Logger } from '../../models/logger.js';
import type { RouteConfig } from '../../models/route-config.js';
import type { BehaviorRule } from '../../models/behavior-rule.js';
import type { BehaviorRuleConfig } from '../../models/config.js';
import { BehaviorRule as BehaviorRuleClass } from '../../models/behavior-rule.js';
import type { GuardRequest } from '../../protocols/request.js';
import type { GuardResponse } from '../../protocols/response.js';
import type { BehaviorTracker } from '../../handlers/behavior.js';
import type { SecurityEventBus } from '../events/event-bus.js';

/* Suspicious-count reader for the correlate_with_detection threshold
   halving: the middleware's shared per-IP category counts. */
export type SuspiciousCountsReader = () => Map<string, Map<string, number>>;

/* config_to_rule (guard_core/handlers/behavior_handler.py): the zod-resolved
   BehaviorRuleConfig copies field by field into the runtime rule. */
export function configToRule(cfg: BehaviorRuleConfig): BehaviorRule {
  return new BehaviorRuleClass(
    cfg.ruleType,
    cfg.threshold,
    cfg.window,
    cfg.pattern,
    cfg.action,
    null,
    cfg.banDuration,
    cfg.correlateWithDetection,
  );
}

export class BehavioralProcessor {
  private guardDecorator: { behaviorTracker: BehaviorTracker } | null = null;
  private defaultTracker: BehaviorTracker | null = null;
  private suspiciousCounts: SuspiciousCountsReader | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly eventBus: SecurityEventBus,
  ) {}

  setGuardDecorator(decorator: { behaviorTracker: BehaviorTracker }): void {
    this.guardDecorator = decorator;
  }

  /* Engine-owned tracker used when no route decorator supplies one: the
     pipeline's global behavior rules must run even without a decorator
     (the reference resolves the tracker through the request state /
     decorator, and the pipeline wires the engine-owned instance here). */
  setDefaultTracker(tracker: BehaviorTracker): void {
    this.defaultTracker = tracker;
  }

  setSuspiciousCountsReader(reader: SuspiciousCountsReader): void {
    this.suspiciousCounts = reader;
  }

  private trackerFor(): BehaviorTracker | null {
    if (this.guardDecorator) return this.guardDecorator.behaviorTracker;
    return this.defaultTracker;
  }

  async processUsageRules(
    request: GuardRequest,
    clientIp: string,
    routeConfig: RouteConfig,
  ): Promise<void> {
    const tracker = this.trackerFor();
    if (!tracker) return;

    const endpointId = this.getEndpointId(request);

    for (const rule of routeConfig.behaviorRules) {
      if (rule.ruleType !== 'usage' && rule.ruleType !== 'frequency') continue;
      const exceeded = await tracker.trackEndpointUsage(endpointId, clientIp, rule);
      if (!exceeded) continue;

      const details = `${rule.threshold} calls in ${rule.window}s`;
      await this.eventBus.sendMiddlewareEvent(
        'decorator_violation', request, 'behavioral_action_triggered',
        `Behavioral ${rule.ruleType} threshold exceeded: ${details}`,
        {
          decoratorType: 'behavioral',
          violationType: rule.ruleType,
          threshold: rule.threshold,
          window: rule.window,
          action: rule.action,
          endpointId,
        },
      );

      await tracker.applyAction(rule, clientIp, endpointId, `Usage threshold exceeded: ${details}`);
    }
  }

  async processReturnRules(
    request: GuardRequest,
    response: GuardResponse,
    clientIp: string,
    routeConfig: RouteConfig,
  ): Promise<void> {
    const tracker = this.trackerFor();
    if (!tracker) return;

    const endpointId = this.getEndpointId(request);

    for (const rule of routeConfig.behaviorRules) {
      if (rule.ruleType !== 'return_pattern') continue;
      const detected = await tracker.trackReturnPattern(endpointId, clientIp, response, rule);
      if (detected !== true) continue;

      const details = `${rule.threshold} for '${rule.pattern}' in ${rule.window}s`;
      await this.eventBus.sendMiddlewareEvent(
        'decorator_violation', request, 'behavioral_action_triggered',
        `Return pattern threshold exceeded: ${details}`,
        {
          decoratorType: 'behavioral',
          violationType: 'return_pattern',
          threshold: rule.threshold,
          window: rule.window,
          pattern: rule.pattern,
          action: rule.action,
          endpointId,
        },
      );

      await tracker.applyAction(rule, clientIp, endpointId, `Return pattern threshold exceeded: ${details}`);
    }
  }

  /* The twin of process_global_return_rules over the config's global rules,
     including the correlate_with_detection threshold halving driven by the
     suspicious-activity counts for the client IP. */
  async processGlobalReturnRules(
    request: GuardRequest,
    response: GuardResponse,
    clientIp: string,
    rules: readonly BehaviorRule[],
  ): Promise<void> {
    const tracker = this.trackerFor();
    if (!tracker) return;

    const endpointId = this.getEndpointId(request);
    const correlatedCategories = this.collectCorrelatedCategories(clientIp);

    for (const rule of rules) {
      if (rule.ruleType !== 'return_pattern') continue;

      const correlationActive = rule.correlateWithDetection && correlatedCategories.length > 0;
      const effectiveThreshold = correlationActive
        ? Math.max(1, Math.floor(rule.threshold / 2))
        : rule.threshold;

      const detected = await tracker.trackReturnPattern(
        endpointId, clientIp, response, rule, effectiveThreshold,
      );
      if (detected !== true) continue;

      const details =
        `${effectiveThreshold} for '${rule.pattern}' in ${rule.window}s` +
        `${correlationActive ? ' (correlated)' : ''}`;
      await this.eventBus.sendMiddlewareEvent(
        'decorator_violation', request, 'behavioral_action_triggered',
        `Global return pattern threshold exceeded: ${details}`,
        {
          decoratorType: 'behavioral_global',
          violationType: 'return_pattern',
          threshold: effectiveThreshold,
          window: rule.window,
          pattern: rule.pattern,
          action: rule.action,
          endpointId,
          correlation: correlationActive,
          correlatedCategories: correlationActive ? correlatedCategories : [],
        },
      );

      await tracker.applyAction(rule, clientIp, endpointId, `Global return pattern threshold exceeded: ${details}`);
    }
  }

  /* The twin of _collect_correlated_categories: the detection categories
     with a positive suspicious count for the IP, sorted. */
  private collectCorrelatedCategories(clientIp: string): string[] {
    const counts = this.suspiciousCounts?.();
    if (!counts) return [];
    const perIp = counts.get(clientIp);
    if (!perIp) return [];
    return [...perIp.entries()]
      .filter(([, n]) => n > 0)
      .map(([category]) => category)
      .sort();
  }

  getEndpointId(request: GuardRequest): string {
    const endpointId = (request.state as Record<string, unknown>).guardEndpointId;
    if (typeof endpointId === 'string') return endpointId;
    return `${request.method}:${request.urlPath}`;
  }
}
