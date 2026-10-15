import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { ipInList } from '../../../ip-identity.js';
import { extractClientIp } from '../../../utils.js';
import { resolvedClientIp } from '../../client-identity.js';
import { SecurityCheck } from '../base.js';

export class EmergencyModeCheck extends SecurityCheck {
  get checkName(): string { return 'emergency_mode'; }

  /* An unparseable identity is never whitelisted (reference ip_address
     ValueError arm), a listed address matches in canonical form. */
  private isWhitelisted(clientIp: string): boolean {
    try {
      return ipInList(clientIp, this.config.emergencyWhitelist);
    } catch {
      return false;
    }
  }

  /* The twin of EmergencyModeCheck.check
     (guard_core/core/checks/implementations/emergency_mode.py): whitelisted
     IPs pass, every other IP logs the emergency denial and receives
     EVENT_EMERGENCY_MODE_BLOCK with the reference reason and whitelist
     metadata before the 503. */
  async check(request: GuardRequest): Promise<GuardResponse | null> {
    if (!this.config.emergencyMode) return null;

    const clientIp = resolvedClientIp(request)
      ?? await extractClientIp(request, this.config, this.middleware.agentHandler);
    if (this.isWhitelisted(clientIp)) return null;

    this.logger.info(`[EMERGENCY MODE] Access denied for IP ${clientIp}`);

    await this.sendEvent(
      'emergency_mode_block', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked',
      `[EMERGENCY MODE] IP ${clientIp} not in whitelist`,
      {
        emergencyWhitelistCount: this.config.emergencyWhitelist.length,
        emergencyActive: true,
      },
    );

    if (!this.isPassiveMode()) {
      return this.createErrorResponse(503, 'Service temporarily unavailable');
    }
    return null;
  }
}
