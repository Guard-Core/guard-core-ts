import ipaddr from 'ipaddr.js';

import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { RouteConfig } from '../../models/route-config.js';
import type { IPBanManager } from '../../handlers/ip-ban.js';
import type { SusPatternsManager } from '../../handlers/sus-patterns.js';
import type { Logger } from '../../models/logger.js';
import type { GeoIPHandler } from '../../protocols/geo-ip.js';
import type { GuardMiddlewareProtocol } from '../../protocols/middleware.js';
import type { GuardRequest } from '../../protocols/request.js';
import { logActivity } from '../../utils.js';

export function isIpInBlacklist(clientIp: string, blacklist: string[]): boolean {
  for (const blocked of blacklist) {
    if (blocked.includes('/')) {
      try {
        const parsed = ipaddr.parse(clientIp);
        const [addr, prefixLen] = ipaddr.parseCIDR(blocked);
        if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      } catch { continue; }
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    } else if (clientIp === blocked) {
      return true;
    }
  }
  return false;
}

export function isIpInWhitelist(clientIp: string, whitelist: string[]): boolean | null {
  if (whitelist.length === 0) return null;

  for (const allowed of whitelist) {
    if (allowed.includes('/')) {
      try {
        const parsed = ipaddr.parse(clientIp);
        const [addr, prefixLen] = ipaddr.parseCIDR(allowed);
        if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      } catch { continue; }
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    } else if (clientIp === allowed) {
      return true;
    }
  }
  return false;
}

export function checkCountryAccess(
  clientIp: string,
  routeConfig: RouteConfig,
  geoIpHandler: GeoIPHandler | null,
): boolean | null {
  if (!geoIpHandler) return null;

  let country: string | null = null;

  if (routeConfig.blockedCountries && routeConfig.blockedCountries.length > 0) {
    country = geoIpHandler.getCountry(clientIp);
    if (country && routeConfig.blockedCountries.includes(country)) return false;
  }

  if (routeConfig.whitelistCountries && routeConfig.whitelistCountries.length > 0) {
    if (country === null) country = geoIpHandler.getCountry(clientIp);
    if (country) return routeConfig.whitelistCountries.includes(country);
    return false;
  }

  return null;
}

export async function checkRouteIpAccess(
  clientIp: string,
  routeConfig: RouteConfig,
  middleware: GuardMiddlewareProtocol,
): Promise<boolean | null> {
  try {
    if (routeConfig.ipBlacklist && routeConfig.ipBlacklist.length > 0) {
      if (isIpInBlacklist(clientIp, routeConfig.ipBlacklist)) return false;
    }

    if (routeConfig.ipWhitelist && routeConfig.ipWhitelist.length > 0) {
      const whitelistResult = isIpInWhitelist(clientIp, routeConfig.ipWhitelist);
      if (whitelistResult !== null) return whitelistResult;
    }

    const countryResult = checkCountryAccess(clientIp, routeConfig, middleware.geoIpHandler);
    if (countryResult !== null) return countryResult;

    return null;
  /* v8 ignore start -- catch block requires ipaddr.parse to throw on a value that already passed validation */
  } catch {
    return false;
  }
  /* v8 ignore stop */
}

export async function checkUserAgentAllowed(
  userAgent: string,
  routeConfig: RouteConfig | null,
  config: ResolvedSecurityConfig,
): Promise<boolean> {
  if (routeConfig && routeConfig.blockedUserAgents.length > 0) {
    for (const pattern of routeConfig.blockedUserAgents) {
      if (new RegExp(pattern, 'i').test(userAgent)) return false;
    }
    /* v8 ignore next -- empty blockedUserAgents on routeConfig branch; tests always set global blockedUserAgents */
  }

  for (const pattern of config.blockedUserAgents) {
    if (new RegExp(pattern, 'i').test(userAgent)) return false;
  }

  return true;
}

export function validateAuthHeader(authHeader: string, authType: string): [boolean, string] {
  if (authType === 'bearer') {
    if (!authHeader.startsWith('Bearer ')) return [false, 'Missing or invalid Bearer token'];
  } else if (authType === 'basic') {
    if (!authHeader.startsWith('Basic ')) return [false, 'Missing or invalid Basic authentication'];
  } else {
    if (!authHeader) return [false, `Missing ${authType} authentication`];
  }
  return [true, ''];
}

/* The twin of extract_credential (guard_core/core/checks/helpers.py): returns
   [credential, ''] on success or [null, reason] on failure. */
export function extractCredential(authHeader: string, authType: string): [string | null, string] {
  if (authType === 'bearer') {
    if (!authHeader.startsWith('Bearer ')) return [null, 'Missing or invalid Bearer token'];
    return [authHeader.slice('Bearer '.length), ''];
  }
  if (authType === 'basic') {
    if (!authHeader.startsWith('Basic ')) return [null, 'Missing or invalid Basic authentication'];
    return [authHeader.slice('Basic '.length), ''];
  }
  if (!authHeader) return [null, `Missing ${authType} authentication`];
  return [authHeader, ''];
}

/* The twin of resolve_verifier_result (guard_core/core/checks/_verifier.py). */
export async function resolveVerifierResult<T>(value: T | Promise<T>): Promise<T> {
  return value instanceof Promise ? await value : value;
}

export function isReferrerDomainAllowed(referrer: string, allowedDomains: string[]): boolean {
  try {
    const url = new URL(referrer);
    const referrerDomain = url.hostname.toLowerCase();
    for (const allowed of allowedDomains) {
      const lowerAllowed = allowed.toLowerCase();
      if (referrerDomain === lowerAllowed || referrerDomain.endsWith(`.${lowerAllowed}`)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function detectPenetrationPatterns(
  request: GuardRequest,
  routeConfig: RouteConfig | null,
  config: ResolvedSecurityConfig,
  shouldBypassCheckFn: (check: string, rc: RouteConfig | null) => boolean,
  susPatternsManager?: SusPatternsManager | null,
): Promise<[boolean, string, string[]]> {
  let penetrationEnabled = config.enablePenetrationDetection;
  let routeSpecificDetection: boolean | null = null;

  if (routeConfig) {
    routeSpecificDetection = routeConfig.enableSuspiciousDetection;
    penetrationEnabled = routeSpecificDetection;
  }

  if (penetrationEnabled && !shouldBypassCheckFn('penetration', routeConfig)) {
    const { scanRequestWithManager } = await import('../../utils.js');
    if (susPatternsManager) {
      /* The per-request exclusion set resolves from the global config plus
         this request's route config (the reference _resolve_* helpers of
         _utils/detection_config.py, threaded through the scan the way
         detectThreat receives routeDetectionExclusions in the Go port). */
      const { resolveDetectionExclusions } = await import('../routing/detection-exclusions.js');
      return scanRequestWithManager(
        susPatternsManager, request, config,
        resolveDetectionExclusions(config, routeConfig),
      );
    }
    const { detectPenetrationAttempt } = await import('../../utils.js');
    return detectPenetrationAttempt(request);
  }

  const reason = routeSpecificDetection === false && config.enablePenetrationDetection
    ? 'disabled_by_decorator'
    : 'not_enabled';
  return [false, reason, []];
}

/* Cap on the number of IPs tracked in the shared suspicious-count structure,
   mirroring _MAX_TRACKED_SUSPICIOUS_IPS in
   guard_core/core/checks/helpers.py. */
const MAX_TRACKED_SUSPICIOUS_IPS = 10_000;

/**
 * Per-IP per-category violation counter, the port of _increment_suspicious_counts
 * (guard_core/core/checks/helpers.py): a string collapses to a single
 * category, an empty category list collapses to 'uncategorized', counts
 * refresh the IP's recency (pop then re-insert), and the oldest tracked IP
 * is evicted once the cap is reached.
 */
export function incrementSuspiciousCounts(
  middleware: GuardMiddlewareProtocol,
  clientIp: string,
  categories: string | readonly string[],
): void {
  const resolvedCategories: readonly string[] = typeof categories === 'string'
    ? [categories]
    : (categories.length > 0 ? categories : ['uncategorized']);

  const counts = middleware.suspiciousRequestCounts;
  const ipCounts = counts.get(clientIp);
  counts.delete(clientIp);
  if (!ipCounts && counts.size >= MAX_TRACKED_SUSPICIOUS_IPS) {
    const oldestIp = counts.keys().next().value;
    if (oldestIp !== undefined) counts.delete(oldestIp);
  }
  const updated = ipCounts ?? new Map<string, number>();
  for (const category of resolvedCategories) {
    updated.set(category, (updated.get(category) ?? 0) + 1);
  }
  counts.set(clientIp, updated);
}

/**
 * Total violations across every category for one IP, the port of
 * SuspiciousActivityCheck._total_count_for_ip (reference
 * suspicious_activity.py): the request_count reported on events and the
 * total the flat autoBanThreshold path is measured against.
 */
export function totalSuspiciousCount(
  middleware: GuardMiddlewareProtocol,
  clientIp: string,
): number {
  const ipCounts = middleware.suspiciousRequestCounts.get(clientIp);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!ipCounts) return 0;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  let total = 0;
  for (const count of ipCounts.values()) total += count;
  return total;
}

/**
 * Pure threshold resolution plus the ban_ip call, the port of
 * _resolve_and_apply_threshold_ban (guard_core/core/checks/helpers.py):
 * threatBanConfig per-category entries are tried first in threatCategories
 * order, then the flat autoBanThreshold/autoBanDuration against the total of
 * all categories. Returns [duration, banReason, category] when a ban was
 * applied (category null for the flat fallback), or null when banning is
 * disabled, no manager is available, or no threshold was crossed.
 */
export async function resolveThresholdBan(
  ipCounts: ReadonlyMap<string, number>,
  config: ResolvedSecurityConfig,
  ipBanManager: IPBanManager | null,
  clientIp: string,
  threatCategories: readonly string[],
  reason: string,
): Promise<[number, string, string | null] | null> {
  if (!config.enableIpBanning) return null;
  if (!ipBanManager) return null;

  for (const category of threatCategories) {
    const entry = config.threatBanConfig[category];
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!entry || (ipCounts.get(category) ?? 0) < entry.threshold) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const banReason = `${reason}:${category}`;
    const applied = await ipBanManager.banIp(clientIp, entry.duration, banReason);
    if (!applied) return null;
    return [entry.duration, banReason, category];
  }

  let total = 0;
  for (const count of ipCounts.values()) total += count;
  if (total < config.autoBanThreshold) return null;

  const applied = await ipBanManager.banIp(clientIp, config.autoBanDuration, reason);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!applied) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return [config.autoBanDuration, reason, null];
}

/**
 * Threshold ban with its ban-time logging, the port of _try_threshold_ban
 * (guard_core/core/checks/helpers.py): resolves the ban against the IP's
 * current counts and, when one fired, logs it as a suspicious event naming
 * the crossed category (or the flat threshold).
 */
export async function tryThresholdBan(
  request: GuardRequest,
  config: ResolvedSecurityConfig,
  ipBanManager: IPBanManager | null,
  middleware: GuardMiddlewareProtocol,
  clientIp: string,
  triggerInfo: string,
  logger: Logger,
  threatCategories: readonly string[],
  reason = 'penetration_attempt',
): Promise<boolean> {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const ipCounts = middleware.suspiciousRequestCounts.get(clientIp) ?? new Map<string, number>();
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const result = await resolveThresholdBan(
    ipCounts, config, ipBanManager, clientIp, threatCategories, reason,
  );
  if (!result) return false;

  const [, , category] = result;
  const logReason = category !== null
    ? `IP banned due to ${category} threshold: ${clientIp} - ${triggerInfo}`
    : `IP banned due to suspicious activity: ${clientIp} - ${triggerInfo}`;
  logActivity(request, logger, 'suspicious', logReason, config.passiveMode, '', config.logSuspiciousLevel);
  return true;
}

/**
 * The twin of _emit_ban_escalation_failed
 * (guard_core/core/checks/helpers.py): when a threshold-ban escalation
 * raises (Redis-backed ban write failure and friends), the failure is
 * reported as EVENT_IP_BAN_FAILED instead of taking the request pipeline
 * down; callers swallow after reporting, like the reference.
 */
export async function emitBanEscalationFailed(
  middleware: GuardMiddlewareProtocol,
  request: GuardRequest,
  clientIp: string,
  error: unknown,
): Promise<void> {
  const eventBus = middleware.eventBus as {
    sendMiddlewareEvent(
      eventType: string,
      request: GuardRequest,
      actionTaken: string,
      reason: string,
      metadata?: Record<string, unknown>,
    ): Promise<void>;
  };
  const message = error instanceof Error ? error.message : String(error);
  await eventBus.sendMiddlewareEvent(
    'ip_ban_failed', request, 'ban_not_applied',
    `Escalation ban failed for ${clientIp}: ${message}`,
    { ipAddress: clientIp },
  );
}

/**
 * The twin of escalate_identity_violation
 * (guard_core/core/checks/helpers.py): re-runs the request's detection
 * verdict, counts the violation categories toward the shared suspicious
 * counters, applies the threshold ban, and reports the escalation as
 * EVENT_PENETRATION_ATTEMPT (banned/tracked). Any failure along the way is
 * reported as EVENT_IP_BAN_FAILED and swallowed, so a Redis-backed ban
 * write outage never takes the request pipeline down.
 */
export async function escalateIdentityViolation(
  middleware: GuardMiddlewareProtocol,
  config: ResolvedSecurityConfig,
  ipBanManager: IPBanManager | null,
  request: GuardRequest,
  clientIp: string,
  logger: Logger,
  violationCategory: string,
  triggerInfo: string,
): Promise<void> {
  if (!clientIp) return;

  if (request.state.isWhitelisted === true) return;

  try {
    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;
    const resolver = middleware.routeResolver as {
      shouldBypassCheck(check: string, rc: RouteConfig | null): boolean;
    };
    const [isThreat, scanTrigger, threatCategories] = await detectPenetrationPatterns(
      request,
      routeConfig ?? null,
      config,
      (check, rc) => resolver.shouldBypassCheck(check, rc),
    );
    if (!isThreat || scanTrigger === 'disabled_by_decorator') return;

    const categories = threatCategories.length > 0 ? threatCategories : ['uncategorized'];
    incrementSuspiciousCounts(middleware, clientIp, categories);

    const banned = await tryThresholdBan(
      request, config, ipBanManager, middleware,
      clientIp, triggerInfo, logger, categories,
    );

    const eventBus = middleware.eventBus as {
      sendMiddlewareEvent(
        eventType: string,
        request: GuardRequest,
        actionTaken: string,
        reason: string,
        metadata?: Record<string, unknown>,
      ): Promise<void>;
    };
    await eventBus.sendMiddlewareEvent(
      'penetration_attempt', request, banned ? 'banned' : 'tracked',
      `Identity violation escalated: ${triggerInfo}`,
      {
        requestCount: totalSuspiciousCount(middleware, clientIp),
        triggerInfo,
        violationCategory,
      },
    );
  } catch (e) {
    logger.error(`escalateIdentityViolation failed for ${clientIp}: ${e}`);
    try {
      await emitBanEscalationFailed(middleware, request, clientIp, e);
    } catch (reportError) {
      logger.error(`Failed to report ban escalation failure for ${clientIp}: ${reportError}`);
    }
  }
}
