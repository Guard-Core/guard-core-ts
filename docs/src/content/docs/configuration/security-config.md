---
title: "SecurityConfig"
description: "Complete reference for the SecurityConfig Zod schema"
---

`SecurityConfig` is the central configuration object for all `@guardcore` adapters. It is validated at startup using a Zod schema. All fields have sensible defaults -- you only need to specify what you want to change.

```typescript
import { SecurityConfigSchema } from '@guardcore/core';
import type { SecurityConfig } from '@guardcore/core';

const config: SecurityConfig = {
  rateLimit: 100,
  rateLimitWindow: 60,
};

const resolved = SecurityConfigSchema.parse(config);
```

## Proxy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `trustedProxies` | `string[]` | `[]` | IP addresses or CIDR ranges of trusted reverse proxies, plus the literal `unix` token that lets `X-Forwarded-For` resolve the client for a request with no peer address (Unix socket). The connecting address is compared as the server reports it |
| `trustedProxyDepth` | `number` | `1` | The `X-Forwarded-For` position counted from the right that names the client. The header is honored only when the connecting peer is a trusted proxy; from any other peer it is ignored and reported as a `suspicious_request` event |
| `trustXForwardedProto` | `boolean` | `false` | Trust `X-Forwarded-Proto` header for HTTPS detection |
| `passiveMode` | `boolean` | `false` | Log violations without blocking requests |

## IP Filtering

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `whitelist` | `string[] \| null` | `null` | IP/CIDR allowlist. When set, only these IPs are allowed |
| `blacklist` | `string[]` | `[]` | IP/CIDR blocklist. These IPs are always blocked |
| `exemptIps` | `string[]` | `[]` | IP/CIDR skip-list for trusted automation. Entries skip rate limiting, the user-agent check and per-route cloud-provider blocks |
| `whitelistCountries` | `string[]` | `[]` | Two-letter country codes to allow (requires `geoIpHandler` or `geoResolver`) |
| `blockedCountries` | `string[]` | `[]` | Two-letter country codes to block (requires `geoIpHandler` or `geoResolver`) |

### `exemptIps` vs `whitelist`

`exemptIps` is noise reduction for known-friendly automation (monitoring probes,
VPN egress, a partner's server), not immunity. A non-empty `whitelist` is also an
allowlist: every IP not on it is denied by the global IP check, so it cannot be
used to let a few clients skip throttling on a public API. `exemptIps` is not
restrictive: every unlisted IP is checked exactly as usual, and a match only sets
the same skip state a whitelist match sets (rate limiting, user-agent check,
per-route cloud-provider blocks). Everything else still applies to listed IPs:
penetration detection (attack payloads are still blocked and counted), the
blacklist, dynamic IP bans, per-route `requireIp`/`blockIp` rules, the global
`blockCloudProviders` list, HTTPS enforcement and security headers. Entries
accept IPv4, IPv6 and CIDR forms, validated at config construction (an invalid
entry fails closed). The two lists may coexist; an IP on both is simply a
whitelist match.

## Rate Limiting

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `rateLimit` | `number` | `10` | Max requests per window per IP |
| `rateLimitWindow` | `number` | `60` | Window duration in seconds |
| `enableRateLimiting` | `boolean` | `true` | Enable/disable rate limiting globally |
| `endpointRateLimits` | `Record<string, [number, number]>` | `{}` | Per-endpoint overrides: `{ "/api/search": [5, 60] }` |

## Detection

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enablePenetrationDetection` | `boolean` | `true` | Enable the 75-pattern detection engine |
| `detectionCompilerTimeout` | `number` | `2.0` | Regex compilation timeout in seconds (0.1-10) |
| `detectionMaxScanSeconds` | `number` | `10.0` | Cap on the CPU time spent regex scanning one request (not wall time, so a busy host does not exhaust it), summed across every field and pattern (0.1-60). Once reached, remaining patterns and values are not scanned and the request receives a weighted `pattern_timeout` threat (`scan_time_budget_exhausted`) that counts toward the anomaly score |
| `excludedSemanticDetectionHeaders` | `string[]` | `[]` | Opt-in: header names whose values skip the semantic analyzer only (case-insensitive). Regex scanning of these headers is unchanged, e.g. `cookie` or `authorization` for apps whose JWTs score near `detectionSemanticThreshold` |
| `detectionMaxContentLength` | `number` | `10000` | Max content length for scanning (1000-100000) |
| `detectionPreserveAttackPatterns` | `boolean` | `true` | Preserve attack regions when truncating long content |
| `detectionSemanticThreshold` | `number` | `0.7` | Semantic analysis threat score threshold (0-1) |
| `detectionAnomalyThreshold` | `number` | `3.0` | Z-score threshold for performance anomaly detection (1-10) |
| `detectionSlowPatternThreshold` | `number` | `0.1` | Seconds before a pattern is considered slow (0.01-1) |
| `detectionMonitorHistorySize` | `number` | `1000` | Number of recent metrics to keep (100-10000) |
| `detectionMaxTrackedPatterns` | `number` | `1000` | Max patterns to track in performance monitor (100-5000) |

## Auto-Banning

Every penetration-detection violation increments the source IP's counter for the matched detection category. When a threshold is crossed, the IP is banned and subsequent requests are blocked with 403 by the IP check. `threatBanConfig` entries fire at their own threshold and duration; everything else falls back to the flat `autoBanThreshold`/`autoBanDuration` pair measured against the IP's total across categories.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableIpBanning` | `boolean` | `true` | Enable automatic IP banning. `false` disables ban creation entirely; enforcement of already-active bans is unaffected |
| `autoBanThreshold` | `number` | `10` | Total violations across categories before auto-ban (fallback when no `threatBanConfig` entry matched) |
| `autoBanDuration` | `number` | `3600` | Fallback ban duration in seconds |
| `threatBanConfig` | `Record<string, { threshold: number; duration: number }>` | `{}` | Per-category ban thresholds and durations. Keys are the detection categories (`xss`, `sqli`, `dir_traversal`, `cmd_injection`, ...) plus the `rate_limit` pseudo-category; unknown keys fail validation |
| `enableRateLimitAutoBan` | `boolean` | `false` | Feed rate-limit violations into the same autoban engine: each active-mode (non-passive) violation increments the `rate_limit` category, with a `threatBanConfig['rate_limit']` override or the flat threshold fallback. Requires `enableIpBanning` to actually ban |

## User Agent Filtering

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `blockedUserAgents` | `string[]` | `[]` | Substring patterns to match against User-Agent header |

## Security Headers

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `securityHeaders` | `object \| null` | See [Security Headers](../security-headers/) | Security headers configuration object |
| `enforceHttps` | `boolean` | `false` | Redirect HTTP requests to HTTPS |

## CORS

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableCors` | `boolean` | `false` | Enable CORS handling |
| `corsAllowOrigins` | `string[]` | `['*']` | Allowed origins |
| `corsAllowMethods` | `string[]` | `['GET','POST','PUT','PATCH','DELETE','OPTIONS']` | Allowed methods |
| `corsAllowHeaders` | `string[]` | `['*']` | Allowed headers |
| `corsAllowCredentials` | `boolean` | `false` | Allow credentials |
| `corsExposeHeaders` | `string[]` | `[]` | Headers exposed to the browser |
| `corsMaxAge` | `number` | `600` | Preflight cache duration in seconds |

## Cloud Provider Blocking

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `blockCloudProviders` | `('AWS' \| 'GCP' \| 'Azure')[]` | `[]` | Cloud providers to block. Requests whose IP falls in a selected provider's refreshed ranges get 403; routes can override the list per-route via the `blockCloudProviders` route selector, and whitelist/exempt IPs skip the check |
| `cloudIpRefreshInterval` | `number` | `3600` | Seconds between cloud IP range refreshes (60-86400) |

## GeoIP

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `geoIpHandler` | `GeoIPHandler` | `undefined` | GeoIP handler instance (e.g., `IPInfoManager`) |
| `geoResolver` | `(ip: string) => string \| null` | `undefined` | Simple function returning 2-letter country code |

## Agent (Telemetry)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableAgent` | `boolean` | `false` | Enable telemetry agent |
| `agentApiKey` | `string \| null` | `null` | API key (required when `enableAgent` is true) |
| `agentEndpoint` | `string` | `'https://api.fastapi-guard.com'` | Agent endpoint URL |
| `agentProjectId` | `string \| null` | `null` | Project identifier |
| `agentBufferSize` | `number` | `100` | Events buffered before flush |
| `agentFlushInterval` | `number` | `30` | Flush interval in seconds |
| `agentEnableEvents` | `boolean` | `true` | Send security events |
| `agentEnableMetrics` | `boolean` | `true` | Send performance metrics |
| `agentTimeout` | `number` | `30` | Request timeout in seconds |
| `agentRetryAttempts` | `number` | `3` | Retry count on failure |

## Dynamic Rules

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableDynamicRules` | `boolean` | `false` | Enable agent-driven rule updates (requires `enableAgent`). Enabling it lets the dashboard change protection at runtime without a code change: a rule bans the IPs in its `ipBlacklist` (for `ipBanDuration` seconds), unbans the IPs in its `ipWhitelist`, adds its `suspiciousPatterns` to detection, and replaces `blockedCountries`, `whitelistCountries`, `rateLimit`, `rateLimitWindow`, `endpointRateLimits`, `blockCloudProviders`, `blockedUserAgents`, `enablePenetrationDetection`, `enableIpBanning`, `enableRateLimiting`, `enableRateLimitAutoBan`, `autoBanThreshold`, `autoBanDuration`, `emergencyMode` and `emergencyWhitelist`. A rule cannot change any other setting |
| `dynamicRuleInterval` | `number` | `300` | Polling interval in seconds |

## Redis

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableRedis` | `boolean` | `true` | Enable Redis for distributed state |
| `redisUrl` | `string` | `'redis://localhost:6379'` | Redis connection URL |
| `redisPrefix` | `string` | `'guard_core:'` | Prefix for all Redis keys |

## Logging

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `logger` | `Logger` | `defaultLogger` | Custom logger instance |
| `customLogFile` | `string \| null` | `null` | Path to a log file |
| `logSuspiciousLevel` | `string \| null` | `'WARNING'` | Log level for suspicious requests |
| `logRequestLevel` | `string \| null` | `null` | Log level for all requests (null = disabled) |
| `logFormat` | `'text' \| 'json'` | `'text'` | Log output format |

## Emergency Mode

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `emergencyMode` | `boolean` | `false` | Block all traffic except whitelisted IPs |
| `emergencyWhitelist` | `string[]` | `[]` | IPs allowed during emergency mode |

## Custom Checks

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `excludePaths` | `string[]` | `[]` | URL paths excluded from security checks. The request still reaches your handler. The IP ban check, the global IP blacklist/whitelist and country rules, and rate limiting still apply; the penetration scan, route rules, user-agent, header and other checks are skipped. The response still gets security headers, CORS headers and request metrics, and behavior rules are not tracked |
| `customErrorResponses` | `Record<number, string>` | `{}` | Custom error messages by status code |
| `customRequestCheck` | `(req: GuardRequest) => Promise<GuardResponse \| null>` | `undefined` | Custom check function run at the end of the pipeline |
| `customResponseModifier` | `(res: GuardResponse) => Promise<GuardResponse>` | `undefined` | Modify responses before sending |

## Validation Rules

The schema enforces these constraints:
- `agentApiKey` is required when `enableAgent` is true
- `enableAgent` must be true when `enableDynamicRules` is true
- `geoIpHandler` or `geoResolver` is required when using `blockedCountries` or `whitelistCountries`

## Production Example

```typescript
import type { SecurityConfig } from '@guardcore/core';

const config: SecurityConfig = {
  trustedProxies: ['10.0.0.0/8'],
  trustedProxyDepth: 2,
  trustXForwardedProto: true,

  enableRedis: true,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  rateLimit: 100,
  rateLimitWindow: 60,
  endpointRateLimits: {
    '/api/login': [5, 300],
    '/api/search': [20, 60],
  },

  enablePenetrationDetection: true,
  detectionSemanticThreshold: 0.7,

  autoBanThreshold: 5,
  autoBanDuration: 7200,
  threatBanConfig: {
    sqli: { threshold: 3, duration: 86400 },
    rate_limit: { threshold: 3, duration: 1800 },
  },
  enableRateLimitAutoBan: true,

  blockedUserAgents: ['sqlmap', 'nikto', 'nmap', 'masscan'],

  enforceHttps: true,

  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
  corsAllowCredentials: true,

  excludePaths: ['/health', '/metrics'],

  customErrorResponses: {
    403: 'Access denied',
    429: 'Too many requests, slow down',
  },
};
```
