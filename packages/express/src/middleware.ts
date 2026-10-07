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
import { ExpressGuardRequest, ExpressResponseFactory, sendGuardResponse } from './adapters.js';
import { resolveExpressRouteId, resolveExpressEndpointId } from './route-id.js';
import { resolveAgentHandler } from './agent.js';

export interface SecurityMiddlewareOptions {
  config: SecurityConfig;
  agentHandler?: AgentHandlerProtocol;
  geoIpHandler?: GeoIPHandler;
  guardDecorator?: unknown;
  /* Per-route configs matched by method (optional) and request path, the
     Express idiom for route-level options: exact path match, or a prefix
     match when the path ends with `/*`. Longest path wins. */
  routeConfigs?: PathRouteConfigEntry[];
}

/** Upper bound on response bytes captured for behavioral return-pattern scans (spec 1.4 bounded read). */
const RESPONSE_CAPTURE_LIMIT = 10_000;

export function createSecurityMiddleware(options: SecurityMiddlewareOptions) {
  const resolved = SecurityConfigSchema.parse(options.config);
  const responseFactory = new ExpressResponseFactory();

  let initialized = false;
  let initPromise: Promise<void> | null = null;
  let components: SecurityMiddlewareComponents;
  let logger: Logger;

  function initialize(): Promise<void> {
    if (initialized) return Promise.resolve();
    /* Single-flight: concurrent first requests share one initialization. */
    initPromise ??= (async () => {
      /* D5: logFormat / customLogFile are live - an injected config.logger
         wins, otherwise a json format or custom log file builds the logger. */
      logger = await resolveConfiguredLogger(resolved);
      /* Agent enablement bridge (fastapi-guard initialize block): with
         enableAgent and no injected handler the GuardAgent builds from the
         config's agent_* surface, degrading (or raising under agentStrict)
         on failure. */
      const { agentHandler } = await resolveAgentHandler(resolved, options.agentHandler, logger);
      const initializedComponents = await initializeSecurityMiddleware(
        resolved, logger, responseFactory,
        agentHandler, options.geoIpHandler, options.guardDecorator,
      );
      components = initializedComponents;
      if (options.routeConfigs) {
        components.routeResolver.registerPathRouteConfigs(options.routeConfigs);
      }
      initialized = true;
      logger.info('Guard security middleware initialized');
    })()
      .catch((error: unknown) => {
        /* Allow a retry on the next request instead of caching the failure. */
        initPromise = null;
        throw error;
      });
    return initPromise;
  }

  return async function guardMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await initialize();

      const startTime = performance.now();
      const guardReq = new ExpressGuardRequest(req);

      /* W3 wiring: the decorated handler's `_guardRouteId` (stamped by the
         core decorator's applyRouteConfig) rides the guard request state so
         RouteConfigResolver resolves decorator route configs at request time,
         like the Python adapters stamping guard_route_id. */
      const routeId = resolveExpressRouteId(req);
      if (routeId !== null) guardReq.state.guardRouteId = routeId;
      const endpointId = resolveExpressEndpointId(req);
      if (endpointId !== null) guardReq.state.guardEndpointId = endpointId;

      const passthrough = await components.bypassHandler.handlePassthrough(
        guardReq,
        async () => createPassthroughResponse(),
      );
      if (passthrough) {
        sendGuardResponse(res, passthrough);
        return;
      }

      const routeConfig = components.routeResolver.getRouteConfig(guardReq);

      const bypass = await components.bypassHandler.handleSecurityBypass(
        guardReq,
        async () => createPassthroughResponse(),
        routeConfig,
      );
      if (bypass) {
        sendGuardResponse(res, bypass);
        return;
      }

      const blockResponse = await components.pipeline.execute(guardReq);
      if (blockResponse) {
        sendGuardResponse(res, blockResponse);
        return;
      }

      if (routeConfig && routeConfig.behaviorRules.length > 0) {
        const clientIp = guardReq.clientHost ?? 'unknown';
        await components.behavioralProcessor.processUsageRules(guardReq, clientIp, routeConfig);
      }

      interceptResponse(guardReq, res, startTime, components, routeConfig ?? null);

      next();
    } catch (error) {
      /* Fail secure: forward to the framework error path (500) instead of leaving
         the request hanging on an unhandled rejection (Express 4 does not route
         async middleware rejections to error handlers on its own). */
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

function interceptResponse(
  guardReq: ExpressGuardRequest,
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
