import type { ResolvedSecurityConfig } from '../models/config.js';
import type { BehaviorRule } from '../models/behavior-rule.js';
import { RouteConfig } from '../models/route-config.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisHandlerProtocol } from '../protocols/redis.js';
import type { GuardRequest } from '../protocols/request.js';
import type { GuardResponse } from '../protocols/response.js';
import { BehaviorTracker } from '../handlers/behavior.js';
import type { Logger } from '../models/logger.js';
import { defaultLogger } from '../models/logger.js';

type Constructor<T = object> = new (...args: unknown[]) => T;

const routeIdMap = new WeakMap<Function, string>();
let routeIdCounter = 0;

export class BaseSecurityDecorator {
  routeConfigs = new Map<string, RouteConfig>();
  behaviorTracker: BehaviorTracker;
  agentHandler: AgentHandlerProtocol | null = null;
  geoIpHandler: unknown = null;
  readonly config: ResolvedSecurityConfig;
  readonly logger: Logger;

  constructor(config: ResolvedSecurityConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? defaultLogger;
    this.behaviorTracker = new BehaviorTracker(config, this.logger);
  }

  getRouteConfig(routeId: string): RouteConfig | undefined {
    return this.routeConfigs.get(routeId);
  }

  ensureRouteConfig(fn: Function): RouteConfig {
    const id = this.getRouteId(fn);
    if (!this.routeConfigs.has(id)) {
      const rc = new RouteConfig();
      rc.enableSuspiciousDetection = this.config.enablePenetrationDetection;
      this.routeConfigs.set(id, rc);
    }
    return this.routeConfigs.get(id)!;
  }

  applyRouteConfig<T extends Function>(fn: T): T {
    (fn as Record<string, unknown>)['_guardRouteId'] = this.getRouteId(fn);
    return fn;
  }

  getRouteId(fn: Function): string {
    if (!routeIdMap.has(fn)) {
      routeIdMap.set(fn, `guard_route_${++routeIdCounter}`);
    }
    return routeIdMap.get(fn)!;
  }

  async initializeBehaviorTracking(redisHandler?: RedisHandlerProtocol): Promise<void> {
    if (redisHandler) await this.behaviorTracker.initializeRedis(redisHandler as unknown as import('../handlers/redis.js').RedisManager);
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol, geoIpHandler?: unknown): Promise<void> {
    this.agentHandler = agentHandler;
    this.geoIpHandler = geoIpHandler ?? null;
    await this.behaviorTracker.initializeAgent(agentHandler);
  }

  /* The twin of send_decorator_event (guard_core/decorators/base.py): the
     decorator events ride a SecurityEventBus built over the decorator's
     agent handler, so the envelopes carry the full middleware field set
     (ipAddress, country, userAgent, endpoint, method) with decorator_type
     promoted to a top-level field and retained in the metadata. */
  async sendDecoratorEvent(
    eventType: string,
    request: GuardRequest,
    actionTaken: string,
    reason: string,
    decoratorType: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.agentHandler) return;

    const { SecurityEventBus } = await import('../core/events/event-bus.js');
    const eventBus = new SecurityEventBus(
      this.agentHandler,
      this.config,
      this.logger,
      (this.geoIpHandler ?? null) as ConstructorParameters<typeof SecurityEventBus>[3],
    );
    await eventBus.sendMiddlewareEvent(
      eventType,
      request,
      actionTaken,
      reason,
      { decoratorType, ...meta },
    );
  }

  async sendAccessDeniedEvent(
    request: GuardRequest,
    reason: string,
    decoratorType: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendDecoratorEvent('access_denied', request, 'blocked', reason, decoratorType, meta);
  }

  async sendAuthenticationFailedEvent(
    request: GuardRequest,
    reason: string,
    authType: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendDecoratorEvent('authentication_failed', request, 'blocked', reason, 'authentication', { authType, ...meta });
  }

  async sendRateLimitEvent(
    request: GuardRequest,
    limit: number,
    window: number,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendDecoratorEvent('rate_limited', request, 'blocked', `Rate limit exceeded: ${limit} requests per ${window}s`, 'rate_limiting', { limit, window, ...meta });
  }

  async sendDecoratorViolationEvent(
    request: GuardRequest,
    violationType: string,
    reason: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.sendDecoratorEvent('decorator_violation', request, 'blocked', reason, violationType, meta);
  }
}

export function getRouteDecoratorConfig(
  request: GuardRequest,
  decoratorHandler: BaseSecurityDecorator,
): RouteConfig | undefined {
  const routeId = request.state.guardRouteId;
  if (!routeId || typeof routeId !== 'string') return undefined;
  return decoratorHandler.getRouteConfig(routeId);
}
