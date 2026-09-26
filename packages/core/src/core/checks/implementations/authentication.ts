import type { RouteConfig } from '../../../models/route-config.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { logActivity } from '../../../utils.js';
import { extractCredential, resolveVerifierResult } from '../helpers.js';
import { SecurityCheck } from '../base.js';

type AuthVerifier = ((request: GuardRequest, credential: string) => unknown) | null;

export class AuthenticationCheck extends SecurityCheck {
  get checkName(): string { return 'authentication'; }

  /* The twin of _handle_auth_failure: suspicious log with the wrapped reason,
     decorator_violation event scoped to the resolved auth type, then 401
     `Authentication required` (the reference's default_message, subject to
     customErrorResponses) unless passive mode is on. */
  private async handleAuthFailure(
    request: GuardRequest,
    authReason: string,
    routeConfig: RouteConfig,
    violationType = 'require_auth',
  ): Promise<GuardResponse | null> {
    logActivity(
      request, this.logger, 'suspicious', `Authentication failure: ${authReason}`,
      this.config.passiveMode, '', this.config.logSuspiciousLevel,
    );

    const authType = routeConfig.authRequired
      ?? routeConfig.authorizationHeaderRequired
      ?? 'api_key';
    await this.sendEvent('decorator_violation', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked', authReason, {
        decoratorType: 'authentication',
        violationType,
        authType,
      });

    if (!this.config.passiveMode) {
      return this.createErrorResponse(401, 'Authentication required');
    }
    return null;
  }

  /* The twin of _check_presence: presence-only scheme from
     require_authorization_header, mutually exclusive with authenticated routes. */
  private async checkPresence(
    request: GuardRequest,
    routeConfig: RouteConfig,
    scheme: string,
  ): Promise<GuardResponse | null> {
    const authHeader = request.headers['authorization'] ?? '';
    const [credential, reason] = extractCredential(authHeader, scheme);
    if (credential === null) {
      return this.handleAuthFailure(request, reason, routeConfig, 'authorization_header');
    }
    return null;
  }

  /* The twin of _resolve_credential: require_auth reads the authorization
     header with the route scheme; api_key_auth reads the route-named header.
     Route-level verifiers win over the global authVerifier. */
  private async resolveCredential(
    request: GuardRequest,
    routeConfig: RouteConfig,
  ): Promise<[GuardResponse | null, AuthVerifier, string]> {
    if (routeConfig.authRequired) {
      const verifier = routeConfig.authVerifier ?? this.config.authVerifier ?? null;
      const authHeader = request.headers['authorization'] ?? '';
      const [credential, reason] = extractCredential(authHeader, routeConfig.authRequired);
      if (credential === null) {
        return [await this.handleAuthFailure(request, reason, routeConfig), null, ''];
      }
      return [null, verifier, credential];
    }
    const verifier = routeConfig.apiKeyVerifier ?? this.config.authVerifier ?? null;
    const credential = request.headers[(routeConfig.apiKeyHeader ?? '').toLowerCase()] ?? '';
    if (!credential) {
      return [await this.handleAuthFailure(request, 'Missing API key', routeConfig), null, ''];
    }
    return [null, verifier, credential];
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    if (!routeConfig) return null;

    if (routeConfig.authorizationHeaderRequired) {
      return this.checkPresence(request, routeConfig, routeConfig.authorizationHeaderRequired);
    }

    if (!routeConfig.authRequired && !routeConfig.apiKeyRequired) return null;

    const [failure, verifier, credential] = await this.resolveCredential(request, routeConfig);
    if (failure !== null) return failure;

    if (verifier === null) {
      return this.handleAuthFailure(request, 'No auth verifier configured', routeConfig);
    }

    let result: unknown;
    try {
      result = await resolveVerifierResult(verifier(request, credential));
    } catch {
      return this.handleAuthFailure(request, 'Authentication error', routeConfig);
    }
    if (!result) {
      return this.handleAuthFailure(request, 'Authentication failed', routeConfig);
    }

    (request.state as Record<string, unknown>)['auth_principal'] = result;
    return null;
  }
}
