import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import { checkUserAgentAllowed } from '../helpers.js';
import { logActivity } from '../../../utils.js';
import { redactHeaderValueForDisplay } from '../../../redaction.js';
import { SecurityCheck } from '../base.js';

export class UserAgentCheck extends SecurityCheck {
  get checkName(): string { return 'user_agent'; }

  /* The log_activity on_block hooks of this check (reference log_activity
     kwargs in UserAgentCheck.check). */
  private blockHooks(): Parameters<typeof logActivity>[7] {
    return {
      checkName: this.checkName,
      onBlock: this.config.onBlock ?? null,
      mutedCheckLogs: null,
      sensitiveParams: this.config.logSensitiveParams,
      sensitiveBodyFields: this.config.logSensitiveBodyFields,
      sensitiveHeaders: this.config.logSensitiveHeaders,
    };
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
      await this.sendEvent('decorator_violation', request, actionTaken,
        `User agent '${redactedUserAgent}' blocked`);
    } else {
      await this.sendEvent('user_agent_blocked', request, actionTaken,
        `User agent '${redactedUserAgent}' in global blocklist`);
    }

    if (!this.config.passiveMode) {
      return this.createErrorResponse(403, 'User-Agent not allowed');
    }
    return null;
  }
}
