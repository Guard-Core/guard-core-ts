---
title: "Protocols"
description: "All 7 TypeScript interfaces that define the framework-agnostic contract"
---

The protocol layer defines TypeScript interfaces that framework adapters implement. The core engine operates exclusively through these interfaces -- it never imports Express, Fastify, NestJS, or Hono.

## GuardRequest

Framework-agnostic request representation. Adapters wrap their native request objects to implement this interface.

```typescript
interface GuardRequest {
  readonly urlPath: string;
  readonly urlScheme: string;
  readonly urlFull: string;
  urlReplaceScheme(scheme: string): string;
  readonly method: string;
  readonly clientHost: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
  body(): Promise<Uint8Array>;
  readonly state: GuardRequestState;
  readonly scope: Readonly<Record<string, unknown>>;
}
```

| Property | Description |
|----------|-------------|
| `urlPath` | URL path without query string (e.g., `/api/users`) |
| `urlScheme` | Protocol scheme (`http` or `https`) |
| `urlFull` | Full URL including scheme, host, path, and query |
| `urlReplaceScheme(scheme)` | Returns the full URL with a replaced scheme |
| `method` | HTTP method (`GET`, `POST`, etc.) |
| `clientHost` | Connecting socket address exactly as the server reports it (before proxy resolution; on a dual-stack listener an IPv4 client appears as `::ffff:a.b.c.d`). The engine resolves the client identity from it once, in the `route_config` check, and stores the result on `state.client_ip` |
| `headers` | Request headers as a readonly string map |
| `queryParams` | Query parameters as a readonly string map |
| `body()` | Returns the request body as `Uint8Array` (edge-safe, no Buffer) |
| `state` | Mutable state bag for passing data between pipeline stages |
| `scope` | Framework-specific metadata (read-only) |

`GuardRequestState` holds decorator route IDs and endpoint IDs:

```typescript
interface GuardRequestState {
  guardRouteId?: string;
  guardEndpointId?: string;
  guardDecorator?: unknown;
  [key: string]: unknown;
}
```

## GuardResponse

Framework-agnostic response representation.

```typescript
interface GuardResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  readonly body: Uint8Array | null;
  readonly bodyText: string | null;
}
```

| Property | Description |
|----------|-------------|
| `statusCode` | HTTP status code |
| `headers` | Response headers |
| `setHeader(name, value)` | Add or override a header |
| `body` | Response body as `Uint8Array` (edge-safe) |
| `bodyText` | Response body as UTF-8 string (convenience accessor) |

## GuardResponseFactory

Creates `GuardResponse` objects. Each adapter provides its own implementation.

```typescript
interface GuardResponseFactory {
  createResponse(content: string, statusCode: number): GuardResponse;
  createRedirectResponse(url: string, statusCode: number): GuardResponse;
}
```

## GuardMiddlewareProtocol

The contract that security checks use to access middleware state and handlers.

```typescript
interface GuardMiddlewareProtocol {
  readonly config: ResolvedSecurityConfig;
  readonly logger: Logger;
  lastCloudIpRefresh: number;
  suspiciousRequestCounts: Map<string, number>;
  readonly eventBus: unknown;
  readonly routeResolver: unknown;
  readonly responseFactory: unknown;
  readonly rateLimitHandler: unknown;
  readonly agentHandler: AgentHandlerProtocol | null;
  readonly geoIpHandler: GeoIPHandler | null;
  readonly guardResponseFactory: GuardResponseFactory;
  createErrorResponse(statusCode: number, defaultMessage: string): Promise<GuardResponse>;
  refreshCloudIpRanges(): Promise<void>;
}
```

## GeoIPHandler

Geographic IP lookup. The default implementation (`IPInfoManager`) uses the `maxmind` package.

```typescript
interface GeoIPHandler {
  readonly isInitialized: boolean;
  initialize(): Promise<void>;
  initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void>;
  initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void>;
  getCountry(ip: string): string | null;
}
```

You can provide a custom implementation or use the simpler `geoResolver` config option:

```typescript
const config: SecurityConfig = {
  geoResolver: (ip: string) => {
    return myGeoDatabase.lookup(ip)?.country ?? null;
  },
};
```

## AgentHandlerProtocol

Telemetry and event dispatch interface.

```typescript
interface AgentHandlerProtocol {
  initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void>;
  sendEvent(event: unknown): Promise<void>;
  sendMetric(metric: unknown): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  flushBuffer(): Promise<void>;
  getDynamicRules(): Promise<unknown | null>;
  healthCheck(): Promise<boolean>;
}
```

Agent failures are never fatal -- all calls are wrapped in try/catch throughout the codebase.

## RedisHandlerProtocol

Distributed state operations.

```typescript
interface RedisHandlerProtocol {
  getKey(namespace: string, key: string): Promise<unknown>;
  setKey(namespace: string, key: string, value: unknown, ttl?: number | null): Promise<boolean | null>;
  delete(namespace: string, key: string): Promise<number | null>;
  keys(pattern: string): Promise<string[] | null>;
  initialize(): Promise<void>;
  getConnection(): AsyncDisposable;
}
```

The `RedisManager` class implements this protocol using `ioredis`. All methods return `null` when Redis is unavailable, allowing callers to fall back to in-memory state.
