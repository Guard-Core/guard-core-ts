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
import { SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware } from '@guardcore/core';
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

/* Wrapped with fastify-plugin so the hooks land on the registering
   instance instead of an encapsulated child scope: without the wrapper the
   guard silently applied to no routes. */
export const guardPlugin = fp(async function guardPlugin(fastify: FastifyInstance, options: GuardPluginOptions): Promise<void> {
  const resolved = SecurityConfigSchema.parse(options.config);
  const logger: Logger = resolved.logger ?? defaultLogger;
  const responseFactory = new FastifyResponseFactory();

  const components: SecurityMiddlewareComponents = await initializeSecurityMiddleware(
    resolved, logger, responseFactory,
    options.agentHandler, options.geoIpHandler, options.guardDecorator,
  );

  if (options.routeConfigs) {
    components.routeResolver.registerPathRouteConfigs(options.routeConfigs);
  }

  logger.info('Guard security plugin initialized');

  fastify.addHook('onRequest', async (request, reply) => {
    const guardReq = new FastifyGuardRequest(request);

    /* Fastify's native route-level options: a RouteConfig passed as
       `config: { guardRouteConfig }` on the route wins over every other
       route surface (reference decorator semantics). */
    const routeOptionsConfig = (request.routeOptions as unknown as { config?: Record<string, unknown> } | undefined)?.config;
    const directConfig = routeOptionsConfig?.['guardRouteConfig'];
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
  return { statusCode: 200, headers: {}, setHeader() {}, body: null, bodyText: null };
}
