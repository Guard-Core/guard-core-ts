export type {
  AgentHandlerProtocol,
  GeoIPHandler,
  GuardMiddlewareProtocol,
  GuardRequest,
  GuardRequestState,
  GuardResponse,
  GuardResponseFactory,
  RedisHandlerProtocol,
} from './protocols/index.js';

export {
  BehaviorRule,
  defaultLogger,
  DynamicRulesSchema,
  RouteConfig,
  SecurityConfigSchema,
} from './models/index.js';

export type {
  BehaviorAction,
  BehaviorRuleType,
  DynamicRules,
  Logger,
  ResolvedSecurityConfig,
  SecurityConfig,
} from './models/index.js';

export {
  ContentPreprocessor,
  PatternCompiler,
  PerformanceMonitor,
  SemanticAnalyzer,
} from './detection-engine/index.js';

export type {
  PatternReport,
  PatternStats,
  PerformanceMetric,
  SemanticAnalysis,
} from './detection-engine/index.js';

export { initializeSecurityMiddleware } from './middleware-support.js';
export type { SecurityMiddlewareComponents } from './middleware-support.js';
export { SecurityCheckPipeline, SecurityEventBus, MetricsCollector, RequestValidator,
  RouteConfigResolver, BypassHandler, ErrorResponseFactory, BehavioralProcessor,
} from './middleware-support.js';
export type { HandlerRegistry } from './middleware-support.js';

export { BaseSecurityDecorator, SecurityDecorator, getRouteDecoratorConfig } from './decorators/index.js';

export { extractClientIp, isIpAllowed, isUserAgentAllowed, checkIpCountry,
  detectPenetrationAttempt, sanitizeForLog, logActivity, sendAgentEvent,
} from './utils.js';

export { GuardCoreError, GuardRedisError } from './errors.js';

export {
  DEFAULT_SENSITIVE_LOG_HEADERS, DEFAULT_SENSITIVE_LOG_FIELDS,
  mergeSensitiveNames, redactPairsInText, redactBlobForDisplay,
  redactUrlForDisplay, redactHeaderValueForDisplay, redactEndpointForDisplay,
} from './redaction.js';

export {
  ON_BLOCK_EXCLUDED_CHECK_NAMES, fireBlockHook, invokeBlockHook,
  buildBlockPayload, invokeErrorHook,
} from './core/block-events.js';
export type { OnBlockHook, OnErrorHook } from './core/block-events.js';
export { UNKNOWN_CLIENT_IDENTITY } from './core/client-identity.js';
export { UNRESOLVED_ROUTE_REASON } from './core/checks/implementations/route-config.js';
export {
  resolveDetectionExclusions, disabledCategoriesOf, EXCLUDED_HEADERS,
} from './core/routing/detection-exclusions.js';
export type { ResolvedDetectionExclusions } from './core/routing/detection-exclusions.js';
export type { PathRouteConfigEntry } from './core/routing/resolver.js';

/* Path normalization + subtree exclusion matching (parity with
   guard_core/core/validation/path_matching.py). */
export {
  normalizeUrlPath, normalizeExcludePaths, pathMatchesExclusions, pathIsExcluded,
} from './core/validation/path-matching.js';

/* Bounded body reader (parity with guard_core/_utils/body_reader.py). */
export {
  parseContentLength, readCappedBody, setBodyReadConcurrencyLimit,
  resetBodyReadConcurrency, straddleOverlapBytes,
} from './core/bounded-body-reader.js';
export type { BoundedBodyReaderDeps } from './core/bounded-body-reader.js';

/* Structured logging (parity with guard_core/_utils/logging_utils.py) and
   the logFormat/customLogFile consumer. */
export {
  JsonFormatter, formatTextLog, setupCustomLogging, resolveConfiguredLogger,
  DEFAULT_LOGGER_NAME,
} from './models/logger-setup.js';
export type { LogRecord, CustomLoggingOptions } from './models/logger-setup.js';
export { toAgentConfig } from './models/agent-config.js';
export type { SecurityAgentConfigInput, SecurityBufferOverflowPolicy, SecurityErrorHook, ToAgentConfigOptions } from './models/agent-config.js';

/* Agent handler fan-out + export sinks (parity with the reference
   composite/otel/logfire event handlers). */
export { EventFilter, METRIC_RESPONSE_TIME, METRIC_REQUEST_COUNT, METRIC_ERROR_RATE,
  METRIC_TYPE_VALUES } from './core/events/event-filter.js';
export type { AgentEventEnricher } from './core/events/event-filter.js';
export { CompositeAgentHandler } from './core/events/composite-handler.js';
/* Event enrichment layer (parity with the reference enricher.py +
   event_types.py ENRICHMENT_KEY_* / ThreatScorer). */
export { EventEnricher, threatScoreFor, DEFAULT_THREAT_SCORE,
  BEHAVIOR_CORRELATION_WINDOW_SECONDS, DEFAULT_OTEL_SERVICE_NAME,
  THREAT_SCORE_MAP, ENRICHMENT_KEY_PROJECT_ID, ENRICHMENT_KEY_SERVICE_NAME,
  ENRICHMENT_KEY_DEPLOYMENT_ENV, ENRICHMENT_KEY_THREAT_SCORE,
  ENRICHMENT_KEY_RULE_ID, ENRICHMENT_KEY_RULE_VERSION,
  ENRICHMENT_KEY_BEHAVIOR_KEY, ENRICHMENT_KEY_RECENT_EVENT_COUNT,
} from './core/events/enricher.js';
export type { EnrichmentContext, DynamicRuleMatcher, BehaviorCounter,
  EnrichableEvent, EnrichableMetric } from './core/events/enricher.js';
export { OtelHandler } from './core/events/otel-handler.js';
export type { OtelHandlerConfig, OtelInstrumentation, OtelTraceContext } from './core/events/otel-handler.js';
export { LogfireHandler } from './core/events/logfire-handler.js';
export type { LogfireHandlerConfig, LogfireClient } from './core/events/logfire-handler.js';

/* WebSocket upgrade guard (parity with the reference guard_websocket). */
export {
  guardWebSocketUpgrade, WS_CLOSE_POLICY_VIOLATION, WS_CLOSE_TRY_AGAIN_LATER,
  WS_CLOSE_IP_BANNED, WS_CLOSE_IP_NOT_ALLOWED, WS_CLOSE_RATE_LIMIT_EXCEEDED,
  WS_CLOSE_CLIENT_ADDRESS_UNKNOWN, WS_CLOSE_SECURITY_CHECK_FAILED,
  WS_CLOSE_SUSPICIOUS_ACTIVITY,
} from './core/websocket-guard.js';
export type { WebSocketCloseReason, WebSocketGuardVerdict } from './core/websocket-guard.js';
export { attachNodeWebSocketGuard, NodeUpgradeGuardRequest } from './core/node-websocket-guard.js';
export type { NodeWebSocketGuardOptions } from './core/node-websocket-guard.js';
