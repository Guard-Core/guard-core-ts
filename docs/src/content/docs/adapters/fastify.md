---
title: "Fastify Adapter"
description: "Using @guardcore/fastify with guardPlugin, configureCors, and Fastify hooks"
---

`@guardcore/fastify` provides a Fastify plugin that wraps the core security engine using `onRequest` and `onSend` hooks.

## Installation

```bash
pnpm add @guardcore/fastify
```

## API

### `guardPlugin`

An async Fastify plugin that registers security hooks. Initializes eagerly at registration time.

```typescript
import { guardPlugin } from '@guardcore/fastify';

await app.register(guardPlugin, {
  config: { /* SecurityConfig */ },
});
```

**Options**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `config` | `SecurityConfig` | Yes | Security configuration |
| `agentHandler` | `AgentHandlerProtocol` | No | Telemetry agent |
| `geoIpHandler` | `GeoIPHandler` | No | GeoIP handler for country filtering |
| `guardDecorator` | `SecurityDecorator` | No | Decorator instance for per-route config |
| `routeConfigs` | `PathRouteConfigEntry[]` | No | Per-route configs matched by method (optional) and request path: exact match, or prefix when the path ends with `/*`. Fastify's native route options work too: pass a `RouteConfig` as `config: { guardRouteConfig }` on a route |

### `configureCors(fastify, config)`

Configures CORS using `@fastify/cors` (must be installed separately).

```typescript
import { configureCors, SecurityConfigSchema } from '@guardcore/fastify';

const config = SecurityConfigSchema.parse({
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
});

await configureCors(app, config);
```

## Hook Architecture

The plugin registers two Fastify hooks:

### `onRequest` Hook

Runs before route handlers. Performs the full security pipeline:

1. Creates a `FastifyGuardRequest` from the Fastify request
2. Checks passthrough conditions (excluded paths)
3. Resolves route configuration from decorators
4. Checks security bypass conditions
5. Executes the 17-check security pipeline
6. Processes behavioral usage rules
7. Stores guard state on the request for the `onSend` hook

### `onSend` Hook

Runs after route handlers, before the response is sent:

1. Retrieves guard state from the request
2. Captures the response as a `GuardResponse`
3. Processes response through the error response factory (applies security headers, collects metrics)
4. Runs behavioral return rules if configured

## Full Example

```typescript
import Fastify from 'fastify';
import {
  guardPlugin,
  configureCors,
  SecurityDecorator,
  SecurityConfigSchema,
} from '@guardcore/fastify';

const app = Fastify({ logger: true });

const config = SecurityConfigSchema.parse({
  enableRedis: true,
  redisUrl: 'redis://localhost:6379',
  rateLimit: 100,
  rateLimitWindow: 60,
  enablePenetrationDetection: true,
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
  blockedUserAgents: ['sqlmap', 'nikto'],
  excludePaths: ['/health'],
});

const guard = new SecurityDecorator(config);

await configureCors(app, config);
await app.register(guardPlugin, {
  config,
  guardDecorator: guard,
});

app.get('/health', async () => ({ status: 'ok' }));

const searchHandler = guard.rateLimit(20, 60)(async (request, reply) => {
  return { results: [] };
});

app.get('/api/search', searchHandler);

await app.listen({ port: 3000 });
```

## Body Handling

Fastify parses request bodies automatically. The `FastifyGuardRequest` adapter handles body conversion:

- `Buffer` bodies are converted to `Uint8Array`
- `string` bodies are encoded via `TextEncoder`
- Object bodies (parsed JSON) are re-serialized via `JSON.stringify` then encoded
- Missing bodies return an empty `Uint8Array`

### Per-route detection exclusions

```typescript
import { guardPlugin, RouteConfig } from '@guardcore/express';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

await app.register(guardPlugin, {
  config,
  routeConfigs: [{ path: '/api/search', config: openConfig }],
});

// Or fastify's native per-route options:
app.post('/api/ingest', {
  config: { guardRouteConfig: Object.assign(new RouteConfig(), { detectionScanBody: false }) },
}, handler);
```
