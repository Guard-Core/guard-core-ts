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

export { GuardRedisError } from './errors.js';

export {
  DEFAULT_SENSITIVE_LOG_HEADERS, DEFAULT_SENSITIVE_LOG_FIELDS,
  mergeSensitiveNames, redactPairsInText, redactBlobForDisplay,
  redactUrlForDisplay, redactHeaderValueForDisplay,
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
