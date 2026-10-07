import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { GeoIPHandler } from '../../protocols/geo-ip.js';
import type { GuardRequest } from '../../protocols/request.js';
import { invokeErrorHook } from '../block-events.js';

/* Reference _MIDDLEWARE_HANDLER_NAME (middleware_events.py). */
const MIDDLEWARE_HANDLER_NAME = 'middleware';

export class SecurityEventBus {
  constructor(
    private readonly agentHandler: AgentHandlerProtocol | null,
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly geoIpHandler: GeoIPHandler | null = null,
  ) {}

  async sendMiddlewareEvent(
    eventType: string,
    request: GuardRequest,
    actionTaken: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.agentHandler || !this.config.agentEnableEvents) return;

    try {
      const clientIp = request.clientHost ?? 'unknown';
      let country: string | null = null;

      if (this.geoIpHandler) {
        try {
          country = this.geoIpHandler.getCountry(clientIp);
        } catch (e) {
          invokeErrorHook(this.config.onError, 'geoip', e, { clientIp }, this.logger);
        }
      }

      /* Reference _build_event (middleware_events.py): decorator_type and
         rule_type are promoted from the metadata kwargs to top-level
         SecurityEvent fields (the metadata keeps them), and the middleware
         handler name rides every bus envelope. */
      const meta = metadata ?? {};
      const decoratorType = typeof meta['decoratorType'] === 'string'
        ? meta['decoratorType'] as string
        : null;
      const ruleType = typeof meta['ruleType'] === 'string'
        ? meta['ruleType'] as string
        : null;

      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress: clientIp,
        country,
        userAgent: request.headers['user-agent'] ?? null,
        actionTaken,
        reason,
        endpoint: request.urlPath,
        method: request.method,
        decoratorType,
        ruleType,
        handlerName: MIDDLEWARE_HANDLER_NAME,
        metadata: meta,
      });
    } catch (e) {
      this.logger.error(`Failed to send security event: ${e}`);
      invokeErrorHook(
        this.config.onError, 'transport_send', e, { eventType }, this.logger,
      );
    }
  }

  async sendHttpsViolationEvent(
    request: GuardRequest,
    isRouteSpecific: boolean,
  ): Promise<void> {
    const httpsUrl = request.urlReplaceScheme('https');

    if (isRouteSpecific) {
      await this.sendMiddlewareEvent(
        'decorator_violation', request, 'https_redirect',
        'Route requires HTTPS but request was HTTP',
        { decoratorType: 'authentication', violationType: 'require_https', redirectUrl: httpsUrl },
      );
    } else {
      await this.sendMiddlewareEvent(
        'https_enforced', request, 'https_redirect',
        'HTTP request redirected to HTTPS for security',
        { originalScheme: request.urlScheme, redirectUrl: httpsUrl },
      );
    }
  }

  /* The twin of send_cloud_detection_events (middleware_events.py): the
     direct cloud_blocked SecurityEvent rides the cloud handler (provider and
     network metadata), and a route-level blockCloudProviders selector adds
     the decorator_violation bus event. */
  async sendCloudDetectionEvents(
    request: GuardRequest,
    clientIp: string,
    providers: string[],
    routeConfig: { blockCloudProviders: Set<string> } | null,
    cloudHandler: {
      agentHandler: unknown;
      getCloudProviderDetails(ip: string, providers: Set<string>): [string, string] | null;
      sendCloudDetectionEvent(
        ip: string,
        provider: string,
        network: string,
        actionTaken?: string,
      ): Promise<void>;
    } | null,
    passiveMode: boolean,
  ): Promise<void> {
    const action = passiveMode ? 'logged_only' : 'request_blocked';
    if (cloudHandler) {
      const details = cloudHandler.getCloudProviderDetails(clientIp, new Set(providers));
      if (details && cloudHandler.agentHandler) {
        const [provider, network] = details;
        await cloudHandler.sendCloudDetectionEvent(clientIp, provider, network, action);
      }
    }

    if (routeConfig && routeConfig.blockCloudProviders.size > 0) {
      await this.sendMiddlewareEvent(
        'decorator_violation', request, action,
        `Cloud provider IP ${clientIp} blocked`,
        {
          decoratorType: 'block_clouds',
          violationType: 'cloud_provider',
          blockedProviders: providers,
        },
      );
    }
  }
}
