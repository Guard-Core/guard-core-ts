/* CompositeAgentHandler, the TS port of
   guard_core/core/events/composite_handler.py: multi-sink fan-out to several
   AgentHandlerProtocol implementations behind one handler.

   Parity behaviors:
   - events/metrics flow through the event filter (muted types drop) and the
     optional enricher before fanning out
   - a failing sink never breaks the fan-out or the request: each
     send/stop/flush failure is caught and logged
   - start() records which sinks failed to start (degraded/failedHandlers)
   - get_dynamic_rules returns the first non-null result across sinks
   - health_check is true only when every sink (if any) passes */

import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { RedisHandlerProtocol } from '../../protocols/redis.js';
import type { Logger } from '../../models/logger.js';
import { defaultLogger } from '../../models/logger.js';
import { EventFilter } from './event-filter.js';
import type { AgentEventEnricher } from './event-filter.js';

export class CompositeAgentHandler implements AgentHandlerProtocol {
  private readonly handlers: AgentHandlerProtocol[];
  private readonly eventFilter: EventFilter;
  private readonly enricher: AgentEventEnricher | null;
  private readonly logger: Logger;
  private started = false;
  private failedHandlers: string[] = [];

  constructor(
    handlers: AgentHandlerProtocol[],
    options: {
      eventFilter?: EventFilter;
      enricher?: AgentEventEnricher | null;
      logger?: Logger;
    } = {},
  ) {
    this.handlers = handlers;
    this.eventFilter = options.eventFilter ?? new EventFilter();
    this.enricher = options.enricher ?? null;
    this.logger = options.logger ?? defaultLogger;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get isDegraded(): boolean {
    return this.started && this.failedHandlers.length > 0;
  }

  getFailedHandlers(): string[] {
    return [...this.failedHandlers];
  }

  async sendEvent(event: unknown): Promise<void> {
    const eventType = (event as { eventType?: unknown } | null)?.eventType;
    if (typeof eventType === 'string' && !this.eventFilter.isEventAllowed(eventType)) {
      return;
    }
    if (this.enricher !== null) {
      await this.enricher.enrichEvent(event);
    }
    for (const handler of this.handlers) {
      try {
        await handler.sendEvent(event);
      } catch (e) {
        this.logger.error(`handler.sendEvent failed: ${e}`);
      }
    }
  }

  async sendMetric(metric: unknown): Promise<void> {
    const metricType = (metric as { metricType?: unknown } | null)?.metricType;
    if (typeof metricType === 'string' && !this.eventFilter.isMetricAllowed(metricType)) {
      return;
    }
    if (this.enricher !== null) {
      await this.enricher.enrichMetric(metric);
    }
    for (const handler of this.handlers) {
      try {
        await handler.sendMetric(metric);
      } catch (e) {
        this.logger.error(`handler.sendMetric failed: ${e}`);
      }
    }
  }

  async initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.initializeRedis(redisHandler);
      } catch (e) {
        this.logger.error(`handler.initializeRedis failed: ${e}`);
      }
    }
  }

  async start(): Promise<void> {
    this.failedHandlers = [];
    for (const handler of this.handlers) {
      const handlerName = handler.constructor.name;
      try {
        await handler.start();
      } catch (e) {
        this.failedHandlers.push(handlerName);
        this.logger.error(`Handler ${handlerName} failed to start: ${e}`);
      }
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.stop();
      } catch (e) {
        this.logger.error(`handler.stop failed: ${e}`);
      }
    }
  }

  async flushBuffer(): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler.flushBuffer();
      } catch (e) {
        this.logger.error(`handler.flushBuffer failed: ${e}`);
      }
    }
  }

  async getDynamicRules(): Promise<unknown | null> {
    for (const handler of this.handlers) {
      try {
        const result = await handler.getDynamicRules();
        if (result !== null && result !== undefined) return result;
      } catch (e) {
        this.logger.error(`handler.getDynamicRules failed: ${e}`);
      }
    }
    return null;
  }

  async healthCheck(): Promise<boolean> {
    if (this.handlers.length === 0) return true;
    const results: boolean[] = [];
    for (const handler of this.handlers) {
      try {
        results.push(await handler.healthCheck());
      } catch (e) {
        this.logger.error(`handler.healthCheck failed: ${e}`);
        results.push(false);
      }
    }
    return results.every(Boolean);
  }
}
