---
title: "NestJS Adapter"
description: "Using @guardcore/nestjs with GuardModule.forRoot(), SecurityMiddlewareNest, and dependency injection"
---

`@guardcore/nestjs` provides a NestJS dynamic module with DI-integrated security middleware.

## Installation

```bash
pnpm add @guardcore/nestjs
```

## API

### `GuardModule.forRoot(options)`

Creates a global dynamic module that initializes the security engine and provides it via dependency injection.

```typescript
import { GuardModule } from '@guardcore/nestjs';

@Module({
  imports: [
    GuardModule.forRoot({
      config: { /* SecurityConfig */ },
    }),
  ],
})
class AppModule {}
```

**Options**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `config` | `SecurityConfig` | Yes | Security configuration |
| `agentHandler` | `AgentHandlerProtocol` | No | Telemetry agent |
| `geoIpHandler` | `GeoIPHandler` | No | GeoIP handler for country filtering |
| `guardDecorator` | `SecurityDecorator` | No | Decorator instance for per-route config |
| `routeConfigs` | `PathRouteConfigEntry[]` | No | Per-route configs matched by method (optional) and Nest route path: exact match, or prefix when the path ends with `/*`. Longest path wins |

### `SecurityMiddlewareNest`

An `@Injectable()` NestJS middleware that receives `SecurityMiddlewareComponents` via the `GUARD_MIDDLEWARE_TOKEN` injection token.

The `GuardModule` automatically applies this middleware to all routes via its `configure()` method.

### `GUARD_MIDDLEWARE_TOKEN`

A `Symbol` injection token for the `SecurityMiddlewareComponents` object. Use this to access the handler registry, pipeline, or other components from your own services:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { GUARD_MIDDLEWARE_TOKEN } from '@guardcore/nestjs';
import type { SecurityMiddlewareComponents } from '@guardcore/core';

@Injectable()
export class SecurityService {
  constructor(
    @Inject(GUARD_MIDDLEWARE_TOKEN)
    private readonly components: SecurityMiddlewareComponents,
  ) {}

  async banIp(ip: string): Promise<void> {
    await this.components.registry.ipBanHandler.banIp(ip, 3600, 'Manual ban');
  }
}
```

## DI Architecture

```
GuardModule.forRoot(options)
  ├── GUARD_MIDDLEWARE_TOKEN (useFactory → initializeSecurityMiddleware)
  ├── SecurityMiddlewareNest (injects GUARD_MIDDLEWARE_TOKEN)
  └── configure(consumer) → consumer.apply(SecurityMiddlewareNest).forRoutes('*')
```

The module is registered as `global: true`, so `GUARD_MIDDLEWARE_TOKEN` and `SecurityMiddlewareNest` are available throughout the application without re-importing the module.

## Full Example

```typescript
import { Module, Controller, Get, Post, Body } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  GuardModule,
  SecurityDecorator,
  SecurityConfigSchema,
} from '@guardcore/nestjs';

const config = SecurityConfigSchema.parse({
  enableRedis: false,
  rateLimit: 100,
  rateLimitWindow: 60,
  enablePenetrationDetection: true,
  excludePaths: ['/health'],
});

const guard = new SecurityDecorator(config);

@Controller()
class AppController {
  @Get('/health')
  health() {
    return { status: 'ok' };
  }

  @Post('/api/data')
  createData(@Body() body: unknown) {
    return { received: true };
  }
}

@Module({
  imports: [
    GuardModule.forRoot({
      config,
      guardDecorator: guard,
    }),
  ],
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

## Request State

The middleware stores guard state on the Express request object for potential use in response processing:

- `req._guardRequest` -- The `NestGuardRequest` instance
- `req._guardRouteConfig` -- The resolved `RouteConfig` (if any)
- `req._guardStartTime` -- Request start timestamp for response time calculation

### Per-route detection exclusions

```typescript
GuardModule.forRoot({
  config,
  routeConfigs: [{ path: '/api/search', config: openConfig }],
});
```
