---
title: "Hono Adapter"
description: "Using @guardcore/hono with createGuardMiddleware, edge-safe design, and Cloudflare Workers"
---

`@guardcore/hono` provides Hono middleware that runs on Node.js and edge runtimes (Cloudflare Workers, Deno, Vercel Edge).

## Installation

```bash
pnpm add @guardcore/hono
```

## API

### `createGuardMiddleware(options)`

Creates a Hono `MiddlewareHandler`. Lazy-initializes on first request.

```typescript
import { createGuardMiddleware } from '@guardcore/hono';

const middleware = createGuardMiddleware({
  config: { /* SecurityConfig */ },
});

app.use('*', middleware);
```

**Options**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `config` | `SecurityConfig` | Yes | Security configuration |
| `agentHandler` | `AgentHandlerProtocol` | No | Telemetry agent |
| `geoIpHandler` | `GeoIPHandler` | No | GeoIP handler for country filtering |
| `guardDecorator` | `SecurityDecorator` | No | Decorator instance for per-route config |
| `routeConfigs` | `PathRouteConfigEntry[]` | No | Per-route configs matched by method (optional) and request path: exact match, or prefix when the path ends with `/*`. Longest path wins |

### `configureCors(app, config)`

Configures CORS using Hono's built-in `hono/cors` middleware (no additional packages needed).

```typescript
import { configureCors, SecurityConfigSchema } from '@guardcore/hono';

const config = SecurityConfigSchema.parse({
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
});

configureCors(app, config);
```

## Edge-Safe Design

The Hono adapter is designed for edge runtimes:

- **`Uint8Array` bodies** -- No `Buffer` dependency. Bodies are read via `req.arrayBuffer()` and wrapped in `Uint8Array`.
- **Lazy initialization** -- The security engine initializes on the first request, not at import time. This avoids cold-start issues.
- **Optional Redis** -- Set `enableRedis: false` for edge deployments. Rate limiting and IP bans work in-memory per isolate.
- **`re2-wasm`** -- Works in all runtimes via WebAssembly. Falls back to native `RegExp` if unavailable.

## Client IP on Edge

Hono does not expose `req.ip` like other frameworks. The adapter resolves the connecting peer address from what the runtime hands the app (`resolveHonoClientAddress`, also exported):

| Runtime | Source |
|---------|--------|
| Node (`@hono/node-server`) | `c.env.incoming.socket.remoteAddress` |
| Deno (`Deno.serve(app.fetch)`) | `c.env.remoteAddr.hostname` |
| Bun (`Bun.serve({ fetch: app.fetch })`) | `c.env.requestIP(req).address` |
| Cloudflare Workers | the `cf-connecting-ip` header (only read when running on Workers, where the platform sets it) |

A request whose address cannot be resolved (a Unix socket, `app.request()` in a test) is rejected with `403` under the default `failSecure: true`, and continues as identity `unknown` with `failSecure: false`. For any other runtime pass `connectingIpResolver`:

```typescript
import { getConnInfo } from 'hono/bun';

app.use('*', createGuardMiddleware({
  config,
  connectingIpResolver: (c) => getConnInfo(c).remote.address ?? null,
}));
```

For Cloudflare Workers, use the `geoResolver` config option to read from `cf.country`:

```typescript
const middleware = createGuardMiddleware({
  config: {
    enableRedis: false,
    rateLimit: 100,
    rateLimitWindow: 60,
    blockedCountries: ['RU', 'CN'],
    geoResolver: (ip: string) => {
      return null;
    },
  },
});
```

Or provide a custom `geoResolver` that reads from Cloudflare's `cf` object at the route level.

## Response Processing

After calling `next()`, the adapter captures the response for:
- Security header injection
- Metrics collection
- Behavioral return rule processing

Response bodies are not captured on the Hono adapter (only status and headers) to avoid buffering issues on edge runtimes.

## Full Example (Node.js)

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import {
  createGuardMiddleware,
  configureCors,
  SecurityDecorator,
  SecurityConfigSchema,
} from '@guardcore/hono';

const app = new Hono();

const config = SecurityConfigSchema.parse({
  enableRedis: false,
  rateLimit: 100,
  rateLimitWindow: 60,
  enablePenetrationDetection: true,
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
  excludePaths: ['/health'],
});

const guard = new SecurityDecorator(config);

configureCors(app, config);
app.use('*', createGuardMiddleware({ config, guardDecorator: guard }));

app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/api/data', (c) => c.json({ data: 'protected' }));

serve({ fetch: app.fetch, port: 3000 });
```

## Cloudflare Workers Deployment

```typescript
import { Hono } from 'hono';
import { createGuardMiddleware } from '@guardcore/hono';

const app = new Hono();

app.use('*', createGuardMiddleware({
  config: {
    enableRedis: false,
    rateLimit: 50,
    rateLimitWindow: 60,
    enablePenetrationDetection: true,
    blockedUserAgents: ['sqlmap', 'nikto'],
  },
}));

app.get('/', (c) => c.json({ message: 'Protected by @guardcore' }));

export default app;
```

Deploy with:

```bash
wrangler deploy
```

### Per-route detection exclusions

```typescript
import { createGuardMiddleware, RouteConfig } from '@guardcore/hono';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

app.use('*', createGuardMiddleware({
  config,
  routeConfigs: [{ path: '/api/search', config: openConfig }],
}));
```
