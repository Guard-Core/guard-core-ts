---
title: "Examples"
description: "Runnable example apps for Express, Fastify, NestJS, Hono, and an advanced production-style setup"
---

The repository ships runnable example apps under [`examples/`](https://github.com/rennf93/guard-core-ts/tree/master/examples).
Each one is a pnpm workspace member, so a single `pnpm install` at the repo
root links `@guardcore/core` and the adapters (build them first with
`pnpm build`).

| Example | Directory | Redis |
|---------|-----------|-------|
| Express | `examples/express/` | Yes |
| Fastify | `examples/fastify/` | Yes |
| NestJS | `examples/nestjs/` | Yes |
| Hono (edge-safe) | `examples/hono/` | No |
| Advanced (Express) | `examples/advanced/` | Yes |

## Running with Docker Compose

Every example directory has a `Dockerfile` and a `docker-compose.yml` (app
plus `redis:7-alpine` where needed, with healthchecks and resource limits):

```bash
cd examples/express
docker compose up --build
```

The apps listen on port `8080` under compose and on port `3000` when run
directly. The Hono example serves through `@hono/node-server` via
`server.ts`; its `app.ts` stays edge-safe and exports the Hono app.

## Running without Docker

```bash
docker run -d -p 6379:6379 redis:7-alpine   # needed by every example except Hono
pnpm install
pnpm build
cd examples/express
npx tsx app.ts
```

## What the advanced example adds

`examples/advanced/` mirrors a production-style setup on Express:

- Environment-driven `SecurityConfig` (`REDIS_URL`, `GUARD_RATE_LIMIT`,
  `GUARD_BURST_LIMIT`, `ADMIN_TOKEN`, and friends)
- Engine-level per-endpoint rate limits through `endpointRateLimits`
  (`/rate/burst` allows 5 requests per 60 seconds) with a custom 429 body
  from `customErrorResponses`
- An admin route (`/admin/keys`) gated on the `X-Admin-Token` header
- Query parameter scanning: XSS payloads are blocked with a 403
  `Suspicious activity detected` response

A note on per-route `SecurityDecorator` configs: the adapter middleware does
not populate `request.state.guardRouteId` yet, so route configs registered
through decorators (for example `guard.requireHeaders(...)`) are not resolved
through the middleware at runtime. To attach per-route config to live traffic,
use the adapter-level `routeConfigs` option (or fastify's
`config.guardRouteConfig` route option), which the middleware resolves per
request; per-route detection exclusions are documented on each adapter page.
The advanced example therefore uses the engine-level `endpointRateLimits` and
an application-level header gate, which apply to every request today.

## Live smoke

`.github/workflows/live-smoke.yml` builds the Express and advanced example
images, brings up the compose stacks, and asserts real engine behavior
(benign requests pass, excluded paths bypass the pipeline, XSS query
parameters are blocked, and rate limits return 429 with the expected bodies).
