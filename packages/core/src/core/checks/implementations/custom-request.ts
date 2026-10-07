import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { SecurityCheck } from '../base.js';

export class CustomRequestCheck extends SecurityCheck {
  get checkName(): string { return 'custom_request'; }

  /* The twin of CustomRequestCheck.check
     (guard_core/core/checks/implementations/custom_request.py): a blocking
     verdict fires EVENT_CUSTOM_REQUEST_CHECK before the response returns
     (logged_only in passive mode). */
  async check(request: GuardRequest): Promise<GuardResponse | null> {
    if (!this.config.customRequestCheck) return null;

    const customResponse = await this.config.customRequestCheck(request);
    if (customResponse) {
      const checkFunction = this.config.customRequestCheck.name || 'anonymous';
      await this.sendEvent(
        'custom_request_check', request,
        this.isPassiveMode() ? 'logged_only' : 'request_blocked',
        'Custom request check returned blocking response',
        {
          responseStatus: customResponse.statusCode,
          checkFunction,
        },
      );
      return customResponse;
    }
    return null;
  }
}
