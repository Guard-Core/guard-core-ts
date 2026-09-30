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
