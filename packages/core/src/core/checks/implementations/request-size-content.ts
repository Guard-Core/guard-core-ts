import type { RouteConfig } from '../../../models/route-config.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import { redactHeaderValueForDisplay } from '../../../redaction.js';
import { SecurityCheck } from '../base.js';

export class RequestSizeContentCheck extends SecurityCheck {
  get checkName(): string { return 'request_size_content'; }

  /* The twin of _check_request_size_limit
     (guard_core/core/checks/implementations/request_size_content.py): the
     violation logs, fires EVENT_CONTENT_FILTERED with the content_filtering
     decorator metadata, then returns the 413 (swallowed in passive mode). */
  private async checkRequestSizeLimit(
    request: GuardRequest,
    routeConfig: RouteConfig,
  ): Promise<GuardResponse | null> {
    if (routeConfig.maxRequestSize === null) return null;

    const contentLength = parseInt(request.headers['content-length'] ?? '0', 10);
    if (contentLength <= routeConfig.maxRequestSize) return null;

    const message = `Request size ${contentLength} exceeds limit`;
    await this.sendEvent(
      'content_filtered', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked',
      `${message}: ${routeConfig.maxRequestSize}`,
      { decoratorType: 'content_filtering', violationType: 'max_request_size' },
    );

    if (this.isPassiveMode()) {
      this.logger.info(`[PASSIVE] Request too large: ${contentLength} > ${routeConfig.maxRequestSize}`);
      return null;
    }
    return this.createErrorResponse(413, 'Request entity too large');
  }

  /* The twin of _check_content_type_allowed: the disallowed type is
     redacted for the log, EVENT_CONTENT_FILTERED carries the allowed-list
     reason with violation_type content_type, then the 415 returns. */
  private async checkContentTypeAllowed(
    request: GuardRequest,
    routeConfig: RouteConfig,
  ): Promise<GuardResponse | null> {
    if (routeConfig.allowedContentTypes === null) return null;

    const contentType = request.headers['content-type'] ?? '';
    if (contentType && routeConfig.allowedContentTypes.some((t) => contentType.includes(t))) {
      return null;
    }

    const redactedContentType = redactHeaderValueForDisplay(contentType, null, null, null);
    await this.sendEvent(
      'content_filtered', request,
      this.isPassiveMode() ? 'logged_only' : 'request_blocked',
      `Content type not in allowed types: ${routeConfig.allowedContentTypes.join(', ')}`,
      { decoratorType: 'content_filtering', violationType: 'content_type' },
    );

    if (this.isPassiveMode()) {
      this.logger.info(`[PASSIVE] Invalid content type: ${redactedContentType}`);
      return null;
    }
    return this.createErrorResponse(415, 'Unsupported media type');
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    if (!routeConfig) return null;

    const sizeResponse = await this.checkRequestSizeLimit(request, routeConfig);
    if (sizeResponse) return sizeResponse;

    return this.checkContentTypeAllowed(request, routeConfig);
  }
}
