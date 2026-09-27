---
title: "Express Adapter"
description: "Using @guardcore/express with createSecurityMiddleware, configureCors, and guardBodyParser"
---

`@guardcore/express` provides Express middleware that wraps the core security engine.

## Installation

```bash
pnpm add @guardcore/express
```

## API

### `createSecurityMiddleware(options)`

Creates an Express middleware function. Lazy-initializes on first request.

```typescript
import { createSecurityMiddleware } from '@guardcore/express';

const middleware = createSecurityMiddleware({
  config: { /* SecurityConfig */ },
  agentHandler: undefined,
  geoIpHandler: undefined,
  guardDecorator: undefined,
});

app.use(middleware);
```

**Options**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `config` | `SecurityConfig` | Yes | Security configuration |
| `agentHandler` | `AgentHandlerProtocol` | No | Telemetry agent |
| `geoIpHandler` | `GeoIPHandler` | No | GeoIP handler for country filtering |
| `guardDecorator` | `SecurityDecorator` | No | Decorator instance for per-route config |
| `routeConfigs` | `PathRouteConfigEntry[]` | No | Per-route configs matched by method (optional) and request path: exact match, or prefix when the path ends with `/*`. Longest path wins |

### `guardBodyParser()`

Express JSON body parser that preserves the raw body as a `Buffer` on `req.rawBody`. Required for the detection engine to scan request bodies.

```typescript
import { guardBodyParser, guardUrlEncodedParser } from '@guardcore/express';

app.use(guardBodyParser());
app.use(guardUrlEncodedParser());
```

### `configureCors(app, config)`

Configures CORS using the `cors` npm package (must be installed separately).

```typescript
import { configureCors, SecurityConfigSchema } from '@guardcore/express';

const config = SecurityConfigSchema.parse({
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
});

configureCors(app, config);
```

### `sendGuardResponse(res, guardResponse)`

Sends a `GuardResponse` through an Express `Response`. Used internally but exported for custom integrations.

## Response Interception

The Express adapter intercepts `res.end()` to capture response bodies for behavioral processing. When a route has behavior rules (e.g., `returnMonitor`), the adapter:

1. Wraps `res.end()` to capture the response body
2. Creates a `GuardResponse` from the captured data
3. Runs `processReturnRules` with the captured response
4. Calls the original `res.end()`

This happens asynchronously and never blocks the response.

## Full Example

```typescript
import express from 'express';
import {
  createSecurityMiddleware,
  guardBodyParser,
  configureCors,
  SecurityDecorator,
  SecurityConfigSchema,
} from '@guardcore/express';

const app = express();

const config = SecurityConfigSchema.parse({
  enableRedis: false,
  rateLimit: 100,
  rateLimitWindow: 60,
  enablePenetrationDetection: true,
  enableCors: true,
  corsAllowOrigins: ['https://app.example.com'],
  blockedUserAgents: ['sqlmap', 'nikto'],
  excludePaths: ['/health'],
});

const guard = new SecurityDecorator(config);

app.use(guardBodyParser());
configureCors(app, config);

app.use(createSecurityMiddleware({
  config,
  guardDecorator: guard,
}));

const loginHandler = guard.rateLimit(5, 300)(async (req, res) => {
  res.json({ token: 'abc123' });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.post('/api/login', (req, res, next) => {
  loginHandler(req, res).catch(next);
});

app.listen(3000, () => {
  console.log('Server running on :3000');
});
```

### Per-route detection exclusions

```typescript
import { createSecurityMiddleware, RouteConfig } from '@guardcore/express';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

const mutedBodyConfig = new RouteConfig();
mutedBodyConfig.detectionScanBody = false;

app.use(createSecurityMiddleware({
  config,
  routeConfigs: [
    { path: '/api/search', config: openConfig },
    { method: 'POST', path: '/api/ingest', config: mutedBodyConfig },
  ],
}));
```
