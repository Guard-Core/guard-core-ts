import type { GuardMiddlewareProtocol } from '../../protocols/middleware.js';
import type { GuardRequest } from '../../protocols/request.js';
import type { GuardResponse } from '../../protocols/response.js';
import type { Logger } from '../../models/logger.js';
import type { ResolvedSecurityConfig } from '../../models/config.js';

export abstract class SecurityCheck {
  constructor(protected readonly middleware: GuardMiddlewareProtocol) {}

  /* Public read access for the pipeline's failure policy, the twin of the
     reference's check.config usage in SecurityCheckPipeline._handle_check_error. */
  get middlewareRef(): GuardMiddlewareProtocol {
    return this.middleware;
  }

  abstract check(request: GuardRequest): Promise<GuardResponse | null>;
  abstract get checkName(): string;

  protected get config(): ResolvedSecurityConfig {
    return this.middleware.config;
  }

  protected get logger(): Logger {
    return this.middleware.logger;
  }

  async sendEvent(
    type: string,
    request: GuardRequest,
    action: string,
    reason: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const eventBus = this.middleware.eventBus as {
      sendMiddlewareEvent(
        type: string,
        request: GuardRequest,
        action: string,
        reason: string,
        meta?: Record<string, unknown>,
      ): Promise<void>;
    };
    await eventBus.sendMiddlewareEvent(type, request, action, reason, meta);
  }

  async createErrorResponse(statusCode: number, message: string): Promise<GuardResponse> {
    return this.middleware.createErrorResponse(statusCode, message);
  }

  isPassiveMode(): boolean {
    return this.config.passiveMode;
  }
}
