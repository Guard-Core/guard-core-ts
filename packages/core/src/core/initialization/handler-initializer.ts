import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { AgentHandlerProtocol } from '../../protocols/agent.js';
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
}

export class HandlerInitializer {
  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly agentHandler: AgentHandlerProtocol | null = null,
    private readonly geoIpHandler: GeoIPHandler | null = null,
    private readonly guardDecorator: unknown = null,
  ) {}

  async initialize(): Promise<HandlerRegistry> {
    const ipBanHandler = new IPBanManager(this.logger);
    const rateLimitHandler = new RateLimitManager(this.logger, this.config);
    const cloudHandler = new CloudHandler(this.logger);
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

    if (this.agentHandler) {
      try {
        await this.initializeAgentIntegrations(
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
    };
  }

  private async initializeAgentIntegrations(
    ipBanHandler: IPBanManager,
    rateLimitHandler: RateLimitManager,
    cloudHandler: CloudHandler,
    susPatternsHandler: SusPatternsManager,
    dynamicRuleHandler: DynamicRuleManager,
    redisHandler: RedisManager | null,
  ): Promise<void> {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!this.agentHandler) return;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

    await this.agentHandler.start();

    if (redisHandler) {
      await this.agentHandler.initializeRedis(redisHandler);
      await redisHandler.initializeAgent(this.agentHandler);
    }

    await ipBanHandler.initializeAgent(this.agentHandler);
    await rateLimitHandler.initializeAgent(this.agentHandler);
    await susPatternsHandler.initializeAgent(this.agentHandler);

    if (this.config.blockCloudProviders.size > 0) {
      await cloudHandler.initializeAgent(this.agentHandler);
    }

    if (this.geoIpHandler) {
      await this.geoIpHandler.initializeAgent(this.agentHandler);
    }

    if (this.config.enableDynamicRules) {
      await dynamicRuleHandler.initializeAgent(this.agentHandler);
    }

    if (this.guardDecorator && typeof (this.guardDecorator as Record<string, unknown>)['initializeAgent'] === 'function') {
      await (this.guardDecorator as {
        initializeAgent(a: AgentHandlerProtocol, geo?: unknown): Promise<void>;
      }).initializeAgent(this.agentHandler, this.geoIpHandler);
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
