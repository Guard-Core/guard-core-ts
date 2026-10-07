import ipaddr from 'ipaddr.js';
import { z } from 'zod';

import { PATTERN_DEFINITIONS } from '../detection-engine/patterns/pattern-table.js';
import { ALL_DETECTION_CATEGORIES } from '../detection-engine/patterns/sources.js';
import type { GeoIPHandler } from '../protocols/geo-ip.js';
import type { GuardRequest } from '../protocols/request.js';
import type { GuardResponse } from '../protocols/response.js';
import type { Logger } from './logger.js';

function isValidIpOrCidr(value: string): boolean {
  if (value.includes('/')) {
    try {
      ipaddr.parseCIDR(value);
      return true;
    } catch {
      return false;
    }
  }
  return ipaddr.isValid(value);
}

const VALID_CLOUD_PROVIDERS = ['AWS', 'GCP', 'Azure'] as const;

/* Detection categories usable as threat_ban_config keys: the canonical
   pattern table's categories plus the 'rate_limit' pseudo-category, the TS
   twin of THREAT_BAN_CONFIG_CATEGORIES in
   guard_core/_security_config_field_validators.py (ALL_DETECTION_CATEGORIES
   | {'rate_limit'}). Derived from the table so the two stay in sync. */
const THREAT_BAN_CONFIG_CATEGORIES: ReadonlySet<string> = new Set([
  ...new Set(PATTERN_DEFINITIONS.map((entry) => entry.category)),
  'rate_limit',
]);

const ThreatBanEntrySchema = z.object({
  threshold: z.number().int().positive(),
  duration: z.number().int().positive(),
});

export type ThreatBanEntry = z.output<typeof ThreatBanEntrySchema>;

/* Behavior-rule config, the TS port of BehaviorRuleConfig
   (guard_core/_security_config_field_validators.py): rule_type and action
   literals, threshold >= 1, window >= 1 (default 3600), an optional pattern
   for return_pattern rules, an optional ban_duration for ban rules, and the
   correlate_with_detection flag that halves the effective threshold for
   global return_pattern rules while the IP has prior detection hits. */
export const BehaviorRuleSchema = z.object({
  ruleType: z.enum(['usage', 'return_pattern', 'frequency']),
  threshold: z.number().int().min(1),
  window: z.number().int().min(1).default(3600),
  pattern: z.string().nullable().default(null),
  action: z.enum(['ban', 'log', 'throttle', 'alert']).default('log'),
  banDuration: z.number().int().min(1).nullable().default(null),
  correlateWithDetection: z.boolean().default(false),
});

export type BehaviorRuleConfig = z.output<typeof BehaviorRuleSchema>;

/* Every return_pattern pattern that is not a status: pattern needs the
   response body to evaluate (reference
   return_pattern_requires_response_body). */
export function returnPatternRequiresResponseBody(pattern: string): boolean {
  return !pattern.startsWith('status:');
}

const IpOrCidrSchema = z.string().refine(isValidIpOrCidr, 'Invalid IP or CIDR');

const LogLevel = z.enum(['INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL']);

export const SecurityConfigSchema = z.object({
  trustedProxies: z.array(IpOrCidrSchema).default([]),
  trustedProxyDepth: z.number().int().min(1).default(1),
  trustXForwardedProto: z.boolean().default(false),

  passiveMode: z.boolean().default(false),

  geoIpHandler: z.custom<GeoIPHandler>().optional(),
  geoResolver: z.custom<(ip: string) => string | null>().optional(),

  enableRedis: z.boolean().default(true),
  redisUrl: z.string().default('redis://localhost:6379'),
  redisPrefix: z.string().default('guard_core:'),

  whitelist: z.array(IpOrCidrSchema).nullable().default(null),
  blacklist: z.array(IpOrCidrSchema).default([]),
  exemptIps: z.array(IpOrCidrSchema).default([]),

  whitelistCountries: z.array(z.string().length(2)).default([]),
  blockedCountries: z.array(z.string().length(2)).default([]),

  blockedUserAgents: z.array(z.string()).default([]),

  autoBanThreshold: z.number().int().positive().default(10),
  autoBanDuration: z.number().int().positive().default(3600),

  threatBanConfig: z.record(z.string(), ThreatBanEntrySchema).default({}),
  enableRateLimitAutoBan: z.boolean().default(false),

  logger: z.custom<Logger>().optional(),
  customLogFile: z.string().nullable().default(null),
  logSuspiciousLevel: LogLevel.nullable().default('WARNING'),
  logRequestLevel: LogLevel.nullable().default(null),
  logFormat: z.enum(['text', 'json']).default('text'),

  customErrorResponses: z.record(z.coerce.number(), z.string()).default({}),

  rateLimit: z.number().int().positive().default(10),
  rateLimitWindow: z.number().int().positive().default(60),

  enforceHttps: z.boolean().default(false),

  securityHeaders: z.object({
    enabled: z.boolean().default(true),
    hsts: z.object({
      maxAge: z.number().default(31536000),
      includeSubdomains: z.boolean().default(true),
      preload: z.boolean().default(false),
    }).optional(),
    csp: z.record(z.string(), z.array(z.string())).nullable().default(null),
    frameOptions: z.enum(['DENY', 'SAMEORIGIN']).default('SAMEORIGIN'),
    contentTypeOptions: z.string().default('nosniff'),
    xssProtection: z.string().default('1; mode=block'),
    referrerPolicy: z.string().default('strict-origin-when-cross-origin'),
    permissionsPolicy: z.string().default('geolocation=(), microphone=(), camera=()'),
    custom: z.record(z.string(), z.string()).nullable().default(null),
  }).nullable().default({
    enabled: true,
    hsts: { maxAge: 31536000, includeSubdomains: true, preload: false },
    frameOptions: 'SAMEORIGIN',
    contentTypeOptions: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
    csp: null,
    custom: null,
  }),

  customRequestCheck: z.custom<(req: GuardRequest) => Promise<GuardResponse | null>>().optional(),
  customResponseModifier: z.custom<(res: GuardResponse) => Promise<GuardResponse>>().optional(),

  /* Default verifier callable for requireAuth and apiKeyAuth routes without
     their own verifier: verifier(request, credential) -> Principal | null.
     Sync or async. Reference: auth_verifier. */
  authVerifier: z.custom<(request: GuardRequest, credential: string) => unknown>().optional(),

  enableCors: z.boolean().default(false),
  corsAllowOrigins: z.array(z.string()).default(['*']),
  corsAllowMethods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
  corsAllowHeaders: z.array(z.string()).default(['*']),
  corsAllowCredentials: z.boolean().default(false),
  corsExposeHeaders: z.array(z.string()).default([]),
  corsMaxAge: z.number().int().positive().default(600),

  blockCloudProviders: z
    .array(z.enum(VALID_CLOUD_PROVIDERS))
    .default([])
    .transform((arr) => new Set(arr)),
  cloudIpRefreshInterval: z.number().int().min(60).max(86400).default(3600),

  excludePaths: z.array(z.string()).default([]),

  enableIpBanning: z.boolean().default(true),
  enableRateLimiting: z.boolean().default(true),
  enablePenetrationDetection: z.boolean().default(true),

  emergencyMode: z.boolean().default(false),
  emergencyWhitelist: z.array(z.string()).default([]),

  endpointRateLimits: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),

  /* Global behavior-rules surface, the TS port of global_behavior_rules /
     behavior_scan_response_body / behavior_max_response_body_inspect_bytes
     (guard_core/_security_config_fields.py). Defaults keep the engine
     zero-change-unless-enabled: no rules, no response-body scanning, the
     reference's 262144-byte inspection cap. */
  globalBehaviorRules: z.array(BehaviorRuleSchema).default([]),
  behaviorScanResponseBody: z.boolean().default(false),
  behaviorMaxResponseBodyInspectBytes: z.number().int().min(1).default(262144),

  detectionCompilerTimeout: z.number().min(0.1).max(10).default(2.0),
  detectionMaxContentLength: z.number().int().min(1000).max(100000).default(10000),
  detectionPreserveAttackPatterns: z.boolean().default(true),
  detectionSemanticThreshold: z.number().min(0).max(1).default(0.7),
  /* The reference detection_anomaly_emission_cooldown: minimum seconds
     between anomaly events for the same pattern (noise control). */
  detectionAnomalyEmissionCooldown: z.number().min(1).max(3600).default(60),
  detectionAnomalyThreshold: z.number().min(1).max(10).default(3.0),
  detectionSlowPatternThreshold: z.number().min(0.01).max(1).default(0.1),
  detectionMonitorHistorySize: z.number().int().min(100).max(10000).default(1000),
  detectionMaxTrackedPatterns: z.number().int().min(100).max(5000).default(1000),
  detectionMaxBodyInspectBytes: z.number().int().min(1000).default(262144),
  detectionThreatScoreThreshold: z.number().min(0).max(1).default(1.0),
  detectionBinaryMinRunLength: z.number().int().min(4).max(1024).default(16),
  /* Opt-in worker-thread scan execution (the reference's shared 4-worker
     regex pool, compiler.py shared_regex_executor): when true, the plain
     full-content candidate loop of each pattern scan dispatches to a bounded
     worker pool and the verdict deadline terminates the worker instead of
     letting an unbounded native RegExp block the event loop. Default false:
     the deadline-bounded synchronous fallback stays the default execution
     mode (worker-less targets have no pool to run). */
  detectionScanWorkerPool: z.boolean().default(false),
  excludedDetectionParams: z.array(z.string()).default([]),
  excludedDetectionBodyFields: z.array(z.string()).default([]),
  excludedDetectionHeaders: z.array(z.string()).default([]),

  /* Detection categories that scan (the TS port of the reference
     enabled_detection_categories frozenset,
     guard_core/_security_config_fields.py): the default is every category in
     the canonical pattern table, and an unknown entry fails config parsing
     like _validate_enabled_detection_categories_value. A route's
     enabledDetectionCategories replaces this set per route
     (detection-exclusions.ts). */
  enabledDetectionCategories: z.array(z.string()).default([...ALL_DETECTION_CATEGORIES]),

  /* Global body-scan toggle (the TS port of detection_scan_body, reference
     default true): when false the body surface is not scanned at all while
     headers, params and the URL path still scan. A route's
     detectionScanBody overrides it per route. */
  detectionScanBody: z.boolean().default(true),

  /* Bounded body-read knobs, the TS port of body_read_timeout (0 < x <= 30,
     default 3.0s) and sync_body_read_max_concurrent (1 <= x <= 10000,
     default 64, renamed bodyReadMaxConcurrent here because the TS tree has
     no sync/async split). bodyReadTimeout bounds every request-body
     detection read against a stalled adapter or stream; on timeout the body
     is treated as unavailable (the same fail-closed outcome as a read that
     raises). bodyReadMaxConcurrent bounds how many bounded reads may be in
     flight at once across the process; attempts beyond the budget queue and
     then give up with the same fail-closed outcome. */
  bodyReadTimeout: z.number().gt(0).max(30).default(3.0),
  bodyReadMaxConcurrent: z.number().int().min(1).max(10000).default(64),

  enableAgent: z.boolean().default(false),
  agentApiKey: z.string().nullable().default(null),
  /* Reference default https://api.guard-core.com (_security_config_fields.py
     agent_endpoint); the agent's own endpoint normalization still applies on
     top (strip trailing slashes, legacy /api/v1 suffix). */
  agentEndpoint: z.string().url().default('https://api.guard-core.com'),
  agentProjectId: z.string().nullable().default(null),
  agentBufferSize: z.number().int().positive().default(100),
  agentFlushInterval: z.number().int().positive().default(30),
  agentEnableEvents: z.boolean().default(true),
  agentEnableMetrics: z.boolean().default(true),
  agentTimeout: z.number().int().positive().default(30),
  agentRetryAttempts: z.number().int().nonnegative().default(3),
  /* Fail-closed switch (reference agent_strict, consumed by the framework
     adapters): an enabled agent that cannot be constructed raises at
     middleware init instead of degrading to agent-off. */
  agentStrict: z.boolean().default(false),
  /* The agent tuning surface (reference agent_project_encryption_key through
     agent_payload_signing_secret): null defers to the agent's own default,
     exactly like the reference's None-filtered to_agent_config kwargs. */
  agentProjectEncryptionKey: z.string().nullable().default(null),
  agentGuardVersion: z.string().nullable().default(null),
  agentHighWatermarkRatio: z.number().gt(0).max(1).nullable().default(null),
  agentMaxConcurrentFlushes: z.number().int().min(1).nullable().default(null),
  agentBufferOverflowPolicy: z.enum(['drop', 'block', 'raise']).nullable().default(null),
  agentBackoffFactor: z.number().positive().nullable().default(null),
  agentSensitiveHeaders: z.array(z.string()).nullable().default(null),
  agentMaxPayloadSize: z.number().int().positive().nullable().default(null),
  agentCompressionEnabled: z.boolean().nullable().default(null),
  agentCompressionThreshold: z.number().int().nonnegative().nullable().default(null),
  agentInstallId: z.string().nullable().default(null),
  agentPayloadSigningSecret: z.string().nullable().default(null),
  agentStatusInterval: z.number().int().min(60).max(86400).default(300),

  enableDynamicRules: z.boolean().default(false),
  dynamicRuleInterval: z.number().int().min(60).default(300),
  /* The reference dynamic_rules_cache_path (a Path | None, so a non-empty
     filesystem path string here): the opt-in local JSON file persisting the
     last-known dynamic rules snapshot so a restart during a SaaS outage
     restores the last applied rules. Redis holds the primary snapshot
     whenever a redis handler is present; the file is the additional
     fallback, written and read only when this path is set. */
  dynamicRulesCachePath: z.string().nullable().default(null)
    .refine(
      (v) => v === null || v.trim().length > 0,
      'dynamicRulesCachePath must be a non-empty filesystem path or null',
    ),

  /* Enrichment surface (enricher.py + event_types.py ENRICHMENT_KEY_*):
     enableEnrichment stamps the guard.* keys (project identity, threat
     score, matched dynamic rule, behavior correlation) onto every event and
     metric through the composite handler; it is the guard-agent-gated tier,
     so the superRefine below rejects it without enableAgent (the reference
     validate_agent_config). otelServiceName is the reference
     otel_service_name (default 'guard-core') and otelResourceAttributes the
     reference otel_resource_attributes (the deployment.environment entry
     feeds the deployment-environment key). */
  /* The Redis tuning surface (reference redis_socket_connect_timeout /
     redis_socket_timeout / redis_health_check_interval / redis_max_connections /
     redis_retries): bounded timeouts keep a partitioned Redis from blocking
     every touching request; null lets ioredis defaults apply. */
  redisSocketConnectTimeout: z.number().positive().nullable().default(null),
  redisSocketTimeout: z.number().positive().nullable().default(null),
  redisHealthCheckInterval: z.number().int().positive().default(30),
  redisMaxConnections: z.number().int().positive().nullable().default(null),
  redisRetries: z.number().int().nonnegative().default(0),
  /* The reference lazy_init knob: when false the adapters bootstrap the
     engine at registration instead of on first request. */
  lazyInit: z.boolean().default(true),
  /* The detection scan-budget tunables (reference detection_max_scan_values /
     detection_max_scan_chars / detection_max_json_depth). */
  detectionMaxScanValues: z.number().int().positive().default(512),
  detectionMaxScanChars: z.number().int().positive().default(65536),
  detectionMaxJsonDepth: z.number().int().positive().default(32),
  detectionMinSamplesForAnomaly: z.number().int().positive().default(10),
  /* The GeoIP manager surface (reference ipinfo_token / ipinfo_db_path /
     geo_ip_db_max_age): the token authenticates the ipinfo.io download, the
     path is the local MMDB file and the max age is the mtime freshness gate
     in seconds (default 86400). */
  ipinfoToken: z.string().nullable().default(null),
  ipinfoDbPath: z.string().default('data/ipinfo/country_asn.mmdb'),
  geoIpDbMaxAge: z.number().int().positive().default(86400),

  enableEnrichment: z.boolean().default(false),
  otelServiceName: z.string().default('guard-core'),
  otelResourceAttributes: z.record(z.string(), z.string()).default({}),
  /* The reference telemetry sink switches (enable_otel / enable_logfire,
     _security_config_fields.py 1008-1040): the OTEL exporter endpoint the
     application mirrors into its SDK setup, and the Logfire service name.
     The handlers stay dependency-free: the SDK/logfire client injection is
     the app's seam, exactly like the reference's [otel]/[logfire] extras. */
  enableOtel: z.boolean().default(false),
  otelExporterEndpoint: z.string().url().nullable().default(null),
  enableLogfire: z.boolean().default(false),
  logfireServiceName: z.string().default('guard-core'),
  /* The reference muting surfaces: muted_event_types / muted_metric_types
     drop matching envelopes at the telemetry seam, muted_check_logs gates a
     check's on_block dispatch by check name. */
  /* The reference log_country_check_level: the level for per-request country
     verdicts that are not blocks (whitelisted / not-affected). null silences
     them. */
  logCountryCheckLevel: z.enum(['INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL']).nullable().default('INFO'),
  mutedEventTypes: z.array(z.string()).default([]),
  mutedMetricTypes: z.array(z.string()).default([]),
  mutedCheckLogs: z.array(z.string()).default([]),

  /* Failure-policy knobs, the TS port of the reference's fail_secure,
     redis_fail_open and route_resolution_strict (guard_core/_security_config_fields.py).
     fail_secure blocks with 500 when any check raises; redis_fail_open opts Redis
     outages (GuardRedisError) out of that and skips the failing check instead;
     route_resolution_strict blocks with 500 when the adapter could not resolve
     the route. */
  failSecure: z.boolean().default(true),
  redisFailOpen: z.boolean().default(false),
  routeResolutionStrict: z.boolean().default(false),

  /* Best-effort callback invoked when a middleware/agent step fails, receiving
     (stage, error, context). Stage is one of 'agent_init', 'geoip',
     'transport_send', 'encryption'. A callback that raises is caught and logged,
     never propagated. Reference: on_error. */
  onError: z.custom<(stage: string, error: unknown, context: Record<string, unknown>) => void>().optional(),

  /* Best-effort callback invoked exactly once per blocked request, receiving
     (request, payload). Payload keys: check_name, reason, trigger_info,
     passive_mode, client_ip, path, method, status_code. Not fired for
     custom_request, route_config.custom_validators, or the HTTPS-enforcement
     redirect. A callback that raises is caught and logged, never propagated.
     Reference: on_block. */
  onBlock: z.custom<(request: GuardRequest, payload: Record<string, unknown>) => unknown>().optional(),

  /* Log-redaction config, the TS port of log_sensitive_headers,
     log_sensitive_params and log_sensitive_body_fields: names are matched
     case-insensitively and merged with the hardcoded default sets
     (redaction.ts DEFAULT_SENSITIVE_LOG_HEADERS / DEFAULT_SENSITIVE_LOG_FIELDS). */
  logSensitiveHeaders: z.array(z.string()).default([]),
  logSensitiveParams: z.array(z.string()).default([]),
  logSensitiveBodyFields: z.array(z.string()).default([]),

}).superRefine((data, ctx) => {
  const unknownCategories = Object.keys(data.threatBanConfig)
    .filter((category) => !THREAT_BAN_CONFIG_CATEGORIES.has(category));
  if (unknownCategories.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `Unknown threat categories in threatBanConfig: ${unknownCategories.sort()}. `
        + `Valid: ${[...THREAT_BAN_CONFIG_CATEGORIES].sort()}`,
      path: ['threatBanConfig'],
    });
  }
  const unknownEnabledCategories = data.enabledDetectionCategories
    .filter((category) => !ALL_DETECTION_CATEGORIES.has(category));
  if (unknownEnabledCategories.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `Unknown detection categories: ${unknownEnabledCategories.sort()}. `
        + `Valid: ${[...ALL_DETECTION_CATEGORIES].sort()}`,
      path: ['enabledDetectionCategories'],
    });
  }
  if (data.enableAgent && !data.agentApiKey) {
    ctx.addIssue({
      code: 'custom',
      message: 'agentApiKey is required when enableAgent is true',
      path: ['agentApiKey'],
    });
  }
  if (data.enableDynamicRules && !data.enableAgent) {
    ctx.addIssue({
      code: 'custom',
      message: 'enableAgent must be true when enableDynamicRules is true',
      path: ['enableDynamicRules'],
    });
  }
  /* The reference validate_agent_config: enrichment is the guard-agent-gated
     tier of the telemetry pipeline. */
  if (data.enableEnrichment && !data.enableAgent) {
    ctx.addIssue({
      code: 'custom',
      message: 'enableEnrichment requires enableAgent=true; enrichment is the '
        + 'guard-agent-gated tier. Either enable guard-agent or set enableEnrichment=false.',
      path: ['enableEnrichment'],
    });
  }
  if (
    (data.blockedCountries.length > 0 || data.whitelistCountries.length > 0) &&
    !data.geoIpHandler &&
    !data.geoResolver
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'geoIpHandler or geoResolver is required when using country filtering',
      path: ['geoIpHandler'],
    });
  }
  /* Fail-closed behavior-rule validation, the TS port of
     _validate_global_behavior_rule_assignment via
     _validate_return_pattern_requires_scan
     (guard_core/_security_config_field_validators.py): a return_pattern rule
     whose pattern needs the response body is rejected when
     behaviorScanResponseBody is false, because it would silently never
     match. status: patterns are unaffected by the flag. */
  for (const [index, rule] of data.globalBehaviorRules.entries()) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (rule.ruleType !== 'return_pattern' || !rule.pattern) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (!returnPatternRequiresResponseBody(rule.pattern)) continue;
    if (data.behaviorScanResponseBody) continue;
    ctx.addIssue({
      code: 'custom',
      message: `globalBehaviorRules[${index}]: return_pattern rule with pattern "${rule.pattern}" `
        + 'requires reading the response body, but behaviorScanResponseBody is false. '
        + 'This rule would never match: set behaviorScanResponseBody=true to enable '
        + 'response-body inspection, or use a status: pattern instead',
      path: ['globalBehaviorRules', index],
    });
  }
});

export type SecurityConfig = z.input<typeof SecurityConfigSchema>;
export type ResolvedSecurityConfig = z.output<typeof SecurityConfigSchema>;
