---
name: guard-core-ts
description: Use when working in the guardcore-ts monorepo (github.com/Guard-Core/guard-core-ts) or consuming @guardcore/core, the framework-agnostic TypeScript security middleware engine (IP and CIDR allow/deny, auto-ban, sliding-window rate limiting, 75-pattern penetration detection with semantic analysis, security headers, behavioral analysis, cloud provider and country blocking). Load this skill when implementing or reviewing the 17-check security pipeline, the detection engine (PatternCompiler, ContentPreprocessor, SemanticAnalyzer, PerformanceMonitor), the GuardRequest/GuardResponse protocol layer, adapters for express/fastify/hono/nestjs, the SecurityDecorator mixin system, or when editing packages/core where vitest 100% statement coverage and strict no-any TypeScript rules are enforced.
---

# guard-core-ts

## Quick Reference

- Repo: pnpm + Turborepo monorepo `guardcore-ts`, all packages version 1.0.0, MIT, Node >= 18
- Engine package: `@guardcore/core` at `packages/core` (tsup dual ESM/CJS build, entry `packages/core/src/index.ts`)
- Adapters: `@guardcore/express` (createSecurityMiddleware), `@guardcore/fastify` (guardPlugin), `@guardcore/hono` (createGuardMiddleware, edge-safe), `@guardcore/nestjs` (GuardModule.forRoot)
- Core value exports: `SecurityConfigSchema`, `initializeSecurityMiddleware`, `PatternCompiler`, `ContentPreprocessor`, `SemanticAnalyzer`, `PerformanceMonitor`, `SecurityCheckPipeline`, `SecurityEventBus`, `MetricsCollector`, `RequestValidator`, `RouteConfigResolver`, `BypassHandler`, `ErrorResponseFactory`, `BehavioralProcessor`, `SecurityDecorator`, `BaseSecurityDecorator`, `getRouteDecoratorConfig`, `extractClientIp`, `isIpAllowed`, `isUserAgentAllowed`, `checkIpCountry`, `detectPenetrationAttempt`, `sanitizeForLog`, `logActivity`, `sendAgentEvent`, `BehaviorRule`, `RouteConfig`, `defaultLogger`, `DynamicRulesSchema`
- Core type exports: `GuardRequest`, `GuardResponse`, `GuardResponseFactory`, `GuardRequestState`, `GuardMiddlewareProtocol`, `GeoIPHandler`, `AgentHandlerProtocol`, `RedisHandlerProtocol`, `SecurityConfig`, `ResolvedSecurityConfig`, `DynamicRules`, `Logger`, `BehaviorAction`, `BehaviorRuleType`, `SecurityMiddlewareComponents`, `HandlerRegistry`, `PatternReport`, `PatternStats`, `PerformanceMetric`, `SemanticAnalysis`
- Commands: `pnpm install && pnpm build && pnpm test && pnpm lint` at the root; per package `pnpm --filter @guardcore/core test`; coverage via `make test-coverage`
- Rules: TypeScript strict, no `any`, no `@ts-ignore`, named exports only, `.js` extensions on relative imports, Uint8Array (never Buffer) in protocols

## Installation

From npm (consumers):

```bash
npm install @guardcore/core
# plus one adapter:
npm install @guardcore/express   # or @guardcore/fastify, @guardcore/hono, @guardcore/nestjs
```

Optional peer dependencies of core; install only the features you enable:

```bash
npm install ioredis     # distributed rate limits, bans, cloud ranges (enableRedis)
npm install re2-wasm    # ReDoS-safe linear-time regex in PatternCompiler
npm install lru-cache   # TTL in-memory caching
npm install maxmind     # GeoIP country filtering
npm install he          # HTML entity decoding in ContentPreprocessor
npm install acorn       # JS AST scoring in SemanticAnalyzer
```

In this monorepo (agents editing the engine):

```bash
pnpm install
pnpm build        # turbo builds core before adapters (dependsOn: ["^build"])
pnpm test
```

## Setup

Adapters do this for you; when wiring core directly, follow the same flow as `packages/express/src/middleware.ts`:

1. Resolve config once: `const resolved = SecurityConfigSchema.parse(rawConfig)`
2. Pick a logger: `const logger = resolved.logger ?? defaultLogger`
3. Provide a `GuardResponseFactory` (framework-specific; adapters ship one, for example `ExpressResponseFactory`)
4. Initialize:

```typescript
import {
  SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware,
} from '@guardcore/core';

const resolved = SecurityConfigSchema.parse({
  enableRateLimiting: true,
  rateLimit: 100,
  rateLimitWindow: 60,
  enablePenetrationDetection: true,
  blockedUserAgents: ['badbot'],
});

const components = await initializeSecurityMiddleware(
  resolved,
  resolved.logger ?? defaultLogger,
  myGuardResponseFactory,          // required GuardResponseFactory
  agentHandler ?? null,            // optional AgentHandlerProtocol telemetry
  geoIpHandler ?? null,            // optional GeoIPHandler
  guardDecorator ?? null,          // optional SecurityDecorator instance
);
```

5. Per request, build a `GuardRequest` (framework adapter supplies `clientHost` and `body(): Promise<Uint8Array>`), then:

```typescript
const blockResponse = await components.pipeline.execute(guardRequest);
if (blockResponse) {
  // respond with blockResponse (statusCode, headers, body as Uint8Array) and stop
}
```

Adapters additionally route requests through `components.bypassHandler.handlePassthrough`, `components.bypassHandler.handleSecurityBypass`, and `components.behavioralProcessor.processUsageRules` around the pipeline call.

## SecurityConfigSchema and Configuration

`SecurityConfigSchema` (packages/core/src/models/config.ts) is a Zod object with 64 top-level fields, defaults, and cross-field `superRefine` validators. `.parse()` returns a `ResolvedSecurityConfig` with every default applied, so downstream code reads `config.rateLimit` without null checks.

- Transport toggles: `enableRateLimiting`, `enableIpBanning`, `enablePenetrationDetection`, `enableRedis`, `enforceHttps`, `enableCors`, `enableAgent`, `enableDynamicRules`, `passiveMode`
- Proxy trust: `trustedProxies` (IP or CIDR list), `trustedProxyDepth`, `trustXForwardedProto`; X-Forwarded-For is honored only from trusted proxies
- Limits: `rateLimit` (default 10), `rateLimitWindow`, `endpointRateLimits`, `autoBanThreshold` (default 10), `autoBanDuration` (default 3600 seconds)
- IP policy: `whitelist` (nullable), `blacklist`, `whitelistCountries`, `blockedCountries` (2-letter codes), `blockCloudProviders` (subset of AWS, GCP, Azure)
- Redis: `redisUrl` (default `redis://localhost:6379`), `redisPrefix` (default `guard_core:`)
- Detection tuning: `detectionSemanticThreshold`, `detectionMaxContentLength`, `detectionCompilerTimeout`, and related `detection*` fields
- Telemetry: `agentApiKey`, `agentEndpoint`, `agentProjectId`, buffer and flush settings under `agent*`
- Nested `securityHeaders` config (HSTS maxAge/subdomains/preload, CSP directives, frameOptions, referrerPolicy)
- `logger` accepts a custom `Logger`; `logFormat` switches text/json

## initializeSecurityMiddleware and the Check Pipeline

Signature (packages/core/src/middleware-support.ts):

```typescript
function initializeSecurityMiddleware(
  config: ResolvedSecurityConfig,
  logger: Logger,
  guardResponseFactory: GuardResponseFactory,
  agentHandler?: AgentHandlerProtocol | null,
  geoIpHandler?: GeoIPHandler | null,
  guardDecorator?: unknown,
): Promise<SecurityMiddlewareComponents>
```

Returns `SecurityMiddlewareComponents`: `registry` (HandlerRegistry of all handlers), `pipeline`, `eventBus`, `metricsCollector`, `validator`, `routeResolver`, `bypassHandler`, `errorResponseFactory`, `behavioralProcessor`, `middlewareProtocol`.

`pipeline.execute(request)` runs 17 checks in fixed order and returns the first non-null `GuardResponse` (block/redirect), or null to allow: RouteConfig, EmergencyMode, HttpsEnforcement, RequestLogging, RequestSizeContent, RequiredHeaders, Authentication, Referrer, CustomValidators, TimeWindow, CloudIpRefresh, IpSecurity, CloudProvider, UserAgent, RateLimit, SuspiciousActivity, CustomRequest. A check that throws is logged and skipped; the pipeline continues. `SecurityCheckPipeline` also supports `add`, `insert`, `remove`, `getCheckNames` for programmatic mutation.

Handlers (RedisManager, IPBanManager, RateLimitManager, CloudHandler, SusPatternsManager, SecurityHeadersManager, BehaviorTracker, DynamicRuleManager, IPInfoManager) are constructed by `HandlerInitializer` into a fresh `HandlerRegistry` per middleware instance; no global singletons.

## Detection Engine

All four classes are exported from `@guardcore/core` (packages/core/src/detection-engine/):

- `PatternCompiler`: compiles the 75 `PATTERN_DEFINITIONS` regex tuples from SusPatternsManager with re2-wasm when the optional peer is installed; otherwise falls back to native RegExp guarded by `detectionCompilerTimeout`. Emits `PatternReport`/`PatternStats`
- `ContentPreprocessor`: unicode normalization, HTML entity decoding (he), encoding recovery, and truncation to `detectionMaxContentLength` before matching
- `SemanticAnalyzer`: probability scoring of attack intent, entropy, obfuscation detection, and JS code-injection risk (acorn); produces `SemanticAnalysis`
- `PerformanceMonitor`: records `PerformanceMetric` execution times and raises anomalies via z-score against `detectionMonitorHistorySize`

`detectPenetrationAttempt(request)` in utils is the one-shot helper: it checks query string, URL path, headers, and body against the pattern manager and returns `[detected: boolean, patternName: string]`.

## Utils for IP, Logging, and Detection

Exported from packages/core/src/utils.ts:

- `extractClientIp(request, config, agentHandler?)` - resolves the client IP from `request.clientHost` plus X-Forwarded-For only when the peer is in `config.trustedProxies` (depth-limited by `trustedProxyDepth`); untrusted XFF raises a `suspicious_request` agent event and is ignored; returns `'unknown'` when `clientHost` is null
- `isIpAllowed(ip, config, geoIpHandler?)` - false when the IP matches `blacklist` (exact or CIDR via ipaddr.js) or fails `whitelist`/country rules; true when allowed
- `isUserAgentAllowed(userAgent, config)` - false when a `blockedUserAgents` pattern matches case-insensitively
- `checkIpCountry(ip, config, geoIpHandler)` - true when the request should be blocked by country policy (fails closed to false when GeoIP has no country data or no rules are configured); lazily initializes the GeoIP handler
- `detectPenetrationAttempt(request)` - async scan, returns `[boolean, string]`
- `logActivity(request, logger, logType?, reason?, passiveMode?, triggerInfo?, level?)` - structured request/suspicious logging honoring `logFormat` and level config
- `sanitizeForLog(value)` - strips control characters and newlines before logging attacker-controlled strings
- `sendAgentEvent(agentHandler, eventType, ipAddress, actionTaken, reason, request?, metadata?)` - fire-and-forget telemetry; returns early without a handler and swallows dispatch errors

## SecurityDecorator Mixins

`SecurityDecorator` (packages/core/src/decorators/index.ts) is a class-expression mixin composition: `Advanced(ContentFiltering(Behavioral(Authentication(RateLimiting(AccessControl(BaseSecurityDecorator))))))`, yielding 23 route-level methods including `requireIp`, `blockCountries`, `allowCountries`, `blockClouds`, `bypass`, `rateLimit`, `geoRateLimit`, `requireHttps`, `requireAuth`, `apiKeyAuth`, `requireHeaders`, `blockUserAgents`, `contentTypeFilter`, `maxRequestSize`, `requireReferrer`, `customValidation`, `usageMonitor`, `returnMonitor`, `behaviorAnalysis`, `suspiciousFrequency`, `timeWindow`, `suspiciousDetection`, `honeypotDetection`. Each wraps a route function, writes a `RouteConfig`, and reattaches it via `applyRouteConfig`. `BaseSecurityDecorator` exposes `getRouteConfig(routeId)` and `ensureRouteConfig(fn)`; `getRouteDecoratorConfig(fn)` reads the config back. Pass a decorator instance as the `guardDecorator` argument of `initializeSecurityMiddleware` to enable per-route behavior and behavioral processing.

## Footguns

- Optional peers are real dependencies: enabling `enableRedis` without ioredis, or GeoIP without maxmind, fails at runtime; core marks them optional so edge builds without those features still install
- Buffer is banned in protocols: `GuardRequest.body()` and `GuardResponse.body` are `Uint8Array`; converting with `Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength)` when writing adapters, but never change protocol types
- `exactOptionalPropertyTypes` is on: `{ optionalField: undefined }` is not assignable to `field?: string`; assign undefined explicitly or omit the property
- X-Forwarded-For is untrusted by default: with empty `trustedProxies`, spoofed headers trigger a suspicious_request event and the connecting IP wins; configure `trustedProxies`/`trustedProxyDepth` behind real proxies
- `checkIpCountry` returning false means "not blocked", not "allowed policy matched"; unknown countries and empty rules both return false
- Pipeline errors do not fail closed on master: a throwing check is logged and skipped. The fail-closed conformance baseline is still an unmerged draft (PR #47)
- Imports must use `.js` extensions on relative paths (ESM + tsup); a bare `./utils` import breaks the build
- Never edit the 75 pattern regexes or context sets casually; they mirror the Python upstream and cross-language tests depend on them
- Coverage thresholds (statements/lines 100, functions 99, branches 96) fail CI on uncovered branches; the codebase uses `v8 ignore` pragmas for unreachable-by-design paths
- No default exports anywhere; the public surface is exactly packages/core/src/index.ts, and adapters re-export from core rather than re-implementing

## Related Projects

- guard-core (https://github.com/Guard-Core/guard-core) - the Python engine this repository ports; upstream source of truth for patterns, Redis key layouts, and behavior
- In-repo adapter packages: `packages/express`, `packages/fastify`, `packages/hono`, `packages/nestjs`, each with runnable examples under `examples/`
- Repo-level guidance: AGENTS.md / CLAUDE.md at the repository root
