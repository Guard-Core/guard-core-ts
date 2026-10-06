/* LogfireHandler, the TS port of guard_core/core/events/logfire_handler.py.

   The reference configures the global logfire instance behind an optional
   import. guard-core-ts keeps the engine dependency-free: the logfire client
   is supplied through the LogfireClient injection seam (the application
   wires `import logfire` to it). With no client the handler is disabled but
   harmless, mirroring the reference's "logfire not installed" path, and an
   already-configured host logfire instance is adopted without re-configuring
   (the DEFAULT_LOGFIRE_INSTANCE._initialized check).

   Mapping parity with the reference:
   - event -> span "guard.event.{eventType}" carrying event_type, ip_address,
     action_taken, reason, endpoint, method, status_code and the enrichment
     metadata keys starting with "guard." (except traceparent/tracestate)
   - metric -> info "guard.metric.{metricType}" with value, endpoint and the
     remaining tags */

import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { RedisHandlerProtocol } from '../../protocols/redis.js';
import type { Logger } from '../../models/logger.js';
import { defaultLogger } from '../../models/logger.js';

export interface LogfireClient {
  /** True when a host application (or an earlier guard instance) already
   *  configured logfire in this process; the handler adopts it instead of
   *  calling configure again. */
  isConfigured(): boolean;
  configure(serviceName: string): void;
  span(name: string, attributes: Record<string, unknown>): void;
  info(message: string, attributes: Record<string, unknown>): void;
  shutdown(): Promise<void>;
}

export interface LogfireHandlerConfig {
  serviceName: string;
  /** The wired logfire client; null (the default) keeps the handler
   *  disabled. */
  client?: LogfireClient | null;
}

interface GuardEventShape {
  eventType?: unknown;
  ipAddress?: unknown;
  actionTaken?: unknown;
  reason?: unknown;
  endpoint?: unknown;
  method?: unknown;
  statusCode?: unknown;
  metadata?: unknown;
}

interface GuardMetricShape {
  metricType?: unknown;
  value?: unknown;
  tags?: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export class LogfireHandler implements AgentHandlerProtocol {
  private readonly config: LogfireHandlerConfig;
  private readonly logger: Logger;
  private readonly client: LogfireClient | null;
  private started = false;
  private configuredByGuard = false;

  constructor(config: LogfireHandlerConfig, logger: Logger = defaultLogger) {
    this.config = config;
    this.logger = logger;
    this.client = config.client ?? null;
  }

  async start(): Promise<void> {
    if (this.client === null) {
      this.logger.warn('logfire not wired, Logfire handler disabled');
      return;
    }
    if (this.started) return;
    if (this.client.isConfigured()) {
      this.started = true;
      this.logger.warn(
        'logfire is already configured for this process (by a host '
        + 'application or an earlier guard instance); the guard '
        + `will not apply its logfire_service_name ${this.config.serviceName}`,
      );
      return;
    }
    this.client.configure(this.config.serviceName);
    this.configuredByGuard = true;
    this.started = true;
  }

  async stop(): Promise<void> {
    if (this.client === null) return;
    if (this.configuredByGuard) {
      await this.client.shutdown();
      this.configuredByGuard = false;
    }
    this.started = false;
  }

  async sendEvent(event: unknown): Promise<void> {
    if (this.client === null) return;
    const e = (event ?? {}) as GuardEventShape;
    const eventType = str(e.eventType) || 'unknown';
    const metadata = (e.metadata ?? null) as Record<string, unknown> | null;

    const attributes: Record<string, unknown> = {
      event_type: eventType,
      ip_address: str(e.ipAddress),
      action_taken: str(e.actionTaken),
      reason: str(e.reason),
      endpoint: str(e.endpoint),
      method: str(e.method),
      status_code: num(e.statusCode),
    };

    if (metadata !== null && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        if (
          key.startsWith('guard.') &&
          key !== 'traceparent' && key !== 'tracestate' &&
          value !== null && value !== undefined
        ) {
          attributes[key] = value;
        }
      }
    }

    this.client.span(`guard.event.${eventType}`, attributes);
  }

  async sendMetric(metric: unknown): Promise<void> {
    if (this.client === null) return;
    const m = (metric ?? {}) as GuardMetricShape;
    const metricType = str(m.metricType) || 'unknown';
    const value = num(m.value);
    const tags = (m.tags ?? null) as Record<string, unknown> | null;

    const attributes: Record<string, unknown> = { value };
    if (tags !== null && typeof tags === 'object') {
      for (const [key, tagValue] of Object.entries(tags)) {
        /* The reference strips value/endpoint collisions from the tag set:
           endpoint becomes its own attribute and value is already carried. */
        if (key === 'value') continue;
        attributes[key] = tagValue;
      }
    }

    this.client.info(`guard.metric.${metricType}`, attributes);
  }

  async initializeRedis(_redisHandler: RedisHandlerProtocol): Promise<void> { /* not applicable */ }

  async flushBuffer(): Promise<void> { /* not applicable */ }

  async getDynamicRules(): Promise<unknown | null> {
    return null;
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== null;
  }
}
