import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { fireBlockHook } from '../../block-events.js';
import { SecurityCheck } from '../base.js';

/* The TS twin of UNRESOLVED_ROUTE_REASON
   (guard_core/core/checks/implementations/route_config.py). */
export const UNRESOLVED_ROUTE_REASON =
  'Route resolution failed; per-route decorator config could not be applied';

export class RouteConfigCheck extends SecurityCheck {
  get checkName(): string { return 'route_config'; }

  /* The twin of _handle_unresolved_route: under route_resolution_strict an
     unresolved route is logged, the route_unresolved event is sent, the on_block
     hook fires (with status_code null on the passive path), and the request is
     blocked with 500 unless passive mode is on. */
  private async handleUnresolvedRoute(request: GuardRequest): Promise<GuardResponse | null> {
    const config = this.config;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    this.logger.warn(`Suspicious request from ${request.clientHost ?? 'unknown'}: `
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      + `${request.method} ${request.urlPath} - ${UNRESOLVED_ROUTE_REASON}`);

    await this.sendEvent(
      'route_unresolved',
      request,
      config.passiveMode ? 'logged_only' : 'request_blocked',
      UNRESOLVED_ROUTE_REASON,
    );

    await fireBlockHook(
      config.onBlock,
      request,
      this.logger,
      this.checkName,
      UNRESOLVED_ROUTE_REASON,
      '',
      config.passiveMode,
      config.passiveMode ? null : 500,
      config.logSensitiveParams,
      config.logSensitiveBodyFields,
      config.logSensitiveHeaders,
    );

    if (!config.passiveMode) {
      return this.createErrorResponse(500, 'Route resolution failed');
    }
    return null;
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const routeResolver = this.middleware.routeResolver as {
      getRouteConfig(request: GuardRequest): unknown;
    };
    const routeConfig = routeResolver.getRouteConfig(request);

    if (routeConfig) {
      (request.state as Record<string, unknown>)['_routeConfig'] = routeConfig;
    }

    if (this.config.routeResolutionStrict
      && (request.state as Record<string, unknown>)['guard_route_unresolved'] === true) {
      return this.handleUnresolvedRoute(request);
    }

    return null;
  }
}
