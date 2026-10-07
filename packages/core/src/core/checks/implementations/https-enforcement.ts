import type { GuardMiddlewareProtocol } from '../../../protocols/middleware.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import type { RequestValidator } from '../../validation/validator.js';
import type { ErrorResponseFactory } from '../../responses/factory.js';
import { SecurityCheck } from '../base.js';

export class HttpsEnforcementCheck extends SecurityCheck {
  private readonly validator: RequestValidator;
  private readonly responseFactory: ErrorResponseFactory;

  constructor(
    middleware: GuardMiddlewareProtocol,
    validator: RequestValidator,
    responseFactory: ErrorResponseFactory,
  ) {
    super(middleware);
    this.validator = validator;
    this.responseFactory = responseFactory;
  }

  get checkName(): string { return 'https_enforcement'; }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;

    const httpsRequired = routeConfig ? routeConfig.requireHttps : this.config.enforceHttps;
    if (!httpsRequired) return null;
    if (this.validator.isRequestHttps(request)) return null;

    /* Reference HttpsEnforcementCheck.check: the violation event fires
       before the redirect, route-scoped denials ride decorator_violation and
       global ones https_enforced (send_https_violation_event). */
    const eventBus = this.middleware.eventBus as {
      sendHttpsViolationEvent(request: GuardRequest, isRouteSpecific: boolean): Promise<void>;
    };
    await eventBus.sendHttpsViolationEvent(request, Boolean(routeConfig?.requireHttps));

    if (this.isPassiveMode()) {
      this.logger.info(`[PASSIVE] Would redirect to HTTPS: ${request.urlPath}`);
      return null;
    }

    return this.responseFactory.createHttpsRedirect(request);
  }
}
