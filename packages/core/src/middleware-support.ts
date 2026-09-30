import type { Logger } from './models/logger.js';
import type { ResolvedSecurityConfig } from './models/config.js';
import type { AgentHandlerProtocol } from './protocols/agent.js';
import type { GeoIPHandler } from './protocols/geo-ip.js';
import type { GuardMiddlewareProtocol } from './protocols/middleware.js';
import type { GuardRequest } from './protocols/request.js';
import type { GuardResponse, GuardResponseFactory } from './protocols/response.js';
import type { RouteConfig } from './models/route-config.js';

import { SecurityEventBus } from './core/events/event-bus.js';
import { MetricsCollector } from './core/events/metrics.js';
import { HandlerInitializer } from './core/initialization/handler-initializer.js';
import type { HandlerRegistry } from './core/initialization/handler-initializer.js';
import { RequestValidator } from './core/validation/validator.js';
import { RouteConfigResolver } from './core/routing/resolver.js';
import { BypassHandler } from './core/bypass/handler.js';
import { ErrorResponseFactory } from './core/responses/factory.js';
import { BehavioralProcessor } from './core/behavioral/processor.js';
import { BehaviorTracker } from './handlers/behavior.js';
import { SecurityCheckPipeline } from './core/checks/pipeline.js';

import { RouteConfigCheck } from './core/checks/implementations/route-config.js';
import { EmergencyModeCheck } from './core/checks/implementations/emergency-mode.js';
import { HttpsEnforcementCheck } from './core/checks/implementations/https-enforcement.js';
import { RequestLoggingCheck } from './core/checks/implementations/request-logging.js';
import { RequestSizeContentCheck } from './core/checks/implementations/request-size-content.js';
import { RequiredHeadersCheck } from './core/checks/implementations/required-headers.js';
import { AuthenticationCheck } from './core/checks/implementations/authentication.js';
import { ReferrerCheck } from './core/checks/implementations/referrer.js';
import { CustomValidatorsCheck } from './core/checks/implementations/custom-validators.js';
import { TimeWindowCheck } from './core/checks/implementations/time-window.js';
import { CloudIpRefreshCheck } from './core/checks/implementations/cloud-ip-refresh.js';
import { IpSecurityCheck } from './core/checks/implementations/ip-security.js';
import { CloudProviderCheck } from './core/checks/implementations/cloud-provider.js';
import { UserAgentCheck } from './core/checks/implementations/user-agent.js';
import { RateLimitCheck } from './core/checks/implementations/rate-limit.js';
import { SuspiciousActivityCheck } from './core/checks/implementations/suspicious-activity.js';
import { CustomRequestCheck } from './core/checks/implementations/custom-request.js';

export interface SecurityMiddlewareComponents {
  registry: HandlerRegistry;
  pipeline: SecurityCheckPipeline;
  eventBus: SecurityEventBus;
  metricsCollector: MetricsCollector;
  validator: RequestValidator;
  routeResolver: RouteConfigResolver;
  bypassHandler: BypassHandler;
  errorResponseFactory: ErrorResponseFactory;
  behavioralProcessor: BehavioralProcessor;
  middlewareProtocol: GuardMiddlewareProtocol;
}

export async function initializeSecurityMiddleware(
  config: ResolvedSecurityConfig,
  logger: Logger,
  guardResponseFactory: GuardResponseFactory,
  agentHandler?: AgentHandlerProtocol | null,
  geoIpHandler?: GeoIPHandler | null,
  guardDecorator?: unknown,
): Promise<SecurityMiddlewareComponents> {
  const initializer = new HandlerInitializer(
    config, logger, agentHandler ?? null, geoIpHandler ?? null, guardDecorator ?? null,
  );
  const registry = await initializer.initialize();

  const eventBus = new SecurityEventBus(
    agentHandler ?? null, config, logger, registry.geoIpHandler,
  );
  const metricsCollector = new MetricsCollector(
    agentHandler ?? null, config, logger,
  );
  const validator = new RequestValidator(config, logger, eventBus);
  const routeResolver = new RouteConfigResolver(config);
  if (guardDecorator) routeResolver.setGuardDecorator(guardDecorator);

  const errorResponseFactory = new ErrorResponseFactory(
    config, logger, metricsCollector, guardResponseFactory,
    registry.securityHeadersHandler, agentHandler ?? null,
  );
  const bypassHandler = new BypassHandler(
    config, eventBus, routeResolver, errorResponseFactory, validator,
  );
  const behavioralProcessor = new BehavioralProcessor(logger, eventBus);
  /* The engine-owned tracker backs the global behavior rules (and route
     rules on pipelines without a decorator); the decorator's tracker wins
     when one is present, matching the reference resolution order. */
  const behaviorTracker = new BehaviorTracker(config, logger);
  if (registry.ipBanHandler) behaviorTracker.initializeIpBan(registry.ipBanHandler);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (registry.redisHandler) await behaviorTracker.initializeRedis(registry.redisHandler);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  if (agentHandler) await behaviorTracker.initializeAgent(agentHandler);
  behavioralProcessor.setDefaultTracker(behaviorTracker);
  errorResponseFactory.setBehavioralProcessor(behavioralProcessor);
  behavioralProcessor.setSuspiciousCountsReader(() => middlewareProtocol.suspiciousRequestCounts);
  if (guardDecorator) {
    behavioralProcessor.setGuardDecorator(
      guardDecorator as { behaviorTracker: BehaviorTracker },
    );
  }

  const middlewareProtocol: GuardMiddlewareProtocol = {
    get config() { return config; },
    get logger() { return logger; },
    lastCloudIpRefresh: 0,
    suspiciousRequestCounts: new Map(),
    get eventBus() { return eventBus; },
    get routeResolver() { return routeResolver; },
    get responseFactory() { return errorResponseFactory; },
    get rateLimitHandler() { return registry.rateLimitHandler; },
    get agentHandler() { return agentHandler ?? null; },
    get geoIpHandler() { return registry.geoIpHandler ?? null; },
    get guardResponseFactory() { return guardResponseFactory; },
    async createErrorResponse(statusCode: number, message: string) {
      return errorResponseFactory.createErrorResponse(statusCode, message);
    },
    async refreshCloudIpRanges() {
      if (registry.cloudHandler && config.blockCloudProviders.size > 0) {
        await registry.cloudHandler.refreshAsync(config.blockCloudProviders);
      }
    },
  };

  const pipeline = new SecurityCheckPipeline([
    new RouteConfigCheck(middlewareProtocol),
    new EmergencyModeCheck(middlewareProtocol),
    new HttpsEnforcementCheck(middlewareProtocol, validator, errorResponseFactory),
    new RequestLoggingCheck(middlewareProtocol),
    new RequestSizeContentCheck(middlewareProtocol),
    new RequiredHeadersCheck(middlewareProtocol),
    new AuthenticationCheck(middlewareProtocol),
    new ReferrerCheck(middlewareProtocol),
    new CustomValidatorsCheck(middlewareProtocol),
    new TimeWindowCheck(middlewareProtocol, validator),
    new CloudIpRefreshCheck(middlewareProtocol),
    new IpSecurityCheck(middlewareProtocol, registry.ipBanHandler),
    new CloudProviderCheck(middlewareProtocol, registry.cloudHandler),
    new UserAgentCheck(middlewareProtocol),
    new RateLimitCheck(middlewareProtocol, registry.ipBanHandler),
    new SuspiciousActivityCheck(middlewareProtocol, registry.susPatternsHandler, registry.ipBanHandler),
    new CustomRequestCheck(middlewareProtocol),
  ], logger);

  return {
    registry,
    pipeline,
    eventBus,
    metricsCollector,
    validator,
    routeResolver,
    bypassHandler,
    errorResponseFactory,
    behavioralProcessor,
    middlewareProtocol,
  };
}

export { SecurityCheckPipeline, SecurityEventBus, MetricsCollector, RequestValidator,
  RouteConfigResolver, BypassHandler, ErrorResponseFactory, BehavioralProcessor };
export type { HandlerRegistry };
