import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { SecurityCheck } from '../base.js';

export class EmergencyModeCheck extends SecurityCheck {
  get checkName(): string { return 'emergency_mode'; }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    if (!this.config.emergencyMode) return null;

    const clientIp = request.clientHost ?? '';
    if (this.config.emergencyWhitelist.includes(clientIp)) return null;

    /* Reference EVENT_EMERGENCY_MODE_BLOCK. */
    await this.sendEvent('emergency_mode_block', request, 'request_blocked', 'Emergency mode active');
    return this.createErrorResponse(503, 'Service temporarily unavailable');
  }
}
