import ipaddr from 'ipaddr.js';
import { z } from 'zod';

import { PATTERN_DEFINITIONS } from '../detection-engine/patterns/pattern-table.js';
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

  detectionCompilerTimeout: z.number().min(0.1).max(10).default(2.0),
  detectionMaxContentLength: z.number().int().min(1000).max(100000).default(10000),
  detectionPreserveAttackPatterns: z.boolean().default(true),
  detectionSemanticThreshold: z.number().min(0).max(1).default(0.7),
  detectionAnomalyThreshold: z.number().min(1).max(10).default(3.0),
  detectionSlowPatternThreshold: z.number().min(0.01).max(1).default(0.1),
  detectionMonitorHistorySize: z.number().int().min(100).max(10000).default(1000),
  detectionMaxTrackedPatterns: z.number().int().min(100).max(5000).default(1000),
  detectionMaxBodyInspectBytes: z.number().int().min(1000).default(262144),
  detectionThreatScoreThreshold: z.number().min(0).max(1).default(1.0),
  detectionBinaryMinRunLength: z.number().int().min(4).max(1024).default(16),
  excludedDetectionParams: z.array(z.string()).default([]),
  excludedDetectionBodyFields: z.array(z.string()).default([]),
  excludedDetectionHeaders: z.array(z.string()).default([]),

  enableAgent: z.boolean().default(false),
  agentApiKey: z.string().nullable().default(null),
  agentEndpoint: z.string().url().default('https://api.fastapi-guard.com'),
  agentProjectId: z.string().nullable().default(null),
  agentBufferSize: z.number().int().positive().default(100),
  agentFlushInterval: z.number().int().positive().default(30),
  agentEnableEvents: z.boolean().default(true),
  agentEnableMetrics: z.boolean().default(true),
  agentTimeout: z.number().int().positive().default(30),
  agentRetryAttempts: z.number().int().nonnegative().default(3),

  enableDynamicRules: z.boolean().default(false),
  dynamicRuleInterval: z.number().int().positive().default(300),

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
});

export type SecurityConfig = z.input<typeof SecurityConfigSchema>;
export type ResolvedSecurityConfig = z.output<typeof SecurityConfigSchema>;
