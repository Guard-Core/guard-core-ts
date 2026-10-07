import type { FastifyInstance, FastifyReply } from 'fastify';
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
import { RouteConfig as RouteConfigClass } from '@guardcore/core';
import { SecurityConfigSchema, resolveConfiguredLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { resolveAgentHandler } from './agent.js';
import type { ResolvedAgentHandler } from './agent.js';

/* The adapter guard surface (fastapi-guard middleware.py), decorated onto
   the fastify instance as `fastify.guard`: reset(), mark_initialized /
   get_initialization_status, the public refresh_cloud_ip_ranges,
   agent_stats, create_error_response and the status route. */
export interface GuardSurface {
  reset(): Promise<void>;
  markInitialized(): void;
  getInitializationStatus(): {
    initialized: boolean;
    redis: boolean;
    agent: { enabled: boolean; degraded: boolean };
  };
  refreshCloudIpRanges(): Promise<void>;
  readonly agentStats: { enabled: boolean; degraded: boolean } & Record<string, unknown>;
  createErrorResponse(statusCode: number, message: string): Promise<GuardResponse>;
  addStatusRoute(path?: string): void;
}
import fp from 'fastify-plugin';
import { FastifyGuardRequest, FastifyResponseFactory } from './adapters.js';

export interface GuardPluginOptions {
  config: SecurityConfig;
  agentHandler?: AgentHandlerProtocol;
  geoIpHandler?: GeoIPHandler;
  guardDecorator?: unknown;
  /* Per-route configs matched by method (optional) and request path: exact
     path match, or a prefix match when the path ends with `/*`. Longest path
     wins. Fastify's native per-route options work too: pass a RouteConfig as
     `config: { guardRouteConfig }` on fastify.get(...). */
  routeConfigs?: PathRouteConfigEntry[];
}

/* W3 wiring: routes registered AFTER the plugin carry their handler's
   `_guardRouteId` (stamped by the core decorator's applyRouteConfig) from the
   onRoute hook into this map, keyed like Fastify's own route identity. The
   onRequest hook copies the id onto the guard request state so the core
   RouteConfigResolver resolves decorator route configs at request time
   (mirrors the Python adapters stamping guard_route_id). */
interface GuardRouteMeta {
  routeId: string | null;
  endpointId: string | null;
}

function handlerRouteId(handler: unknown): string | null {
  const id = (handler as Record<string, unknown> | null | undefined)?.['_guardRouteId'];
  return typeof id === 'string' ? id : null;
}

function handlerEndpointId(handler: unknown): string | null {
  const name = (handler as { name?: string } | null | undefined)?.name;
  return name ? name : null;
}

/* Wrapped with fastify-plugin so the hooks land on the registering
   instance instead of an encapsulated child scope: without the wrapper the
   guard silently applied to no routes. */
export const guardPlugin = fp(async function guardPlugin(fastify: FastifyInstance, options: GuardPluginOptions): Promise<void> {
  const resolved = SecurityConfigSchema.parse(options.config);
  /* D5: logFormat / customLogFile are live - an injected config.logger
     wins, otherwise a json format or custom log file builds the logger. */
  const logger: Logger = await resolveConfiguredLogger(resolved);
  const responseFactory = new FastifyResponseFactory();

  /* Agent enablement bridge (fastapi-guard initialize block): with
     enableAgent and no injected handler the GuardAgent builds from the
     config's agent_* surface, degrading (or raising under agentStrict) on
     failure. */
  const resolvedAgent: ResolvedAgentHandler = await resolveAgentHandler(resolved, options.agentHandler, logger);
  const { agentHandler } = resolvedAgent;
  const components: SecurityMiddlewareComponents = await initializeSecurityMiddleware(
    resolved, logger, responseFactory,
    agentHandler, options.geoIpHandler, options.guardDecorator,
  );

  if (options.routeConfigs) {
    components.routeResolver.registerPathRouteConfigs(options.routeConfigs);
  }

  const routeMeta = new Map<string, GuardRouteMeta>();

  /* onRoute fires per route at registration time, when the handler function
     is still the user's - the only point where `_guardRouteId` is reachable
     (request.routeOptions never exposes the handler). */
  fastify.addHook('onRoute', (routeOptions) => {
    const handler = (routeOptions as unknown as { handler?: unknown }).handler;
    const routeId = handlerRouteId(handler);
    const endpointId = handlerEndpointId(handler);
    if (routeId === null && endpointId === null) return;
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [String(routeOptions.method)];
    for (const method of methods) {
      routeMeta.set(`${String(method).toUpperCase()}|${routeOptions.url}`, { routeId, endpointId });
    }
  });

  /* The adapter guard surface, decorated as fastify.guard. */
  const surface: GuardSurface = {
    reset: async (): Promise<void> => {
      await components.registry.rateLimitHandler.reset();
    },
    markInitialized: (): void => {},
    getInitializationStatus: () => ({
      initialized: true,
      redis: components.registry.redisHandler !== null,
      agent: { enabled: resolvedAgent.agentHandler !== null, degraded: resolvedAgent.degraded },
    }),
    refreshCloudIpRanges: async (): Promise<void> => {
      await components.middlewareProtocol.refreshCloudIpRanges();
    },
    get agentStats(): { enabled: boolean; degraded: boolean } & Record<string, unknown> {
      if (!resolvedAgent.agentHandler) {
        return { enabled: false, degraded: resolvedAgent.degraded };
      }
      const stats = (resolvedAgent.agentHandler as unknown as { getStats?: () => Record<string, unknown> }).getStats?.() ?? {};
      return { enabled: true, degraded: resolvedAgent.degraded, ...stats };
    },
    createErrorResponse: async (statusCode: number, message: string) =>
      components.errorResponseFactory.createErrorResponse(statusCode, message),
    addStatusRoute: (path = '/_guard/status'): void => {
      void (fastify as unknown as {
        get: (path: string, handler: () => Record<string, unknown>) => void;
      }).get(path, () => surface.getInitializationStatus());
    },
  };
  /* Mock instances (tests without a real fastify) skip the decoration. */
  if (typeof (fastify as unknown as { decorate?: unknown }).decorate === 'function') {
    (fastify as unknown as { decorate: (name: string, value: unknown) => void }).decorate('guard', surface);
  }

  logger.info('Guard security plugin initialized');

  fastify.addHook('onRequest', async (request, reply) => {
    const guardReq = new FastifyGuardRequest(request);

    /* W3: copy the matched handler's decorator route id onto the guard
       request state (decorator route configs resolve through it). */
    const routeOptions = request.routeOptions as unknown as {
      config?: Record<string, unknown>;
      method?: string | string[];
      url?: string;
    } | undefined;
    /* Multi-method routes declare `method` as an array at request time too;
       the incoming request matches exactly one declared method. */
    const declared = Array.isArray(routeOptions?.method)
      ? routeOptions.method
      : [routeOptions?.method ?? ''];
    const methodKey = declared.find(
      (m) => m.toUpperCase() === request.method.toUpperCase(),
    );
    const meta = routeOptions?.url && methodKey
      ? routeMeta.get(`${methodKey.toUpperCase()}|${routeOptions.url}`)
      : undefined;
    if (meta?.routeId !== null && meta?.routeId !== undefined) {
      guardReq.state.guardRouteId = meta.routeId;
    }
    if (meta?.endpointId !== null && meta?.endpointId !== undefined) {
      guardReq.state.guardEndpointId = meta.endpointId;
    }

    /* Fastify's native route-level options: a RouteConfig passed as
       `config: { guardRouteConfig }` on the route wins over every other
       route surface (reference decorator semantics). */
    const directConfig = routeOptions?.config?.['guardRouteConfig'];
    if (directConfig instanceof RouteConfigClass) {
      guardReq.state.guardRouteConfig = directConfig;
    }

    const passthrough = await components.bypassHandler.handlePassthrough(
      guardReq, async () => createPassthroughResponse(),
    );
    if (passthrough) {
      sendFastifyResponse(reply, passthrough);
      return;
    }

    const routeConfig = components.routeResolver.getRouteConfig(guardReq);

    const bypass = await components.bypassHandler.handleSecurityBypass(
      guardReq, async () => createPassthroughResponse(), routeConfig,
    );
    if (bypass) {
      sendFastifyResponse(reply, bypass);
      return;
    }

    /* Stamp for preValidation and onSend. Excluded/bypassed paths answered here
       never reach preValidation, and onSend skips responses without a stamp. */
    (request as unknown as Record<string, unknown>)['_guardRequest'] = guardReq;
    (request as unknown as Record<string, unknown>)['_guardRouteConfig'] = routeConfig;
    (request as unknown as Record<string, unknown>)['_guardStartTime'] = performance.now();
  });

  fastify.addHook('preValidation', async (request, reply) => {
    const stamped = request as unknown as Record<string, unknown>;
    const guardReq = stamped['_guardRequest'] as FastifyGuardRequest | undefined;
    const routeConfig = stamped['_guardRouteConfig'] as RouteConfig | null | undefined;
    if (!guardReq) return;

    /* Body-dependent checks (penetration scan, size/content rules) need the
       parsed body, which Fastify only exposes after its parsing stage: at
       onRequest time request.body is always undefined. Running the pipeline
       here keeps blocking ahead of validation and the handler while giving
       the engine full request visibility. Parse memory is bounded by the
       framework's bodyLimit, not by the adapter. */
    const blockResponse = await components.pipeline.execute(guardReq);
    if (blockResponse) {
      sendFastifyResponse(reply, blockResponse);
      return;
    }

    if (routeConfig && routeConfig.behaviorRules.length > 0) {
      const clientIp = guardReq.clientHost ?? 'unknown';
      await components.behavioralProcessor.processUsageRules(guardReq, clientIp, routeConfig);
    }
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const guardReq = (request as unknown as Record<string, unknown>)['_guardRequest'] as FastifyGuardRequest | undefined;
    const routeConfig = (request as unknown as Record<string, unknown>)['_guardRouteConfig'] as RouteConfig | null | undefined;
    const startTime = (request as unknown as Record<string, unknown>)['_guardStartTime'] as number | undefined;

    if (!guardReq || startTime === undefined) return payload;

    const responseTime = (performance.now() - startTime) / 1000;
    const bodyText = typeof payload === 'string' ? payload : null;
    const capturedResponse: GuardResponse = {
      statusCode: reply.statusCode,
      headers: Object.fromEntries(
        Object.entries(reply.getHeaders()).map(([k, v]) => [k, String(v)]),
      ),
      setHeader(name: string, value: string) { reply.header(name, value); },
      body: bodyText ? new TextEncoder().encode(bodyText) : null,
      bodyText,
    };

    await components.errorResponseFactory.processResponse(
      guardReq, capturedResponse, responseTime, routeConfig ?? null,
      routeConfig ? async (req: GuardRequest, res: GuardResponse, clientIp: string, rc: RouteConfig) => {
        await components.behavioralProcessor.processReturnRules(req, res, clientIp, rc);
      } : undefined,
    );

    return payload;
  });
});

function sendFastifyResponse(reply: FastifyReply, response: GuardResponse): void {
  for (const [name, value] of Object.entries(response.headers)) {
    reply.header(name, value);
  }

  if (response.headers['location']) {
    /* Preserve the engine's redirect status (spec 11: HTTPS redirects are 301);
       reply.redirect(url) alone would fall back to 302. */
    reply.redirect(response.headers['location'], response.statusCode);
    return;
  }

  reply.status(response.statusCode).send(response.bodyText ?? '');
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
