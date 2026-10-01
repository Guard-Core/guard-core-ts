import { RouteConfig } from '../../src/models/route-config.js';

/* Corpus-config translation for the events kind: the suite pins configs in
   the reference snake_case knob names (pipeline_harness.py CONFIG_KEYS plus
   the events additions in events_harness.py EVENTS_CONFIG_KEYS). Mirrors the
   mapping the pipeline runner applies, extended with the events-only knobs. */

export const EVENTS_REDIS_PREFIX = 'guard_core:corpus_evts:';

/* DEFAULT_STATE of the reference harness: ban-free, redis-free determinism
   knobs a case config may raise but never lower. The reference's
   log_suspicious_level ERROR only silences log output; log_request_level is
   deliberately NOT mapped: the TS engine ties the request_logged event to
   logRequestLevel (checks/request-logging.ts), so configuring it would add
   an event the reference surface never emits in these scenarios. */
export function defaultSafetyKnobs(): Record<string, unknown> {
  return {
    enableRedis: false,
    enableRateLimitAutoBan: false,
    enableIpBanning: false,
    autoBanThreshold: 1000,
    logSuspiciousLevel: 'ERROR',
  };
}

const DIRECT_KEYS: ReadonlyArray<[string, string]> = [
  ['whitelist', 'whitelist'],
  ['blacklist', 'blacklist'],
  ['exempt_ips', 'exemptIps'],
  ['blocked_user_agents', 'blockedUserAgents'],
  ['blocked_countries', 'blockedCountries'],
  ['whitelist_countries', 'whitelistCountries'],
  ['rate_limit', 'rateLimit'],
  ['rate_limit_window', 'rateLimitWindow'],
  ['passive_mode', 'passiveMode'],
  ['enable_rate_limiting', 'enableRateLimiting'],
  ['enable_penetration_detection', 'enablePenetrationDetection'],
  ['enable_ip_banning', 'enableIpBanning'],
  ['enable_rate_limit_auto_ban', 'enableRateLimitAutoBan'],
  ['auto_ban_threshold', 'autoBanThreshold'],
  ['auto_ban_duration', 'autoBanDuration'],
  ['enforce_https', 'enforceHttps'],
  ['exclude_paths', 'excludePaths'],
  ['emergency_mode', 'emergencyMode'],
  ['emergency_whitelist', 'emergencyWhitelist'],
  ['route_resolution_strict', 'routeResolutionStrict'],
  ['trusted_proxies', 'trustedProxies'],
  ['agent_api_key', 'agentApiKey'],
  ['enable_agent', 'enableAgent'],
  ['enable_dynamic_rules', 'enableDynamicRules'],
  ['enable_redis', 'enableRedis'],
  ['redis_prefix', 'redisPrefix'],
  ['redis_url', 'redisUrl'],
];

/* The harness marker from events_harness.py _CUSTOM_REQUEST_MARKERS mapped
   to the real deterministic check function. */
const CUSTOM_REQUEST_MARKERS: Readonly<Record<string, unknown>> = {
  corpus_reject_all: async (request: unknown) => {
    const response = {
      statusCode: 418,
      headers: {} as Record<string, string>,
      body: new TextEncoder().encode('corpus rejected'),
      bodyText: 'corpus rejected',
      setHeader(name: string, value: string) {
        response.headers[name] = value;
      },
    };
    void request;
    return response;
  },
};

export function corpusConfigToCamel(
  raw: Record<string, unknown>,
  geo: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaultSafetyKnobs() };
  for (const [from, to] of DIRECT_KEYS) {
    if (from in raw) out[to] = raw[from];
  }
  if ('endpoint_rate_limits' in raw) {
    const tiers: Record<string, [number, number]> = {};
    for (const [p, pair] of Object.entries(raw['endpoint_rate_limits'] as Record<string, [number, number]>)) {
      tiers[p] = [pair[0], pair[1]];
    }
    out['endpointRateLimits'] = tiers;
  }
  if ('block_cloud_providers' in raw) {
    out['blockCloudProviders'] = raw['block_cloud_providers'];
  }
  const marker = raw['custom_request_check'];
  if (typeof marker === 'string' && marker in CUSTOM_REQUEST_MARKERS) {
    out['customRequestCheck'] = CUSTOM_REQUEST_MARKERS[marker];
  }
  if (
    ('blocked_countries' in raw && Array.isArray(raw['blocked_countries']) && (raw['blocked_countries'] as string[]).length > 0)
    || ('whitelist_countries' in raw && Array.isArray(raw['whitelist_countries']) && (raw['whitelist_countries'] as string[]).length > 0)
  ) {
    out['geoResolver'] = (ip: string) => geo[ip] ?? null;
  }
  return out;
}

/* EVENTS_ROUTE_KEYS of the reference harness: the pipeline route keys plus
   the decorator knobs the events scenarios need. */
const SET_VALUED_ROUTE_KEYS: ReadonlySet<string> = new Set(['bypassed_checks']);

export function corpusRoutesToRouteConfig(overrides: Record<string, unknown>): RouteConfig {
  const rc = new RouteConfig();
  const direct: Array<[string, keyof RouteConfig]> = [
    ['rate_limit', 'rateLimit'],
    ['rate_limit_window', 'rateLimitWindow'],
    ['ip_whitelist', 'ipWhitelist'],
    ['ip_blacklist', 'ipBlacklist'],
    ['blocked_countries', 'blockedCountries'],
    ['whitelist_countries', 'whitelistCountries'],
    ['blocked_user_agents', 'blockedUserAgents'],
    ['auth_required', 'authRequired'],
    ['max_request_size', 'maxRequestSize'],
  ];
  for (const [from, to] of direct) {
    if (from in overrides) (rc[to] as unknown) = overrides[from];
  }
  if ('block_cloud_providers' in overrides) {
    rc.blockCloudProviders = new Set(overrides['block_cloud_providers'] as string[]);
  }
  for (const key of SET_VALUED_ROUTE_KEYS) {
    if (key in overrides) {
      rc.bypassedChecks = new Set(overrides[key] as string[]);
    }
  }
  if ('enable_suspicious_detection' in overrides) {
    rc.enableSuspiciousDetection = overrides['enable_suspicious_detection'] as boolean;
  }
  if ('excluded_detection_headers' in overrides) {
    rc.excludedDetectionHeaders = new Set(overrides['excluded_detection_headers'] as string[]);
  }
  return rc;
}
