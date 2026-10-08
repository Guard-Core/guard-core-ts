# AGENTS.md
Guidance for AI agents (including Claude Code) working in this repository.

## Project Overview

guardcore-ts is the TypeScript implementation of guard-core, the framework-agnostic security middleware engine (npm scope `@guardcore`). All shared security logic lives in `@guardcore/core` (packages/core). Four adapter packages wire the engine into specific frameworks. Every package in the repo is at version 1.0.0.

- Root package: `guardcore-ts` 1.0.0 (private, never published)
- Published packages: `@guardcore/core`, `@guardcore/express`, `@guardcore/fastify`, `@guardcore/hono`, `@guardcore/nestjs` (all 1.0.0, MIT)
- Node >= 18 (CI tests 18, 20, and 22), TypeScript ~5.9 in strict mode
- pnpm 10 workspaces (packageManager pnpm@10.25.0) orchestrated by Turborepo
- Targets ES2022; builds dual ESM + CJS output with tsup

What `@guardcore/core` provides:

- IP control: whitelist/blacklist of IPs and CIDR ranges (ipaddr.js), auto-ban on suspicious activity (IPBanManager)
- Rate limiting: global, per-endpoint, and geo-based limits; Redis sliding window executed atomically through a Lua script (evalsha with eval fallback) or an in-memory fallback (RateLimitManager)
- Penetration detection: the 157-row spec 4.1.0 pattern table (SusPatternsManager) plus semantic analysis (attack probability, entropy, obfuscation, code injection scoring) in the detection engine
- Security headers: SecurityHeadersManager (HSTS, CSP, frame options, and related defaults)
- Behavioral analysis: BehaviorTracker usage monitoring and return-pattern tracking with ban/throttle/alert actions
- Cloud provider blocking: AWS, GCP, and Azure IP ranges with cached refresh (CloudHandler)
- Country filtering via GeoIP lookups (optional maxmind peer)
- HTTPS enforcement, request logging, emergency mode, required headers, referrer and user-agent rules, custom validators, bypass handling
- Decorator system: BaseSecurityDecorator composed with 6 mixins (AccessControl, RateLimiting, Authentication, ContentFiltering, Behavioral, Advanced) into SecurityDecorator with 25 route-level decorator methods
- Edge runtime support: protocol types use Uint8Array, core has no Node-only APIs, and Redis/maxmind/re2-wasm are optional peers that degrade gracefully when absent

## Ecosystem Position

```
@guardcore/core (packages/core)           Engine: all security logic lives here
|- @guardcore/express (packages/express)  Express middleware adapter (peer: express ^4 || ^5, cors ^2 optional)
|- @guardcore/fastify (packages/fastify)  Fastify plugin adapter (peer: fastify ^5, @fastify/cors ^9 optional)
|- @guardcore/nestjs  (packages/nestjs)   NestJS middleware + GuardModule.forRoot (peers: @nestjs/common ^11, @nestjs/core ^11, reflect-metadata ^0.1 || ^0.2)
|- @guardcore/hono    (packages/hono)     Hono middleware adapter, edge-safe (peer: hono ^4)
```

- Adapters depend on core with `@guardcore/core: workspace:*`, so core must be built before adapters (turbo enforces this with `dependsOn: ["^build"]`)
- This repo ports guard-core (https://github.com/Guard-Core/guard-core), the Python engine; when in doubt about intended behavior, the Python project is the upstream reference
- Publishing is lock-step: all packages carry the same version, bumped together with `make bump-version VERSION=x.y.z`; a GitHub Release triggers .github/workflows/release.yml, which publishes each package to npm with provenance

## Boundary Rules

- `packages/core` MUST NOT import Express, Fastify, Hono, NestJS, or any web framework. Verified: no framework imports exist anywhere under packages/core/src
- Framework adapter packages MUST NOT contain security logic. They contain no detection, rate limiting, IP ban, or header logic; they adapt native request/response types and call into core
- Adapters wire framework types to core: each exposes an adapters.ts that implements `GuardRequest` and a `GuardResponseFactory` for its framework (ExpressGuardRequest, FastifyGuardRequest, HonoGuardRequest, NestGuardRequest plus the matching response factories), then calls core's `initializeSecurityMiddleware`
- Adapters re-export core symbols (SecurityConfigSchema, SecurityDecorator, defaultLogger, and core types) for consumer convenience; they add no security behavior of their own
- IP extraction is delegated to core's `extractClientIp`: adapters supply `request.clientHost` (the connecting socket address) and core handles X-Forwarded-For, trusted proxies, and spoofing detection
- Core protocol types MUST use Uint8Array for binary data, never Buffer, so the engine runs on edge runtimes (Cloudflare Workers, Deno, Vercel Edge)
- New security logic belongs in core; adapter packages only grow framework wiring (hooks, middleware registration, DI modules)
- NEVER git-add node_modules, dist output, or .turbo cache directories

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

Redis is required for the full integration test run; CI provisions a redis:7-alpine service and exposes it as REDIS_URL. See CONTRIBUTING.md prerequisites (Node.js 18+, pnpm 10+, Redis for integration tests).

## Development Commands

Root scripts (package.json, executed through turbo):

- `pnpm build` - build all packages (turbo run build, respects dependency order and caches dist/**)
- `pnpm test` - test all packages (turbo run test, depends on builds)
- `pnpm lint` - type-check all packages (turbo run lint; each package runs tsc --noEmit)
- `pnpm clean` - remove build artifacts

Package-level commands (filter examples):

- `pnpm --filter @guardcore/core build` - build core only (tsup)
- `pnpm --filter @guardcore/core test` - run core tests (vitest run)
- `pnpm --filter @guardcore/core test:watch` - vitest watch mode (defined in packages/core only)
- `pnpm --filter @guardcore/core lint` - tsc --noEmit for core
- `pnpm --filter @guardcore/core clean` - rm -rf dist

Makefile targets (verified in ./Makefile):

- `make install` - pnpm install
- `make build` / `make clean` / `make lint` - wrappers around the root scripts
- `make test` - core tests only (pnpm --filter @guardcore/core test)
- `make test-all` - all packages (pnpm test)
- `make test-coverage` - core tests with v8 coverage (npx vitest run --coverage in packages/core)
- `make typecheck` - alias for lint
- `make build-core` / `make build-express` / `make build-fastify` / `make build-nestjs` / `make build-hono` - build one adapter or core
- `make bump-version VERSION=x.y.z` - bump all package versions via .github/scripts/bump-version.mjs (fails without VERSION)
- `make prune` - delete node_modules, dist, and .turbo directories
- `make serve-docs` / `make build-docs` - run the Astro docs site in docs/ (astro dev / astro build)
- `make stop` / `make restart` - docker compose down / up -d (compose.yml)

CI runs (verified in .github/workflows/ci.yml): pnpm install --frozen-lockfile, pnpm build, pnpm lint on node 22, and pnpm test on a node 18/20/22 matrix with a redis service (REDIS_URL=redis://localhost:6379).

## Project Structure

```
guardcore-ts/
|- packages/
|  |- core/                           @guardcore/core
|  |  |- src/
|  |  |  |- protocols/                GuardRequest, GuardResponse, GuardResponseFactory,
|  |  |  |                            GuardMiddlewareProtocol, GeoIPHandler,
|  |  |  |                            AgentHandlerProtocol, RedisHandlerProtocol
|  |  |  |- models/                   SecurityConfigSchema (config.ts), RouteConfig,
|  |  |  |                            BehaviorRule, DynamicRulesSchema, Logger/defaultLogger
|  |  |  |- handlers/                 RedisManager, IPBanManager, RateLimitManager, CloudHandler,
|  |  |  |                            SusPatternsManager, SecurityHeadersManager, BehaviorTracker,
|  |  |  |                            DynamicRuleManager, IPInfoManager, HandlerRegistry
|  |  |  |- detection-engine/         PatternCompiler, ContentPreprocessor, SemanticAnalyzer,
|  |  |  |                            PerformanceMonitor
|  |  |  |- core/                     check pipeline and 17 check implementations, event bus,
|  |  |  |                            metrics, handler initialization, routing, validation,
|  |  |  |                            bypass, behavioral processor, error response factory
|  |  |  |- decorators/               BaseSecurityDecorator + 6 mixins -> SecurityDecorator
|  |  |  |- middleware-support.ts     initializeSecurityMiddleware entry point
|  |  |  |- utils.ts                  extractClientIp, detectPenetrationAttempt, and friends
|  |  |  |- index.ts                  public API (the only intended export surface)
|  |  |- tests/                       vitest suites (see Testing & Conformance)
|  |  |- vitest.config.ts             coverage thresholds
|  |- express/                        @guardcore/express (createSecurityMiddleware, guardBodyParser)
|  |- fastify/                        @guardcore/fastify (guardPlugin)
|  |- hono/                           @guardcore/hono (createGuardMiddleware, edge-safe)
|  |- nestjs/                         @guardcore/nestjs (GuardModule.forRoot, SecurityMiddlewareNest)
|- docs/                              Astro + Starlight documentation site (own package-lock.json)
|- examples/                          runnable apps: express, fastify, hono, nestjs
|- fixtures/                          currently an empty placeholder on master
|- .github/scripts/bump-version.mjs   used by make bump-version
|- .github/workflows/                 ci.yml, codeql.yml, release.yml, docs.yml, scheduled-lint.yml, ...
|- compose.yml, Dockerfile, Makefile, turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

## Technology Stack

Core runtime dependencies (packages/core/package.json):

- zod ^4.3 - schema validation for SecurityConfigSchema (replaces Python's Pydantic), including cross-field superRefine validators
- ipaddr.js ^2.2 - IP and CIDR parsing/matching

Optional peer dependencies of core (all marked optional; install only the features you use):

- ioredis ^5 - distributed state (rate limits, bans, cloud ranges, custom patterns)
- re2-wasm ^1 - linear-time regex engine (ReDoS-safe) used by PatternCompiler when present
- lru-cache ^11 - TTL in-memory caching
- maxmind ^4 - GeoIP database reader
- he ^1 - HTML entity decoding in ContentPreprocessor
- acorn ^8 - JS AST parsing used by SemanticAnalyzer for code injection risk scoring

Framework peer dependencies: express ^4 || ^5 (+cors ^2 optional), fastify ^5 (+@fastify/cors ^9 optional), hono ^4, @nestjs/common ^11 + @nestjs/core ^11 (+reflect-metadata ^0.1 || ^0.2).

Toolchain:

- pnpm 10 (workspaces), turbo ^2 (task graph: build depends on ^build and caches dist/**; test depends on ^build; clean uncached)
- typescript ~5.9, tsconfig.base.json: target ES2022, module ESNext, moduleResolution bundler, strict, exactOptionalPropertyTypes, declaration + declarationMap, isolatedModules
- tsup ^8 - dual ESM/CJS builds (dist/index.js, dist/index.cjs, dist/index.d.ts)
- vitest ^4 + @vitest/coverage-v8 - test runner and coverage
- Node >= 18 (engines field on every package; CI matrix 18/20/22)

## Testing & Conformance

Framework: vitest with globals enabled (packages/core/vitest.config.ts).

Test layout on master (packages/core/tests):

- test-core/ - pipeline, checks, events, initialization, routing, validation, bypass, behavioral, responses, middleware-support
- test-decorators/ - decorator behavior
- test-detection-engine/ - compiler, preprocessor, semantic, monitor
- test-handlers/ - one suite per handler (rate-limit, ip-ban, cloud, geoip, redis, security-headers, sus-patterns, behavior, dynamic-rules)
- test-models/ - config, route-config, behavior-rule, dynamic-rules, logger
- test-utils/ - utils
- helpers.ts - createTestConfig (SecurityConfigSchema.parse), createMockRequest (GuardRequest fixture), createMockResponse (GuardResponse fixture)

Conventions:

- 1.0.0 shipped 681 tests across 31 test files with 100% statement/line coverage (CHANGELOG.md)
- Coverage thresholds in packages/core/vitest.config.ts: statements 100, lines 100, functions 99, branches 96; src/index.ts, other index.ts files, src/protocols/**, and src/handlers/registry.ts are excluded from coverage
- New code needs vitest tests; coverage must not drop (CONTRIBUTING.md)
- CI (.github/workflows/ci.yml) runs lint, build, and test jobs; the test job uses a node 18/20/22 matrix and a redis:7-alpine service; .github/workflows/scheduled-lint.yml reruns lint and tests weekly; CodeQL scans via codeql.yml

Conformance status (be precise in docs and PRs):

- The spec 4.1.0 conformance runner lives in packages/core/tests/conformance and runs against the vendored spec 4.1.0 corpus (conformance/guard-core-spec-4.1.0, 219 cases) with a fail-closed baseline; CI gates it via `pnpm --filter @guardcore/core exec vitest run tests/conformance`

Known CI state: master CI is green (build, lint, test, conformance, and dependency-audit jobs).

## Code Quality Standards

From tsconfig.base.json and CONTRIBUTING.md (both enforced by CI):

- TypeScript strict mode is mandatory; `tsc --noEmit` must pass cleanly in every package
- No `any`. Use `unknown` with type guards or generics. The two sanctioned exceptions in the codebase are the decorator mixin composition and its eslint-disable pragma
- No `@ts-ignore` or `@ts-expect-error`
- No explanatory comments; code should be self-explanatory (CONTRIBUTING.md). The only comments present are coverage pragmas (v8 ignore) and tool directives
- exactOptionalPropertyTypes is on: optional properties do not implicitly include undefined; assign undefined explicitly when a protocol field must be cleared
- Imports use the .js extension on relative paths (ESM compatibility), for example `./models/logger.js`
- Named exports only; no default exports in library code
- camelCase for variables/functions, PascalCase for types/classes, kebab-case file names (rate-limit.ts, event-bus.ts, handler-initializer.ts)
- Classes are for behavior (handlers, checks, managers); data shapes are interfaces or Zod schemas
- Prefer Readonly collections for immutable data; use discriminated unions over string tags plus casts

## Development Workflow

1. Fork/branch from master; keep branches short-lived and focused
2. `pnpm install`, then iterate inside the package you are changing
3. Before every push: `pnpm build` then `pnpm lint` then `pnpm test`; for core changes also `make test-coverage` and confirm thresholds still pass
4. PR requirements (CONTRIBUTING.md): tests written, all tests pass, tsc --noEmit clean, 100% statement coverage maintained, no any, no comments
5. Version bumps: `make bump-version VERSION=x.y.z`, update CHANGELOG.md, open a PR
6. Releases: after the version bump merges, create a GitHub Release with tag vx.y.z; release.yml publishes all packages to npm with provenance
7. Docs site changes go under docs/ and deploy via docs.yml on pushes to master touching docs/ or packages/

## Best Practices

- All I/O is async; never block the event loop. Regex execution goes through PatternCompiler (re2-wasm when available) rather than unbounded native RegExp on untrusted input
- Security check errors are caught and logged by SecurityCheckPipeline, which then continues to the next check; the first check returning a non-null GuardResponse wins and short-circuits the rest
- Never throw from telemetry: sendAgentEvent swallows agent handler errors by design; follow the same pattern for event dispatch
- Sanitize anything logged with sanitizeForLog; never log raw secrets or unsanitized attacker input
- Use Redis Lua scripts (existing pattern in RateLimitManager) for atomic multi-step Redis operations instead of read-then-write races
- Treat the 75 pattern definitions and their context sets as security-critical: they mirror the Python upstream, so do not modify regex strings without cross-validating behavior against the upstream project
- Respect trusted-proxy rules in extractClientIp: X-Forwarded-For is ignored (and raises a suspicious_request agent event) unless the peer is in config.trustedProxies
- No global singletons: HandlerInitializer builds a fresh HandlerRegistry per middleware instance; tests create fresh registries per case
- Keep the public API surface in packages/core/src/index.ts deliberate; do not barrel-re-export internals
- Never commit node_modules, dist, or .turbo; `make prune` clears them locally

## Related Projects

- guard-core (https://github.com/Guard-Core/guard-core) - the Python engine this repo ports; upstream reference for behavior and patterns
- In-repo adapters: @guardcore/express, @guardcore/fastify, @guardcore/hono, @guardcore/nestjs (each under packages/ with its own tests and examples/ apps)
- examples/ contains a runnable app per adapter showing configuration with SecurityConfigSchema.parse
