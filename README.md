# @guardcore

> Framework-agnostic security middleware engine for Node.js and edge runtimes.

[![npm version](https://img.shields.io/npm/v/@guardcore/core.svg)](https://www.npmjs.com/package/@guardcore/core)
[![CI](https://github.com/rennf93/guard-core-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/rennf93/guard-core-ts/actions/workflows/ci.yml)
[![CodeQL](https://github.com/rennf93/guard-core-ts/actions/workflows/codeql.yml/badge.svg)](https://github.com/rennf93/guard-core-ts/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

TypeScript port of [guard-core](https://github.com/rennf93/guard-core) — the engine that powers the Guard security ecosystem. All shared security logic lives here. Framework-specific adapters wire it into Express, Fastify, NestJS, and Hono.

Docs: <https://rennf93.github.io/guard-core-ts/>

## Ecosystem

```
@guardcore/core                    <- Engine: all security logic
├── @guardcore/express             <- Express middleware adapter
├── @guardcore/fastify             <- Fastify plugin adapter
├── @guardcore/nestjs              <- NestJS middleware + module
└── @guardcore/hono                <- Hono middleware (edge-safe)
```

## Features

- **IP Control** — Whitelisting, blacklisting, CIDR ranges, auto-ban on suspicious activity
- **Rate Limiting** — Global, per-endpoint, per-route, geo-based limits with Redis sliding window
- **Penetration Detection**: 157 regex patterns (spec 4.1.0 table) + semantic analysis for XSS, SQLi, command injection, path traversal, with per-scan verdict deadlines and consecutive-timeout pattern quarantine on the native regex path
- **Security Headers** — 10 default headers (HSTS, CSP, CORP, COEP, COOP, etc.)
- **Behavioral Analysis** — Usage monitoring, return pattern tracking, ban/throttle/alert actions
- **Cloud Provider Blocking** — AWS, GCP, Azure IP range detection
- **Country Filtering** — GeoIP-based blocking/whitelisting via MaxMind
- **HTTPS Enforcement** — Automatic HTTP to HTTPS redirect with trusted proxy support
- **Decorator System**: 25 decorator methods for per-route security configuration
- **Redis Integration** — Distributed rate limiting, shared IP bans, cloud IP caching
- **Edge Runtime Support** — Uint8Array protocols, re2-wasm regex, no Node-only dependencies in core

## Quick Start

### Express

```bash
npm install @guardcore/core @guardcore/express
```

```typescript
import express from 'express';
import { createSecurityMiddleware } from '@guardcore/express';

const app = express();

app.use(createSecurityMiddleware({
  config: {
    enableRateLimiting: true,
    rateLimit: 100,
    rateLimitWindow: 60,
    blockedUserAgents: ['badbot', 'scrapy'],
    enablePenetrationDetection: true,
  },
}));

app.listen(3000);
```

### Fastify

```bash
npm install @guardcore/core @guardcore/fastify
```

```typescript
import Fastify from 'fastify';
import { guardPlugin } from '@guardcore/fastify';

const app = Fastify();

app.register(guardPlugin, {
  config: {
    enableRateLimiting: true,
    rateLimit: 100,
    rateLimitWindow: 60,
  },
});

app.listen({ port: 3000 });
```

### NestJS

```bash
npm install @guardcore/core @guardcore/nestjs
```

```typescript
import { Module } from '@nestjs/common';
import { GuardModule } from '@guardcore/nestjs';

@Module({
  imports: [
    GuardModule.forRoot({
      config: {
        enableRateLimiting: true,
        rateLimit: 100,
      },
    }),
  ],
})
export class AppModule {}
```

### Hono (Edge)

```bash
npm install @guardcore/core @guardcore/hono
```

```typescript
import { Hono } from 'hono';
import { createGuardMiddleware } from '@guardcore/hono';

const app = new Hono();

app.use('*', createGuardMiddleware({
  config: {
    enableRateLimiting: true,
    rateLimit: 100,
  },
}));

export default app;
```

## SecurityConfig

The central configuration object controls all security behavior:

```typescript
import { SecurityConfigSchema } from '@guardcore/core';

const config = SecurityConfigSchema.parse({
  blacklist: ['192.168.100.0/24'],
  trustedProxies: ['172.16.0.0/12', '10.0.0.0/8'],
  blockCloudProviders: ['AWS', 'GCP', 'Azure'],
  blockedUserAgents: ['badbot', 'scrapy'],
  enableRateLimiting: true,
  rateLimit: 30,
  rateLimitWindow: 60,
  enableIpBanning: true,
  autoBanThreshold: 5,
  autoBanDuration: 300,
  enablePenetrationDetection: true,
  enforceHttps: true,
  enableRedis: true,
  redisUrl: 'redis://localhost:6379',
  logFormat: 'json',
  securityHeaders: {
    enabled: true,
    hsts: { maxAge: 31536000, includeSubdomains: true, preload: true },
    csp: { 'default-src': ["'self'"], 'script-src': ["'self'"] },
  },
});
```

## SecurityDecorator

Per-route security configuration via decorators:

```typescript
import { SecurityDecorator, SecurityConfigSchema } from '@guardcore/core';

const guard = new SecurityDecorator(SecurityConfigSchema.parse({}));

function myHandler() { /* ... */ }

guard.requireIp(['10.0.0.0/8'])(myHandler);
guard.rateLimit(100, 3600)(myHandler);
guard.requireAuth('bearer')(myHandler);
guard.blockCountries(['CN', 'RU'])(myHandler);
guard.usageMonitor(5, 3600, 'ban')(myHandler);
```

Decorator route configs resolve at request time through the adapters, which copy the decorated handler's `_guardRouteId` onto the guard request state:

| Adapter | Handler resolution | Notes |
|---|---|---|
| Express | Supported | Route-level mounting resolves through `req.route`; app-level mounting scans the app router stack for the first matching route. Routes inside mounted sub-routers resolve only when the guard is mounted at that router level. |
| Fastify | Supported | The plugin's `onRoute` hook captures the handler's route id at registration time (register the plugin before your routes). |
| Hono | Supported | Resolved from `c.req.matchedRoutes` (the composed handler chain). |
| NestJS | Not available | Nest middleware (where the guard pipeline runs) runs before routing and the Express layer only exposes the framework's proxy closure, never the controller method; Nest's own handler surface (`ExecutionContext.getHandler()`) exists only in guards/interceptors, which run after the middleware. Use the `routeConfigs` path-entry option (or Fastify-style native route options on other adapters) for per-route configuration in Nest. |

## Agent fan-out and export sinks

`CompositeAgentHandler` fans events and metrics out to several `AgentHandlerProtocol` sinks behind one handler (muted-type filtering via `EventFilter`, an optional enricher seam, per-sink failure isolation, degraded-start tracking, first non-null dynamic rules), mirroring the Python composite handler. Export handlers for OpenTelemetry and Logfire map security events to `guard.event.*` spans (with traceparent/tracestate parent extraction and `guard.*` metadata forwarding) and metrics to the reference instrument set (`guard.request.duration`, `guard.request.count`, `guard.error.count`); the SDK/logfire clients are injected through seams so the engine keeps zero hard dependencies:

```typescript
import { CompositeAgentHandler, OtelHandler, LogfireHandler, EventFilter } from '@guardcore/core';

const composite = new CompositeAgentHandler(
  [
    agentClient,                       // your GuardAgent sink
    new OtelHandler({ serviceName: 'api', instrumentation: myOtelWiring }),
    new LogfireHandler({ serviceName: 'api', client: myLogfireClient }),
  ],
  { eventFilter: new EventFilter(['pattern_added']) },
);
```

## WebSocket guard

The same checks the HTTP pipeline applies (client identity, IP bans, allow lists, rate limiting, penetration detection) run on WebSocket upgrade requests, mirroring the Python `guard_websocket` reference (close codes 1008/1013; a rejected handshake answers HTTP 403 pre-accept). Express, Hono, and NestJS expose `attachWebSocketGuard(server, options)`; it gates the Node server's upgrade dispatch itself, so attach order relative to your ws/socket.io/node-ws setup does not matter:

```typescript
import http from 'node:http';
import { attachWebSocketGuard } from '@guardcore/express';

const server = http.createServer(app);
attachWebSocketGuard(server, {
  config,
  // pass the middleware's components to share Redis / rate-limit / pattern managers
});
```

Fastify note: WebSocket upgrades in Fastify ride the raw Node server through `@fastify/websocket`, which the plugin cannot intercept from inside the Fastify hook lifecycle. Use the core helper directly on your server: `import { attachNodeWebSocketGuard } from '@guardcore/core'`.

On non-Node runtimes (Workers, Deno, Bun), wire the core `guardWebSocketUpgrade(request, components)` into the host's upgrade hook.

## Structured logging (logFormat / customLogFile)

The `logFormat: 'json'` and `customLogFile` config fields are live. An injected `config.logger` always wins; otherwise `logFormat: 'json'` makes every guard log line a JSON object (`timestamp`, `level`, `logger`, `message`), and `customLogFile` appends the same formatted lines to a file (directory created on demand; failures degrade to console-only with a warning). All adapters and the WebSocket guard go through this resolution.

```typescript
const config = {
  logFormat: 'json',
  customLogFile: '/var/log/guard/security.log',
};
```

## Detection scan execution (default decision, evidence-based)

The default regex scan execution is a deadline-bounded synchronous fallback with consecutive-timeout pattern quarantine: JavaScript RegExp cannot be interrupted, so a bounded inline path with quarantine is the only execution mode that works everywhere (worker-less edge runtimes included). A true worker pool is available opt-in with `detectionScanWorkerPool: true`.

The trade-off is measured, not guessed. Run `pnpm --filter @guardcore/core bench` (`packages/core/benchmarks/scan-pool-bench.ts`), which scans a realistic + adversarial corpus on both paths and reports wall time and the worst main-thread freeze:

```text
corpus: 23 payloads (382144 bytes)

inline deadline-bounded fallback (default):
  wall time              : 221 ms
  max main-thread stall  : 216 ms
opt-in worker pool (detectionScanWorkerPool: true):
  wall time              : 275 ms
  max main-thread stall  : 22 ms
```

The pool buys event-loop latency (roughly 10x smaller worst stall on this corpus) at a throughput cost from per-scan message marshaling. Keep the default when raw throughput matters most; enable the pool when worst-case loop stalls (tail latency for unrelated requests) dominate your SLO.

## Bounded body reads

Detection body reads are bounded: `detectionMaxBodyInspectBytes` caps what is scanned, `bodyReadTimeout` (default 3s) bounds a stalled adapter read, and `bodyReadMaxConcurrent` (default 64) bounds in-flight reads process-wide. Adapters that can read a byte cap natively implement the optional `GuardRequest.readBodyPrefix(maxBytes)` protocol; the express body parser and Fastify/onRequest adapters delegate the memory bound to the framework parser and trim after the fact.

## Route-level options

- `routeConfigs` path entries (all adapters): exact path or `prefix/*` matching, longest path wins.
- `RouteConfig.sessionLimits`: per-route map of header name to a per-session request cap within the route's rate-limit window; counters key by `session:<header>:<value>` so distinct sessions behind one IP are limited independently.
- Fastify native options: `fastify.get('/x', { config: { guardRouteConfig } }, handler)` wins over every other route surface.

## Python Parity

This is a faithful TypeScript port of [guard-core](https://github.com/rennf93/guard-core). The Python codebase is the source of truth for features, architecture, and behavior. All 157 detection patterns, 84 SecurityConfig fields, 6 protocols, 17 security checks, and 9 handlers are ported 1:1, and the engine is verified against the vendored spec 4.1.0 conformance corpus (219 cases) in `conformance/guard-core-spec-4.1.0`, wired as a CI gate.

The Python Guard ecosystem:
- [guard-core](https://github.com/rennf93/guard-core) — Engine (Python)
- [fastapi-guard](https://github.com/rennf93/fastapi-guard) — FastAPI adapter
- [flaskapi-guard](https://github.com/rennf93/flaskapi-guard) — Flask adapter
- [djapi-guard](https://github.com/rennf93/djapi-guard) — Django adapter

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

Or use Make:

```bash
make install
make build
make test
make lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security best practices.

## License

MIT
