import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode, RedirectStatusCode } from 'hono/utils/http-status';
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
import { HonoGuardRequest, HonoResponseFactory } from './adapters.js';
import { resolveHonoRouteId, resolveHonoEndpointId } from './route-id.js';

export interface GuardMiddlewareOptions {
  config: SecurityConfig;
  agentHandler?: AgentHandlerProtocol;
  geoIpHandler?: GeoIPHandler;
  guardDecorator?: unknown;
  /* Per-route configs matched by method (optional) and request path: exact
     path match, or a prefix match when the path ends with `/*`. Longest path
     wins. */
  routeConfigs?: PathRouteConfigEntry[];
  /**
   * Optional hook that returns the connecting peer IP for the request.
   * Defaults to `c.env['remoteAddr']`; wire this to the runtime's connection
   * info helper (for example `getConnInfo` from the node-server adapter) when
   * the runtime does not expose the peer address through the environment.
   */
  connectingIpResolver?: (c: Context) => string | null | undefined;
}

export function createGuardMiddleware(options: GuardMiddlewareOptions): MiddlewareHandler {
  const resolved = SecurityConfigSchema.parse(options.config);
  const responseFactory = new HonoResponseFactory();

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
      const initializedComponents = await initializeSecurityMiddleware(
        resolved, logger, responseFactory,
        options.agentHandler, options.geoIpHandler, options.guardDecorator,
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

  return async (c: Context, next) => {
    await initialize();

    const startTime = performance.now();
    const connectingIp = options.connectingIpResolver
      ? options.connectingIpResolver(c) ?? null
      : (c.env as Record<string, unknown> | undefined)?.['remoteAddr'] as string | undefined ?? null;
    const guardReq = new HonoGuardRequest(c.req, connectingIp);

    /* W3 wiring: the decorated handler's `_guardRouteId` (stamped by the
       core decorator's applyRouteConfig) rides the guard request state so
       RouteConfigResolver resolves decorator route configs at request time,
       like the Python adapters stamping guard_route_id. */
    const routeId = resolveHonoRouteId(c);
    if (routeId !== null) guardReq.state.guardRouteId = routeId;
    const endpointId = resolveHonoEndpointId(c);
    if (endpointId !== null) guardReq.state.guardEndpointId = endpointId;

    const passthrough = await components.bypassHandler.handlePassthrough(
      guardReq, async () => createPassthroughResponse(),
    );
    if (passthrough) return sendHonoResponse(c, passthrough);

    const routeConfig = components.routeResolver.getRouteConfig(guardReq);

    const bypass = await components.bypassHandler.handleSecurityBypass(
      guardReq, async () => createPassthroughResponse(), routeConfig,
    );
    if (bypass) return sendHonoResponse(c, bypass);

    const blockResponse = await components.pipeline.execute(guardReq);
    if (blockResponse) return sendHonoResponse(c, blockResponse);

    if (routeConfig && routeConfig.behaviorRules.length > 0) {
      const clientIp = guardReq.clientHost ?? 'unknown';
      await components.behavioralProcessor.processUsageRules(guardReq, clientIp, routeConfig);
    }

    await next();

    const responseTime = (performance.now() - startTime) / 1000;
    const capturedResponse: GuardResponse = {
      statusCode: c.res.status,
      headers: Object.fromEntries(c.res.headers.entries()),
      setHeader(name: string, value: string) { c.res.headers.set(name, value); },
      body: null,
      /* Spec 1.4: without a bounded response-body reader, body-based behavioral
         return patterns are skipped. The response may be a live stream, so the
         body is deliberately not read here. */
      bodyText: null,
    };

    await components.errorResponseFactory.processResponse(
      guardReq, capturedResponse, responseTime, routeConfig ?? null,
      routeConfig ? async (req: GuardRequest, res: GuardResponse, clientIp: string, rc: RouteConfig) => {
        await components.behavioralProcessor.processReturnRules(req, res, clientIp, rc);
      } : undefined,
    );
  };
}

function sendHonoResponse(c: Context, response: GuardResponse): Response {
  for (const [name, value] of Object.entries(response.headers)) {
    c.header(name, value);
  }

  if (response.headers['location']) {
    return c.redirect(response.headers['location'], response.statusCode as RedirectStatusCode);
  }

  /* The engine's response factory already encoded the final body; sending it
     through c.json would wrap it in a second {detail: ...} envelope. */
  return c.body(response.bodyText ?? '', response.statusCode as ContentfulStatusCode);
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
