---
title: "Architecture Overview"
description: "Layer diagram, HandlerRegistry pattern, context objects, and dependency injection"
---

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│              Framework Adapter               │
│  (Express / Fastify / NestJS / Hono)        │
│  Implements GuardRequest, GuardResponse      │
├─────────────────────────────────────────────┤
│         initializeSecurityMiddleware()       │
│  Creates all components, returns registry    │
├─────────────────────────────────────────────┤
│           SecurityCheckPipeline              │
│  17 checks in Chain of Responsibility       │
├─────────────────────────────────────────────┤
│              Core Modules                    │
│  Events │ Routing │ Validation │ Bypass     │
│  Behavioral │ Responses │ Initialization    │
├─────────────────────────────────────────────┤
│              HandlerRegistry                 │
│  Redis │ IPBan │ RateLimit │ Cloud │ SusP   │
│  SecurityHeaders │ Behavior │ DynamicRules  │
├─────────────────────────────────────────────┤
│             Protocols Layer                  │
│  GuardRequest │ GuardResponse │ GeoIPHandler│
│  AgentHandler │ RedisHandler │ Middleware   │
└─────────────────────────────────────────────┘
```

## No Singletons

The Python `guard-core` uses `__new__` singletons for handlers. The TypeScript port eliminates all global state:

- `HandlerInitializer.initialize(config)` creates fresh handler instances
- Returns a `HandlerRegistry` holding all handlers
- Each middleware instance owns its own registry
- Tests create fresh instances per test case

## HandlerRegistry Pattern

```typescript
interface HandlerRegistry {
  redisHandler: RedisManager | null;
  ipBanHandler: IPBanManager;
  rateLimitHandler: RateLimitManager;
  cloudHandler: CloudHandler;
  susPatternsHandler: SusPatternsManager;
  securityHeadersHandler: SecurityHeadersManager;
  behaviorTracker: BehaviorTracker;
  dynamicRuleHandler: DynamicRuleManager;
  geoIpHandler: GeoIPHandler | null;
}
```

The registry is created by `HandlerInitializer` and flows through `SecurityMiddlewareComponents` to all checks and processors.

## SecurityMiddlewareComponents

The `initializeSecurityMiddleware()` function is the central entry point. It creates all components and returns:

```typescript
interface SecurityMiddlewareComponents {
  registry: HandlerRegistry;
  pipeline: SecurityCheckPipeline;
  eventBus: SecurityEventBus;
  metricsCollector: MetricsCollector;
  validator: RequestValidator;
  routeResolver: RouteConfigResolver;
  bypassHandler: BypassHandler;
  errorResponseFactory: ErrorResponseFactory;
  behavioralProcessor: BehavioralProcessor;
  middlewareProtocol: GuardMiddlewareProtocol;
}
```

Adapters store this object and use it to process every request.

## Request Flow

```
1. Adapter receives native request
2. Wraps it in GuardRequest
3. BypassHandler.handlePassthrough() → a request with no client address is answered 403
   (failSecure, the default) or continues as "unknown"; an excluded path is marked
   exclusion-scoped and continues
4. RouteConfigResolver.getRouteConfig() → resolve per-route config
5. BypassHandler.beginSecurityBypass() → an all-checks bypass route goes straight to the
   route handler (only customResponseModifier runs on its response)
6. SecurityCheckPipeline.execute() → run 17 checks (an exclusion-scoped request runs only
   route_config, ip_security and rate_limit)
7. If blocked: send GuardResponse via adapter (no response pass, no request metrics)
8. If passed: call next() / route handler
9. Capture response for behavioral processing, security headers and request metrics
```

## Dependency Injection

All core modules receive their dependencies through constructor parameters or method arguments. There is no service locator or container.

**Checks** receive the `GuardMiddlewareProtocol`:
```typescript
abstract class SecurityCheck {
  constructor(protected readonly middleware: GuardMiddlewareProtocol) {}
}
```

Through the middleware protocol, checks access config, logger, handlers, and the response factory.

**Core modules** (routing, validation, bypass, etc.) receive specific dependencies:
```typescript
class BypassHandler {
  constructor(
    config: ResolvedSecurityConfig,
    eventBus: SecurityEventBus,
    routeResolver: RouteConfigResolver,
    errorResponseFactory: ErrorResponseFactory,
    validator: RequestValidator,
  ) {}
}
```

## Edge Safety

The protocol layer uses `Uint8Array` instead of Node.js `Buffer` for binary data:

```typescript
interface GuardResponse {
  readonly body: Uint8Array | null;
}

interface GuardRequest {
  body(): Promise<Uint8Array>;
}
```

This allows the core engine to run in Cloudflare Workers, Deno, and other edge runtimes that lack Node.js built-ins.

Redis and maxmind features gracefully degrade when unavailable -- rate limiting falls back to in-memory, GeoIP returns `null`, and the engine continues operating.
