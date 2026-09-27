import type { GuardMiddlewareProtocol } from '../../../protocols/middleware.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import type { CloudHandler } from '../../../handlers/cloud.js';
import type { RouteConfigResolver } from '../../routing/resolver.js';
import { logActivity } from '../../../utils.js';
import { SecurityCheck } from '../base.js';

export class CloudProviderCheck extends SecurityCheck {
  private readonly cloudHandler: CloudHandler | null;

  constructor(middleware: GuardMiddlewareProtocol, cloudHandler?: CloudHandler | null) {
    super(middleware);
    /* The handler from the initializer registry is shared across requests and
       its ranges are populated by the refresh check; when absent (direct
       construction in tests or standalone pipelines) the check leaves it null
       and no provider membership can ever resolve. */
    this.cloudHandler = cloudHandler ?? null;
  }

  get checkName(): string { return 'cloud_provider'; }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    /* Whitelist and exempt_ips matches skip the cloud-provider check
       (reference CloudProviderCheck.check). */
    if (request.state.isWhitelisted === true || request.state.isExempt === true) return null;

    const clientIp = request.clientHost;
    if (!clientIp) return null;

    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    const resolver = this.middleware.routeResolver as RouteConfigResolver;

    if (resolver.shouldBypassCheck('clouds', routeConfig ?? null)) return null;

    const providers = resolver.getCloudProvidersToCheck(routeConfig ?? null);
    if (!providers || providers.length === 0) return null;
    if (!this.cloudHandler) return null;

    if (!this.cloudHandler.isCloudIp(clientIp, new Set(providers))) return null;

    logActivity(request, this.logger, 'suspicious', `Blocked cloud provider IP: ${clientIp}`,
      this.config.passiveMode, '', this.config.logSuspiciousLevel);

    await this.emitCloudBlockEvents(request, clientIp, providers, routeConfig ?? null);

    if (this.isPassiveMode()) return null;
    return this.createErrorResponse(403, 'Cloud provider IP not allowed');
  }

  /* Reference _emit_cloud_block_events: the middleware-level cloud_blocked
     event always fires; the decorator_violation event fires only when the
     per-route blockCloudProviders selector (not the global list) triggered
     the block. */
  private async emitCloudBlockEvents(
    request: GuardRequest,
    clientIp: string,
    providers: string[],
    routeConfig: RouteConfig | null,
  ): Promise<void> {
    const eventBus = this.middleware.eventBus as {
      sendCloudDetectionEvents(
        request: GuardRequest,
        clientIp: string,
        providers: string[],
        passiveMode: boolean,
      ): Promise<void>;
    };
    await eventBus.sendCloudDetectionEvents(request, clientIp, providers, this.config.passiveMode);

    if (!routeConfig || routeConfig.blockCloudProviders.size === 0) return;

    await this.sendEvent('decorator_violation', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked',
      `Cloud provider IP ${clientIp} blocked`,
      {
        decoratorType: 'block_clouds',
        violationType: 'cloud_provider',
        blockedProviders: providers,
      });
  }
}
