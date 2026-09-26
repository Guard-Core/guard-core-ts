import type { RouteConfig } from '../../../models/route-config.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { logActivity } from '../../../utils.js';
import { SecurityCheck } from '../base.js';

/* The twin of _classify_header_violation
   (guard_core/core/checks/implementations/required_headers.py): x-api-key
   violations report as authentication/api_key_required, authorization as
   authentication/required_header, everything else as advanced/required_header. */
export function classifyHeaderViolation(header: string): [string, string] {
  const headerLower = header.toLowerCase();
  if (headerLower === 'x-api-key') return ['authentication', 'api_key_required'];
  if (headerLower === 'authorization') return ['authentication', 'required_header'];
  return ['advanced', 'required_header'];
}

export class RequiredHeadersCheck extends SecurityCheck {
  get checkName(): string { return 'required_headers'; }

  /* The twin of _report_header_violation: suspicious log, decorator_violation
     event scoped by the header classification, then 400 with the reason as the
     default message unless passive mode is on. */
  private async reportHeaderViolation(
    request: GuardRequest,
    header: string,
    reason: string,
    headerField: 'missing_header' | 'mismatched_header',
  ): Promise<GuardResponse | null> {
    logActivity(
      request, this.logger, 'suspicious', reason, this.config.passiveMode,
      '', this.config.logSuspiciousLevel,
    );

    const [decoratorType, violationType] = classifyHeaderViolation(header);
    await this.sendEvent('decorator_violation', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked', reason, {
        decoratorType,
        violationType,
        [headerField]: header,
      });

    if (!this.config.passiveMode) {
      return this.createErrorResponse(400, reason);
    }
    return null;
  }

  private handleMissingHeader(request: GuardRequest, header: string): Promise<GuardResponse | null> {
    return this.reportHeaderViolation(
      request, header, `Missing required header: ${header}`, 'missing_header',
    );
  }

  private handleMismatchedHeader(request: GuardRequest, header: string): Promise<GuardResponse | null> {
    return this.reportHeaderViolation(
      request, header, `Header '${header}' does not match the required value`, 'mismatched_header',
    );
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    if (!routeConfig || Object.keys(routeConfig.requiredHeaders).length === 0) return null;

    for (const [header, expected] of Object.entries(routeConfig.requiredHeaders)) {
      const actual = request.headers[header.toLowerCase()];
      if (!actual) {
        return this.handleMissingHeader(request, header);
      }
      /* The reference sentinel: expected == 'required' checks presence only. */
      if (expected !== 'required' && actual !== expected) {
        return this.handleMismatchedHeader(request, header);
      }
    }

    return null;
  }
}
