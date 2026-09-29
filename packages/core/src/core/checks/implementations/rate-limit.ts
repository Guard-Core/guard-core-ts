import type { GuardMiddlewareProtocol } from '../../../protocols/middleware.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import type { RateLimitManager } from '../../../handlers/rate-limit.js';
import type { IPBanManager } from '../../../handlers/ip-ban.js';
import { incrementSuspiciousCounts, tryThresholdBan } from '../helpers.js';
import { logActivity } from '../../../utils.js';
import { SecurityCheck } from '../base.js';

export class RateLimitCheck extends SecurityCheck {
  private readonly ipBanManager: IPBanManager | null;

  constructor(middleware: GuardMiddlewareProtocol, ipBanManager?: IPBanManager | null) {
    super(middleware);
    /* The manager from the handler initializer is shared across requests;
       when absent (direct construction in tests or standalone pipelines) the
       check leaves it null and the autoban stage skips instead of building
       one per request. */
    this.ipBanManager = ipBanManager ?? null;
  }

  get checkName(): string { return 'rate_limit'; }

  /* Reference RateLimitCheck._record_rate_limit_autoban
     (guard_core/core/checks/implementations/rate_limit.py): with
     enableRateLimitAutoBan on, each active-mode (non-passive) violation
     feeds the 'rate_limit' pseudo-category of the shared suspicious-count
     structure and runs the same threshold logic as penetration detection
     (threatBanConfig['rate_limit'] override first, then the flat
     autoBanThreshold/autoBanDuration). Passive mode never reaches the
     autoban: the caller returns before it. */
  private async recordRateLimitAutoBan(
    request: GuardRequest,
    clientIp: string,
    triggerInfo: string,
  ): Promise<void> {
    if (!this.config.enableRateLimitAutoBan) return;
    incrementSuspiciousCounts(this.middleware, clientIp, 'rate_limit');
    await tryThresholdBan(
      request, this.config, this.ipBanManager, this.middleware,
      clientIp, triggerInfo, this.logger, ['rate_limit'], 'rate_limit_exceeded',
    );
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    /* Whitelist and exempt_ips matches skip rate limiting (reference
       RateLimitCheck.check). */
    if (request.state.isWhitelisted === true || request.state.isExempt === true) return null;

    if (!this.config.enableRateLimiting) return null;

    const clientIp = request.clientHost;
    if (!clientIp) return null;

    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;

    if (routeConfig?.rateLimit !== null && routeConfig?.rateLimit !== undefined) {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      const window = routeConfig.rateLimitWindow ?? 60;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      const routeResponse = await this.applyRateLimitCheck(
        request, clientIp, routeConfig.rateLimit, window,
        'decorator_violation',
        `Route-specific rate limit exceeded: ${routeConfig.rateLimit} requests per ${window}s`,
        request.urlPath,
      );
      if (routeResponse !== null) return routeResponse;
    }

    const endpointLimit = this.config.endpointRateLimits[request.urlPath];
    if (endpointLimit) {
      const [limit, window] = endpointLimit;
      const endpointResponse = await this.applyRateLimitCheck(
        request, clientIp, limit, window,
        'dynamic_rule_violation',
        `Endpoint-specific rate limit exceeded: ${limit} requests per ${window}s for ${request.urlPath}`,
        request.urlPath,
      );
      if (endpointResponse !== null) return endpointResponse;
    }

    const geoResponse = await this.checkGeoRateLimit(request, clientIp, routeConfig ?? null);
    if (geoResponse) return geoResponse;

    return this.applyRateLimitCheck(
      request, clientIp, this.config.rateLimit, this.config.rateLimitWindow,
      '', '', null,
    );
  }

  /* The twin of _apply_rate_limit_check
     (guard_core/core/checks/implementations/rate_limit.py): the tripped tier
     emits its middleware event before the passive/active branch, passive
     mode swallows the response (the handler's log_activity dispatch already
     fired on_block with status_code null), and the active path runs the
     rate-limit autoban stage. The global tier carries no middleware event
     (reference _check_global_rate_limit). */
  private async applyRateLimitCheck(
    request: GuardRequest,
    clientIp: string,
    rateLimit: number,
    window: number,
    eventType: string,
    eventReason: string,
    endpointPath: string | null,
  ): Promise<GuardResponse | null> {
    const rateLimitHandler = this.middleware.rateLimitHandler as RateLimitManager;
    const response = await rateLimitHandler.checkRateLimit(
      request, clientIp, this.createErrorResponse.bind(this), endpointPath, rateLimit, window,
    );

    if (response === null) return null;

    if (eventType !== '') {
      await this.sendEvent(eventType, request,
        this.config.passiveMode ? 'logged_only' : 'request_blocked', eventReason);
    }

    if (this.isPassiveMode()) return null;

    await this.recordRateLimitAutoBan(
      request, clientIp, eventReason !== '' ? eventReason : 'Global rate limit exceeded',
    );
    return response;
  }

  /* Reference RateLimitCheck._check_geo_rate_limit: the tier list is the
     route's geoRateLimits map, keyed by two-letter country code with the
     pseudo-code "*" as the fallback tier. The country resolves through the
     middleware's geoip handler; a country-specific entry wins over "*", and
     when geo resolution is unavailable (no handler) or no tier matches, no
     geo limit applies and the request falls through to the global limit.
     The tier counts per IP and endpoint, like every other endpoint-scoped
     tier. */
  private async checkGeoRateLimit(
    request: GuardRequest,
    clientIp: string,
    routeConfig: RouteConfig | null,
  ): Promise<GuardResponse | null> {
    const limits = routeConfig?.geoRateLimits;
    if (!limits || Object.keys(limits).length === 0) return null;

    const geoHandler = this.middleware.geoIpHandler;
    if (!geoHandler) return null;

    const country = geoHandler.getCountry(clientIp);
    let tier: [number, number] | undefined;
    if (country !== null && country in limits) {
      tier = limits[country];
    } else if ('*' in limits) {
      tier = limits['*'];
    }
    if (!tier) return null;

    const [limit, window] = tier;
    return this.applyRateLimitCheck(
      request, clientIp, limit, window,
      'decorator_violation',
      `Geo rate limit exceeded for ${country ?? 'unknown'}: ${limit} requests per ${window}s`,
      request.urlPath,
    );
  }
}
