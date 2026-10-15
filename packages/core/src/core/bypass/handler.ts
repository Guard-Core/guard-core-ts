import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { RouteConfig } from '../../models/route-config.js';
import type { Logger } from '../../models/logger.js';
import { defaultLogger } from '../../models/logger.js';
import { UNKNOWN_CLIENT_IDENTITY } from '../client-identity.js';
import { fireBlockHook } from '../block-events.js';
import type { GuardRequest } from '../../protocols/request.js';
import type { GuardResponse } from '../../protocols/response.js';
import type { SecurityEventBus } from '../events/event-bus.js';
import type { ErrorResponseFactory } from '../responses/factory.js';
import type { RouteConfigResolver } from '../routing/resolver.js';
import type { RequestValidator } from '../validation/validator.js';

/* The twin of UNRESOLVABLE_CLIENT_ADDRESS_CHECK_NAME
   (guard_core/core/bypass/handler.py). */
export const UNRESOLVABLE_CLIENT_ADDRESS_CHECK_NAME = 'client_address_unresolved';

export class BypassHandler {
  private noClientAddressWarned = false;

  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly eventBus: SecurityEventBus,
    private readonly routeResolver: RouteConfigResolver,
    private readonly responseFactory: ErrorResponseFactory,
    private readonly validator: RequestValidator,
    private readonly logger: Logger = defaultLogger,
  ) {}

  /* The twin of BypassHandler.handle_passthrough (guard_core/core/bypass/
     handler.py). An excluded path does NOT skip the pipeline: it marks the
     request exclusion-scoped (guardExclusionScoped) and returns null, so the
     adapter continues to the real downstream handler through the scoped
     pipeline (only the checks with enforcedOnExcludedPaths run). A request
     with no client address is answered 403 under failSecure (with the
     on_block hook), and otherwise continues with the "unknown" identity.
     Never answers on behalf of the downstream handler: the callNext argument
     is kept for signature parity and is not called. */
  async handlePassthrough(
    request: GuardRequest,
    _callNext?: (req: GuardRequest) => Promise<GuardResponse>,
  ): Promise<GuardResponse | null> {
    if (await this.validator.isPathExcluded(request)) {
      request.state.guardExclusionScoped = true;
      return null;
    }

    if (!request.clientHost) {
      request.state['client_ip'] = UNKNOWN_CLIENT_IDENTITY;
      this.warnNoClientAddress();
      if (this.config.failSecure) {
        const response = await this.responseFactory.createErrorResponse(
          403, 'Client address could not be determined',
        );
        await fireBlockHook(
          this.config.onBlock, request, this.logger,
          UNRESOLVABLE_CLIENT_ADDRESS_CHECK_NAME,
          'Client address could not be determined', '', false,
          response.statusCode,
          this.config.logSensitiveParams,
          this.config.logSensitiveBodyFields,
          this.config.logSensitiveHeaders,
        );
        return response;
      }
    }

    return null;
  }

  private warnNoClientAddress(): void {
    if (this.noClientAddressWarned) return;
    this.noClientAddressWarned = true;
    const outcome = this.config.failSecure
      ? 'the request is rejected with 403 (failSecure=true)'
      : 'the pipeline runs with identity "unknown" (failSecure=false)';
    this.logger.warn(
      'no client address on the connection; if the app is served over a Unix socket '
      + `add "unix" to trustedProxies; ${outcome}. This warning is logged once.`,
    );
  }

  async handleSecurityBypass(
    request: GuardRequest,
    callNext: (req: GuardRequest) => Promise<GuardResponse>,
    routeConfig: RouteConfig | null,
  ): Promise<GuardResponse | null> {
    if (!(await this.beginSecurityBypass(request, routeConfig))) return null;
    const response = await callNext(request);
    return this.responseFactory.applyModifier(response);
  }

  /* The announce half of handle_security_bypass for adapters that cannot
     await the downstream response inside a callback (express, fastify,
     nestjs): emits the security_bypass event and returns true when the
     adapter must continue to the real downstream handler (applying the
     response modifier to the real response itself). False means run the
     normal pipeline (no all-checks bypass, or passive mode). */
  async beginSecurityBypass(
    request: GuardRequest,
    routeConfig: RouteConfig | null,
  ): Promise<boolean> {
    if (!routeConfig || !this.routeResolver.shouldBypassCheck('all', routeConfig)) {
      return false;
    }

    await this.eventBus.sendMiddlewareEvent(
      'security_bypass', request, 'all_checks_bypassed',
      'Route configured to bypass all security checks',
      { bypassedChecks: [...routeConfig.bypassedChecks], endpoint: request.urlPath },
    );

    return !this.config.passiveMode;
  }
}
