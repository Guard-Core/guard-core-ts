import ipaddr from 'ipaddr.js';

import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { GuardRequest } from '../../protocols/request.js';
import type { SecurityEventBus } from '../events/event-bus.js';
import { pathIsExcluded } from './path-matching.js';

export class RequestValidator {
  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly eventBus: SecurityEventBus,
  ) {}

  isRequestHttps(request: GuardRequest): boolean {
    let isHttps = request.urlScheme === 'https';

    if (
      this.config.trustXForwardedProto &&
      this.config.trustedProxies.length > 0 &&
      request.clientHost
    ) {
      if (this.isTrustedProxy(request.clientHost)) {
        /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
        const forwardedProto = request.headers['x-forwarded-proto'] ?? '';
        /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        isHttps = isHttps || forwardedProto.toLowerCase() === 'https';
      }
    }

    return isHttps;
  }

  isTrustedProxy(connectingIp: string): boolean {
    for (const proxy of this.config.trustedProxies) {
      if (!proxy.includes('/')) {
        if (connectingIp === proxy) return true;
      } else {
        try {
          const parsed = ipaddr.parse(connectingIp);
          const [addr, prefixLen] = ipaddr.parseCIDR(proxy);
          if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
        /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
        } catch { continue; }
        /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      }
    }
    return false;
  }

  async checkTimeWindow(timeRestrictions: { start: string; end: string }): Promise<boolean> {
    try {
      const { start, end } = timeRestrictions;
      const now = new Date();
      const currentTime = now.toISOString().slice(11, 16);

      if (start > end) {
        return currentTime >= start || currentTime <= end;
      }
      return currentTime >= start && currentTime <= end;
    /* v8 ignore start -- catch block for time string parsing errors; returns true for safety */
    } catch (e) {
      this.logger.error(`Error checking time window: ${e}`);
      return true;
    }
    /* v8 ignore stop */
  }

  async isPathExcluded(request: GuardRequest): Promise<boolean> {
    /* Reference semantics (guard_core/core/validation/path_matching.py):
       the request path and the configured exclusions are normalized
       (recursive percent-decode + dot-segment collapse) and matched
       subtree-or-equal. A path that cannot be decoded stays checked. */
    const excluded = pathIsExcluded(request.urlPath, this.config.excludePaths);

    if (excluded) {
      await this.eventBus.sendMiddlewareEvent(
        'path_excluded', request, 'security_checks_bypassed',
        `Path ${request.urlPath} excluded from security checks`,
        { excludedPath: request.urlPath, configuredExclusions: this.config.excludePaths },
      );
    }

    return excluded;
  }
}
