/* Event/metric filter and enrichment contracts for agent handler fan-out,
   the TS port of guard_core/core/events/event_types.py (EventFilter) and the
   enricher seam the composite handler accepts (reference composite_handler.py;
   the reference EventEnricher/ThreatScorer implementation lives in
   enricher.ts, which satisfies the AgentEventEnricher interface here).

   Metric type constants mirror METRIC_RESPONSE_TIME / METRIC_REQUEST_COUNT /
   METRIC_ERROR_RATE. */

export const METRIC_RESPONSE_TIME = 'response_time';
export const METRIC_REQUEST_COUNT = 'request_count';
export const METRIC_ERROR_RATE = 'error_rate';

export const METRIC_TYPE_VALUES: ReadonlySet<string> = new Set([
  METRIC_RESPONSE_TIME,
  METRIC_REQUEST_COUNT,
  METRIC_ERROR_RATE,
]);

export class EventFilter {
  readonly mutedEventTypes: ReadonlySet<string>;
  readonly mutedMetricTypes: ReadonlySet<string>;

  constructor(
    mutedEventTypes: Iterable<string> = [],
    mutedMetricTypes: Iterable<string> = [],
  ) {
    this.mutedEventTypes = new Set(mutedEventTypes);
    this.mutedMetricTypes = new Set(mutedMetricTypes);
  }

  isEventAllowed(eventType: string): boolean {
    return !this.mutedEventTypes.has(eventType);
  }

  isMetricAllowed(metricType: string): boolean {
    return !this.mutedMetricTypes.has(metricType);
  }
}

/* Enrichment seam: a composite handler runs every event/metric through the
   enricher before fanning out (reference CompositeAgentHandler.__init__). */
export interface AgentEventEnricher {
  enrichEvent(event: unknown): Promise<void>;
  enrichMetric(metric: unknown): Promise<void>;
}
