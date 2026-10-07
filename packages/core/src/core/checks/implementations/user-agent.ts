import type { GuardMiddlewareProtocol } from '../../../protocols/middleware.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import type { IPBanManager } from '../../../handlers/ip-ban.js';
import { checkUserAgentAllowed, escalateIdentityViolation } from '../helpers.js';
import { logActivity } from '../../../utils.js';
import { redactHeaderValueForDisplay } from '../../../redaction.js';
import { SecurityCheck } from '../base.js';

export class UserAgentCheck extends SecurityCheck {
  private readonly ipBanManager: IPBanManager | null;

  constructor(middleware: GuardMiddlewareProtocol, ipBanManager?: IPBanManager | null) {
    super(middleware);
    /* The manager from the handler initializer is shared across requests;
       when absent (direct construction in tests or standalone pipelines) the
       check leaves it null and the escalation stage skips instead of
       building one per request. */
    this.ipBanManager = ipBanManager ?? null;
  }
  get checkName(): string { return 'user_agent'; }

  /* The log_activity on_block hooks of this check (reference log_activity
     kwargs in UserAgentCheck.check). */
  private blockHooks(): Parameters<typeof logActivity>[7] {
    return {
      checkName: this.checkName,
      onBlock: this.config.onBlock ?? null,
      mutedCheckLogs: this.mutedCheckLogs(),
      sensitiveParams: this.config.logSensitiveParams,
      sensitiveBodyFields: this.config.logSensitiveBodyFields,
      sensitiveHeaders: this.config.logSensitiveHeaders,
    };
  }

  /* The reference muted_check_logs surface (a frozenset of check names in
     SecurityConfig): a check whose name is listed skips its on_block
     dispatch. */
  private mutedCheckLogs(): ReadonlySet<string> {
    return new Set(this.config.mutedCheckLogs);
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    /* Whitelist and exempt_ips matches skip the user-agent check (reference
       UserAgentCheck.check). */
    if (request.state.isWhitelisted === true || request.state.isExempt === true) return null;

    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    const userAgent = request.headers['user-agent'] ?? '';
    if (!userAgent) return null;

    const allowed = await checkUserAgentAllowed(userAgent, routeConfig ?? null, this.config);
    if (allowed) return null;

    const redactedUserAgent = redactHeaderValueForDisplay(
      userAgent,
      this.config.logSensitiveParams,
      this.config.logSensitiveBodyFields,
      this.config.logSensitiveHeaders,
    );

    /* The log-format reason feeds the on_block dispatch (stash on the active
       path, direct passive fire with a null status_code), the reference
       log_activity kwargs of UserAgentCheck. */
    logActivity(request, this.logger, 'suspicious',
      `Blocked user agent: ${redactedUserAgent}`,
      this.config.passiveMode, '', this.config.logSuspiciousLevel, this.blockHooks());

    const actionTaken = this.config.passiveMode ? 'logged_only' : 'request_blocked';
    if (routeConfig && routeConfig.blockedUserAgents.length > 0) {
      /* Reference decorator branch (user_agent.py): emit_decorator_event
         with the content_filtering decorator metadata. */
      await this.sendEvent('decorator_violation', request, actionTaken,
        `User agent '${redactedUserAgent}' blocked`,
        {
          decoratorType: 'content_filtering',
          violationType: 'user_agent',
          blockedUserAgent: redactedUserAgent,
        });
    } else {
      await this.sendEvent('user_agent_blocked', request, actionTaken,
        `User agent '${redactedUserAgent}' in global blocklist`,
        { userAgent: redactedUserAgent, filterType: 'global' });
    }

    if (!this.config.passiveMode) {
      /* Reference UserAgentCheck: the active deny escalates the identity
         violation (re-detect + counter + threshold ban) before the 403. */
      const clientIp = ((request.state as Record<string, unknown>)['clientIp'] as string | undefined)
        ?? request.clientHost;
      if (clientIp) {
        await escalateIdentityViolation(
          this.middleware, this.config, this.ipBanManager,
          request, clientIp, this.logger,
          'user_agent', `Blocked user agent: ${redactedUserAgent}`,
        );
      }
      return this.createErrorResponse(403, 'User-Agent not allowed');
    }
    return null;
  }
}
