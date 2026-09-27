import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { GeoIPHandler } from '../../protocols/geo-ip.js';
import type { GuardRequest } from '../../protocols/request.js';
import { invokeErrorHook } from '../block-events.js';

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
        metadata: metadata ?? {},
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

  async sendCloudDetectionEvents(
    request: GuardRequest,
    clientIp: string,
    providers: string[],
    passiveMode: boolean,
  ): Promise<void> {
    await this.sendMiddlewareEvent(
      /* Reference EVENT_CLOUD_BLOCKED. */
      'cloud_blocked', request,
      /* v8 ignore next -- V8 cannot track ternary branch coverage inside string template literal */
      passiveMode ? 'logged_only' : 'request_blocked',
      `Cloud provider IP ${clientIp} detected`,
      { blockedProviders: providers },
    );
  }
}
