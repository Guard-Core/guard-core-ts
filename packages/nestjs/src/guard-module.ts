import { DynamicModule, Module, Inject, Injectable, NestMiddleware, MiddlewareConsumer } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type {
  SecurityConfig,
  GuardRequest,
  GuardResponse,
  Logger,
  AgentHandlerProtocol,
  GeoIPHandler,
  SecurityMiddlewareComponents,
  RouteConfig,
  PathRouteConfigEntry,
} from '@guardcore/core';
import { SecurityConfigSchema, resolveConfiguredLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { NestGuardRequest, NestResponseFactory } from './adapters.js';

export const GUARD_MIDDLEWARE_TOKEN = Symbol('GUARD_MIDDLEWARE_COMPONENTS');

export interface GuardModuleOptions {
  config: SecurityConfig;
  agentHandler?: AgentHandlerProtocol;
  geoIpHandler?: GeoIPHandler;
  guardDecorator?: unknown;
  /* Per-route configs matched by method (optional) and request path: exact
     path match, or a prefix match when the path ends with `/*`. Longest path
     wins. The module runs as middleware (before the route handler), so route
     configs are keyed by the Nest route path here rather than by handler
     decoration. */
  routeConfigs?: PathRouteConfigEntry[];
}

/** Upper bound on response bytes captured for behavioral return-pattern scans (spec 1.4 bounded read). */
const RESPONSE_CAPTURE_LIMIT = 10_000;

@Injectable()
export class SecurityMiddlewareNest implements NestMiddleware {
  constructor(
    @Inject(GUARD_MIDDLEWARE_TOKEN) private readonly components: SecurityMiddlewareComponents,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now();
    const guardReq = new NestGuardRequest(req);

    const passthrough = await this.components.bypassHandler.handlePassthrough(
      guardReq, async () => createPassthroughResponse(),
    );
    if (passthrough) {
      sendNestResponse(res, passthrough);
      return;
    }

    const routeConfig = this.components.routeResolver.getRouteConfig(guardReq);

    const bypass = await this.components.bypassHandler.handleSecurityBypass(
      guardReq, async () => createPassthroughResponse(), routeConfig,
    );
    if (bypass) {
      sendNestResponse(res, bypass);
      return;
    }

    const blockResponse = await this.components.pipeline.execute(guardReq);
    if (blockResponse) {
      sendNestResponse(res, blockResponse);
      return;
    }

    if (routeConfig && routeConfig.behaviorRules.length > 0) {
      const clientIp = guardReq.clientHost ?? 'unknown';
      await this.components.behavioralProcessor.processUsageRules(guardReq, clientIp, routeConfig);
    }

    (req as unknown as Record<string, unknown>)['_guardRequest'] = guardReq;
    (req as unknown as Record<string, unknown>)['_guardRouteConfig'] = routeConfig;
    (req as unknown as Record<string, unknown>)['_guardStartTime'] = startTime;

    interceptResponse(guardReq, res, startTime, this.components, routeConfig ?? null);

    next();
  }
}

@Module({})
export class GuardModule {
  static forRoot(options: GuardModuleOptions): DynamicModule {
    return {
      module: GuardModule,
      providers: [
        {
          provide: GUARD_MIDDLEWARE_TOKEN,
          useFactory: async () => {
            const resolved = SecurityConfigSchema.parse(options.config);
            /* D5: logFormat / customLogFile are live - an injected
               config.logger wins, otherwise a json format or custom log file
               builds the logger. */
            const logger: Logger = await resolveConfiguredLogger(resolved);
            const responseFactory = new NestResponseFactory();
            const components = await initializeSecurityMiddleware(
              resolved, logger, responseFactory,
              options.agentHandler, options.geoIpHandler, options.guardDecorator,
            );
            if (options.routeConfigs) {
              components.routeResolver.registerPathRouteConfigs(options.routeConfigs);
            }
            logger.info('Guard security module initialized');
            return components;
          },
        },
        SecurityMiddlewareNest,
      ],
      exports: [SecurityMiddlewareNest, GUARD_MIDDLEWARE_TOKEN],
      global: true,
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityMiddlewareNest).forRoutes('*');
  }
}

function interceptResponse(
  guardReq: NestGuardRequest,
  res: Response,
  startTime: number,
  components: SecurityMiddlewareComponents,
  routeConfig: RouteConfig | null,
): void {
  const originalEnd = res.end;
  const originalWrite = res.write;
  const chunks: Buffer[] = [];
  let capturedBytes = 0;

  const capture = (chunk: unknown): void => {
    if (capturedBytes >= RESPONSE_CAPTURE_LIMIT) return;
    let data: Buffer | null = null;
    if (typeof chunk === 'string') data = Buffer.from(chunk, 'utf-8');
    else if (Buffer.isBuffer(chunk)) data = chunk;
    else if (ArrayBuffer.isView(chunk) && !(chunk instanceof DataView)) {
      data = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    }
    if (!data || data.length === 0) return;
    const remaining = RESPONSE_CAPTURE_LIMIT - capturedBytes;
    chunks.push(remaining < data.length ? data.subarray(0, remaining) : data);
    capturedBytes += Math.min(data.length, remaining);
  };

  res.write = function (chunk: unknown, ...args: unknown[]): boolean {
    capture(chunk);
    return (originalWrite as (...writeArgs: unknown[]) => boolean).apply(res, [chunk, ...args]);
  } as typeof res.write;

  res.end = function (chunk?: unknown, ...args: unknown[]): Response {
    capture(chunk);

    const responseTime = (performance.now() - startTime) / 1000;
    const body = Buffer.concat(chunks);
    const capturedResponse: GuardResponse = {
      statusCode: res.statusCode,
      headers: Object.fromEntries(
        Object.entries(res.getHeaders()).map(([k, v]) => [k, String(v)]),
      ),
      setHeader(name: string, value: string) { res.setHeader(name, value); },
      body: new Uint8Array(body),
      bodyText: body.toString('utf-8'),
    };

    const endArgs = chunk === undefined && args.length === 0 ? [] : [chunk, ...args];
    const finish = (): void => {
      (originalEnd as (...endArgs: unknown[]) => Response).apply(res, endArgs);
    };

    /* Header mutations must complete before the response ends, or they are lost
       (headers are flushed by the original end call). */
    components.errorResponseFactory.processResponse(
      guardReq, capturedResponse, responseTime, routeConfig,
      routeConfig ? async (request: GuardRequest, response: GuardResponse, clientIp: string, rc: RouteConfig) => {
        await components.behavioralProcessor.processReturnRules(request, response, clientIp, rc);
      } : undefined,
    ).then(finish, finish);

    return res;
  } as unknown as typeof res.end;
}

function sendNestResponse(res: Response, response: GuardResponse): void {
  for (const [name, value] of Object.entries(response.headers)) {
    res.setHeader(name, value);
  }
  if (response.headers['location']) {
    res.redirect(response.statusCode, response.headers['location']);
    return;
  }
  /* The engine's response factory already encoded the final body; sending it
     through res.json({detail: ...}) would wrap it in a second envelope. */
  res.status(response.statusCode);
  if (response.body) {
    res.send(Buffer.from(response.body));
  } else {
    res.send(response.bodyText ?? '');
  }
}

function createPassthroughResponse(): GuardResponse {
  /* Passthrough responses never carry headers; the noop only satisfies the
     GuardResponse interface. */
  return {
    statusCode: 200,
    headers: {},
    /* v8 ignore next */
    setHeader() {},
    body: null,
    bodyText: null,
  };
}
