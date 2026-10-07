import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { CloudIpStoreProtocol } from '../../protocols/cloud-ip-store.js';
import type { GeoIPHandler } from '../../protocols/geo-ip.js';
import { BehaviorTracker } from '../../handlers/behavior.js';
import { CloudHandler } from '../../handlers/cloud.js';
import { DynamicRuleManager } from '../../handlers/dynamic-rules.js';
import { IPBanManager } from '../../handlers/ip-ban.js';
import { RateLimitManager } from '../../handlers/rate-limit.js';
import { RedisManager } from '../../handlers/redis.js';
import { SecurityHeadersManager } from '../../handlers/security-headers.js';
import { SusPatternsManager } from '../../handlers/sus-patterns.js';
import { invokeErrorHook } from '../block-events.js';
import { CompositeAgentHandler } from '../events/composite-handler.js';
import { EventFilter } from '../events/event-filter.js';
import type { AgentEventEnricher } from '../events/event-filter.js';
import { EventEnricher } from '../events/enricher.js';
import { LogfireHandler } from '../events/logfire-handler.js';
import { OtelHandler } from '../events/otel-handler.js';

export interface HandlerRegistry {
  redisHandler: RedisManager | null;
  ipBanHandler: IPBanManager;
  rateLimitHandler: RateLimitManager;
  cloudHandler: CloudHandler;
  susPatternsHandler: SusPatternsManager;
  securityHeadersHandler: SecurityHeadersManager;
  behaviorTracker: BehaviorTracker;
  dynamicRuleHandler: DynamicRuleManager;
  geoIpHandler: GeoIPHandler | null;
  /* The telemetry seam every event consumer holds (reference
     initializer.composite_handler): the composite fan-out when any sink or
     tier is on, the raw injected agent otherwise, null with no telemetry. */
  telemetryHandler: AgentHandlerProtocol | null;
  eventFilter: EventFilter;
  enricher: AgentEventEnricher | null;
}

export class HandlerInitializer {
  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly agentHandler: AgentHandlerProtocol | null = null,
    private readonly geoIpHandler: GeoIPHandler | null = null,
    private readonly guardDecorator: unknown = null,
    /* The injectable cloud-IP store seam (the reference cloud_ip_stores
       DI): null keeps the process-local default store. */
    private readonly cloudIpStore: CloudIpStoreProtocol | null = null,
  ) {}

  async initialize(): Promise<HandlerRegistry> {
    const ipBanHandler = new IPBanManager(this.logger);
    const rateLimitHandler = new RateLimitManager(this.logger, this.config);
    const cloudHandler = new CloudHandler(this.logger, this.cloudIpStore ?? undefined);
    const susPatternsHandler = new SusPatternsManager(this.config, this.logger);
    const securityHeadersHandler = new SecurityHeadersManager(this.logger);
    const behaviorTracker = new BehaviorTracker(this.config, this.logger);
    const dynamicRuleHandler = new DynamicRuleManager(this.config, this.logger);

    let redisHandler: RedisManager | null = null;

    if (this.config.enableRedis) {
      try {
        redisHandler = new RedisManager(this.config, this.logger);
        await redisHandler.initialize();

        await ipBanHandler.initializeRedis(redisHandler);
        await rateLimitHandler.initializeRedis(redisHandler);
        await susPatternsHandler.initializeRedis(redisHandler);
        await securityHeadersHandler.initializeRedis(redisHandler);
        await behaviorTracker.initializeRedis(redisHandler);
        await dynamicRuleHandler.initializeRedis(redisHandler);

        if (this.config.blockCloudProviders.size > 0) {
          await cloudHandler.initializeRedis(
            redisHandler,
            this.config.blockCloudProviders,
            this.config.cloudIpRefreshInterval,
          );
        }

        if (this.geoIpHandler) {
          await this.geoIpHandler.initializeRedis(redisHandler);
        }
      /* v8 ignore start -- requires actual ioredis connection failure which cannot be triggered when ioredis module is mocked */
      } catch (e) {
        this.logger.warn(`Redis initialization failed, falling back to in-memory: ${e}`);
        redisHandler = null;
      }
      /* v8 ignore stop */
    }

    if (this.geoIpHandler && !this.geoIpHandler.isInitialized) {
      await this.geoIpHandler.initialize();
    }

    /* The telemetry seam (reference initialize_agent_integrations +
       build_composite_handler / build_event_filter / build_enricher): the
       composite fans the injected agent out with the optional OTEL and
       Logfire sinks behind the muting filter and the enrichment tier, and
       every event consumer holds the composite. */
    const eventFilter = this.buildEventFilter();
    const enricher = this.buildEnricher(dynamicRuleHandler, behaviorTracker);
    let telemetryHandler: AgentHandlerProtocol | null = this.agentHandler;
    if (this.agentHandler || this.config.enableOtel || this.config.enableLogfire || enricher) {
      const sinks: AgentHandlerProtocol[] = [];
      if (this.agentHandler) sinks.push(this.agentHandler);
      if (this.config.enableOtel) {
        sinks.push(new OtelHandler({
          serviceName: this.config.otelServiceName,
          resourceAttributes: this.config.otelResourceAttributes,
          exporterEndpoint: this.config.otelExporterEndpoint,
        }, this.logger));
      }
      if (this.config.enableLogfire) {
        sinks.push(new LogfireHandler({ serviceName: this.config.logfireServiceName }, this.logger));
      }
      telemetryHandler = new CompositeAgentHandler(sinks, { eventFilter, enricher, logger: this.logger });
    }

    if (telemetryHandler) {
      try {
        await this.initializeAgentIntegrations(
          telemetryHandler,
          ipBanHandler, rateLimitHandler, cloudHandler,
          susPatternsHandler, dynamicRuleHandler, redisHandler,
        );
      } catch (e) {
        this.logger.error(`Agent initialization failed: ${e}`);
        invokeErrorHook(this.config.onError, 'agent_init', e, {}, this.logger);
      }
    }

    this.configureSecurityHeaders(securityHeadersHandler);

    return {
      redisHandler,
      ipBanHandler,
      rateLimitHandler,
      cloudHandler,
      susPatternsHandler,
      securityHeadersHandler,
      behaviorTracker,
      dynamicRuleHandler,
      geoIpHandler: this.geoIpHandler,
      telemetryHandler,
      eventFilter,
      enricher,
    };
  }

  /* The twin of build_event_filter: the muting surface from config. */
  private buildEventFilter(): EventFilter {
    return new EventFilter(this.config.mutedEventTypes, this.config.mutedMetricTypes);
  }

  /* The twin of build_enricher: the guard.* enrichment tier behind
     enableEnrichment. */
  private buildEnricher(
    dynamicRuleHandler: DynamicRuleManager,
    behaviorTracker: BehaviorTracker,
  ): AgentEventEnricher | null {
    if (!this.config.enableEnrichment) return null;
    return new EventEnricher({
      config: this.config,
      dynamicRuleHandler,
      behaviorTracker,
    }, { logger: this.logger });
  }

  private async initializeAgentIntegrations(
    telemetry: AgentHandlerProtocol,
    ipBanHandler: IPBanManager,
    rateLimitHandler: RateLimitManager,
    cloudHandler: CloudHandler,
    susPatternsHandler: SusPatternsManager,
    dynamicRuleHandler: DynamicRuleManager,
    redisHandler: RedisManager | null,
  ): Promise<void> {
    await telemetry.start();

    if (redisHandler) {
      await telemetry.initializeRedis(redisHandler);
      await redisHandler.initializeAgent(telemetry);
    }

    await ipBanHandler.initializeAgent(telemetry);
    await rateLimitHandler.initializeAgent(telemetry);
    await susPatternsHandler.initializeAgent(telemetry);

    if (this.config.blockCloudProviders.size > 0) {
      await cloudHandler.initializeAgent(telemetry);
    }

    if (this.geoIpHandler) {
      await this.geoIpHandler.initializeAgent(telemetry);
    }

    if (this.config.enableDynamicRules) {
      await dynamicRuleHandler.initializeAgent(telemetry);
    }

    if (this.guardDecorator && typeof (this.guardDecorator as Record<string, unknown>)['initializeAgent'] === 'function') {
      await (this.guardDecorator as {
        initializeAgent(a: AgentHandlerProtocol, geo?: unknown): Promise<void>;
      }).initializeAgent(telemetry, this.geoIpHandler);
    }
  }

  private configureSecurityHeaders(manager: SecurityHeadersManager): void {
    const headers = this.config.securityHeaders;
    if (!headers) return;

    manager.configure({
      enabled: headers.enabled,
      csp: headers.csp,
      hstsMaxAge: headers.hsts?.maxAge,
      hstsIncludeSubdomains: headers.hsts?.includeSubdomains,
      hstsPreload: headers.hsts?.preload,
      frameOptions: headers.frameOptions,
      contentTypeOptions: headers.contentTypeOptions,
      xssProtection: headers.xssProtection,
      referrerPolicy: headers.referrerPolicy,
      permissionsPolicy: headers.permissionsPolicy,
      customHeaders: headers.custom ?? undefined,
      corsOrigins: this.config.enableCors ? this.config.corsAllowOrigins : undefined,
      corsAllowCredentials: this.config.corsAllowCredentials,
      corsAllowMethods: this.config.corsAllowMethods,
      corsAllowHeaders: this.config.corsAllowHeaders,
    });
  }
}
