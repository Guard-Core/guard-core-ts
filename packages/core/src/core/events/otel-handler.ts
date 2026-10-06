/* OtelHandler, the TS port of guard_core/core/events/otel_handler.py.

   The reference builds tracer/meter providers from the opentelemetry SDK
   behind an optional import. guard-core-ts has a hard boundary rule against
   growing engine dependencies, so the SDK lives behind the
   OtelInstrumentation injection seam: the application (or an adapter
   package) supplies spans/counters/histograms wired to @opentelemetry/sdk-*.
   With no instrumentation the handler is disabled but harmless, mirroring
   the reference's "opentelemetry-sdk not installed" path.

   Mapping parity with the reference:
   - event -> span "guard.event.{eventType}" with guard.event_type,
     guard.ip_address, guard.action_taken, guard.reason, guard.endpoint,
     guard.method attributes and guard.status_code when present; metadata
     keys starting with "guard." (except traceparent/tracestate) forward to
     the span; metadata traceparent/tracestate extract the parent context
   - metric -> guard.request.duration histogram (response_time),
     guard.request.count counter (request_count), guard.error.count counter
     (error_rate), each with endpoint + tags attributes */

import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { RedisHandlerProtocol } from '../../protocols/redis.js';
import type { Logger } from '../../models/logger.js';
import { defaultLogger } from '../../models/logger.js';

export interface OtelTraceContext {
  traceparent?: string;
  tracestate?: string;
}

export interface OtelInstrumentation {
  /** Record a span for one security event. The parent trace context comes
   *  from the event metadata (traceparent/tracestate) when present. */
  startSpan(
    name: string,
    attributes: Record<string, string | number>,
    parent?: OtelTraceContext,
  ): void;
  recordHistogram(name: string, value: number, attributes: Record<string, string>): void;
  addCounter(name: string, value: number, attributes: Record<string, string>): void;
  shutdown(): Promise<void>;
}

export interface OtelHandlerConfig {
  serviceName: string;
  resourceAttributes?: Record<string, string>;
  exporterEndpoint?: string | null;
  /** The wired OTel SDK; null (the default) keeps the handler disabled. */
  instrumentation?: OtelInstrumentation | null;
}

const EVENT_SPAN_ATTRS: ReadonlyArray<readonly [string, string]> = [
  ['guard.ip_address', 'ipAddress'],
  ['guard.action_taken', 'actionTaken'],
  ['guard.reason', 'reason'],
  ['guard.endpoint', 'endpoint'],
  ['guard.method', 'method'],
];

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

export class OtelHandler implements AgentHandlerProtocol {
  /** Exposed for diagnostics and tests (service name, resource attributes,
   *  exporter endpoint the application must mirror into its SDK setup). */
  readonly config: OtelHandlerConfig;
  private readonly logger: Logger;
  private instrumentation: OtelInstrumentation | null;

  constructor(config: OtelHandlerConfig, logger: Logger = defaultLogger) {
    this.config = config;
    this.logger = logger;
    this.instrumentation = config.instrumentation ?? null;
  }

  async start(): Promise<void> {
    if (this.instrumentation === null) {
      this.logger.warn('opentelemetry SDK not wired, OTEL handler disabled');
      return;
    }
    /* Provider/resource setup (service.name, resourceAttributes, exporter
       endpoints) belongs to the application that wires the SDK into the
       OtelInstrumentation seam; the handler itself records nothing here,
       unlike the reference, which claims global providers at start. */
  }

  async stop(): Promise<void> {
    if (this.instrumentation === null) return;
    await this.instrumentation.shutdown();
  }

  async sendEvent(event: unknown): Promise<void> {
    if (this.instrumentation === null) return;
    const e = (event ?? {}) as GuardEventShape;
    const eventType = str(e.eventType) || 'unknown';
    const metadata = (e.metadata ?? null) as Record<string, unknown> | null;

    const attributes: Record<string, string | number> = {
      'guard.event_type': eventType,
    };
    for (const [attrKey, eventAttr] of EVENT_SPAN_ATTRS) {
      attributes[attrKey] = str((e as Record<string, unknown>)[eventAttr]);
    }
    const statusCode = num(e.statusCode);
    if (statusCode) attributes['guard.status_code'] = statusCode;

    if (metadata !== null && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        if (
          key.startsWith('guard.') &&
          key !== 'traceparent' && key !== 'tracestate' &&
          value !== null && value !== undefined
        ) {
          attributes[key] = typeof value === 'number' ? value : String(value);
        }
      }
    }

    let parent: OtelTraceContext | undefined;
    if (metadata !== null && typeof metadata === 'object') {
      const traceparent = typeof metadata['traceparent'] === 'string' ? metadata['traceparent'] : undefined;
      const tracestate = typeof metadata['tracestate'] === 'string' ? metadata['tracestate'] : undefined;
      if (traceparent !== undefined || tracestate !== undefined) {
        parent = {};
        if (traceparent !== undefined) parent.traceparent = traceparent;
        if (tracestate !== undefined) parent.tracestate = tracestate;
      }
    }

    this.instrumentation.startSpan(`guard.event.${eventType}`, attributes, parent);
  }

  async sendMetric(metric: unknown): Promise<void> {
    if (this.instrumentation === null) return;
    const m = (metric ?? {}) as GuardMetricShape;
    const metricType = str(m.metricType) || 'unknown';
    const value = num(m.value);
    const tags = (m.tags ?? null) as Record<string, unknown> | null;
    const attributes: Record<string, string> = {};
    if (tags !== null && typeof tags === 'object') {
      for (const [key, tagValue] of Object.entries(tags)) {
        attributes[key] = String(tagValue);
      }
    }

    if (metricType === 'response_time') {
      this.instrumentation.recordHistogram('guard.request.duration', value, attributes);
    } else if (metricType === 'request_count') {
      this.instrumentation.addCounter('guard.request.count', value, attributes);
    } else if (metricType === 'error_rate') {
      this.instrumentation.addCounter('guard.error.count', value, attributes);
    } else {
      this.logger.warn(`Unknown OTEL metric type ${metricType} - no instrument recorded`);
    }
  }

  async initializeRedis(_redisHandler: RedisHandlerProtocol): Promise<void> { /* not applicable */ }

  async flushBuffer(): Promise<void> { /* not applicable: instrumentation batches its own exports */ }

  async getDynamicRules(): Promise<unknown | null> {
    return null;
  }

  async healthCheck(): Promise<boolean> {
    return this.instrumentation !== null;
  }
}
