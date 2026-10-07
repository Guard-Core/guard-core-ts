import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { extractClientIp } from '../../../utils.js';
import { SecurityCheck } from '../base.js';

export class EmergencyModeCheck extends SecurityCheck {
  get checkName(): string { return 'emergency_mode'; }

  /* The twin of EmergencyModeCheck.check
     (guard_core/core/checks/implementations/emergency_mode.py): whitelisted
     IPs pass, every other IP logs the emergency denial and receives
     EVENT_EMERGENCY_MODE_BLOCK with the reference reason and whitelist
     metadata before the 503. */
  async check(request: GuardRequest): Promise<GuardResponse | null> {
    if (!this.config.emergencyMode) return null;

    const clientIp = request.clientHost ?? '';
    if (this.config.emergencyWhitelist.includes(clientIp)) return null;

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
