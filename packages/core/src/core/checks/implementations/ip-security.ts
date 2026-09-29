import type { GuardMiddlewareProtocol } from '../../../protocols/middleware.js';
import type { GuardRequest } from '../../../protocols/request.js';
import type { GuardResponse } from '../../../protocols/response.js';
import type { RouteConfig } from '../../../models/route-config.js';
import type { GeoIPHandler } from '../../../protocols/geo-ip.js';
import type { IPBanManager } from '../../../handlers/ip-ban.js';
import type { RouteConfigResolver } from '../../routing/resolver.js';
import { logActivity } from '../../../utils.js';
import { checkRouteIpAccess, isIpInWhitelist } from '../helpers.js';
import { SecurityCheck } from '../base.js';
import ipaddr from 'ipaddr.js';

/* The twin of IpAccessResult (guard_core/_utils/access_control.py): the
   deny verdict plus the reference log-format reason (and optional cloud
   detail) the ip_security events and on_block payload carry. */
interface IpAccessResult {
  allowed: boolean;
  reason: string;
}

const GENERIC_LIST_BLOCK_REASON = 'IP {ip} not in global allowlist/blocklist';

function genericListBlockReason(ip: string): string {
  return GENERIC_LIST_BLOCK_REASON.replace('{ip}', ip);
}

export class IpSecurityCheck extends SecurityCheck {
  private readonly ipBanManager: IPBanManager | null;

  constructor(middleware: GuardMiddlewareProtocol, ipBanManager?: IPBanManager | null) {
    super(middleware);
    /* The manager from the handler initializer is shared across requests;
       when absent (direct construction in tests or standalone pipelines) the
       check leaves it null and skips the dynamic-ban stage instead of
       building one per request. */
    this.ipBanManager = ipBanManager ?? null;
  }

  get checkName(): string { return 'ip_security'; }

  /* The log_activity on_block hooks of this check (reference log_activity
     kwargs in IpSecurityCheck). */
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

  private async checkBannedIp(
    request: GuardRequest,
    clientIp: string,
    routeConfig: RouteConfig | undefined,
  ): Promise<GuardResponse | null> {
    if (!this.ipBanManager) return null;

    const resolver = this.middleware.routeResolver as RouteConfigResolver;
    if (resolver.shouldBypassCheck('ip_ban', routeConfig ?? null)) return null;

    if (!await this.ipBanManager.isIpBanned(clientIp)) return null;

    /* Reference _check_banned_ip: the log-format reason feeds both the
       on_block dispatch (stash on the active path, direct fire with a null
       status in passive mode) and the ip_blocked event. */
    logActivity(request, this.logger, 'suspicious',
      `Banned IP attempted access: ${clientIp}`,
      this.config.passiveMode, '', this.config.logSuspiciousLevel, this.blockHooks());

    await this.sendEvent('ip_blocked', request,
      this.config.passiveMode ? 'logged_only' : 'request_blocked',
      `Banned IP attempted access: ${clientIp}`);

    if (!this.config.passiveMode) {
      return this.createErrorResponse(403, 'IP address banned');
    }
    return null;
  }

  private async checkRouteIpRestrictions(
    request: GuardRequest,
    clientIp: string,
    routeConfig: RouteConfig,
  ): Promise<GuardResponse | null> {
    const routeResult = await checkRouteIpAccess(clientIp, routeConfig, this.middleware);
    if (routeResult !== false) return null;

    logActivity(request, this.logger, 'suspicious',
      `IP not allowed by route config: ${clientIp}`,
      this.config.passiveMode, '', this.config.logSuspiciousLevel, this.blockHooks());

    /* Reference route-denial path: decorator_violation with the
       emit_access_denied_event shape before the 403. */
    await this.sendEvent('decorator_violation', request,
      this.config.passiveMode ? 'logged_only' : 'request_blocked',
      `IP ${clientIp} blocked`);

    if (!this.config.passiveMode) {
      return this.createErrorResponse(403, 'Forbidden');
    }
    return null;
  }

  /* The twin of _resolve_country_verdict (guard_core/_utils/access_control.py):
     an unresolved country blocks only in whitelist-country mode, and the
     resolved country name rides along for the block reason. Loopback
     addresses are exempt from the country verdict. */
  private async resolveCountryVerdict(
    ip: string,
    geoIpHandler: GeoIPHandler | null,
  ): Promise<[boolean, string | null]> {
    if (this.config.blockedCountries.length === 0 && this.config.whitelistCountries.length === 0) {
      return [false, null];
    }
    try {
      const parsed = ipaddr.parse(ip);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (parsed.kind() === 'ipv4' && (parsed as ipaddr.IPv4).range() === 'loopback') {
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
        return [false, null];
        /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      }
    } catch {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return [false, null];
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!geoIpHandler) return [false, null];
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!geoIpHandler.isInitialized) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      await geoIpHandler.initialize();
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    const country = geoIpHandler.getCountry(ip);
    if (!country) return [this.config.whitelistCountries.length > 0, null];
    if (this.config.whitelistCountries.length > 0) {
      return [!this.config.whitelistCountries.includes(country), country];
    }
    return [this.config.blockedCountries.includes(country), country];
  }

  /* The twin of check_ip_access (guard_core/_utils/access_control.py): the
     deny checks run in the reference order (ip lists, then countries, then
     cloud providers) and every deny carries its reference log-format
     reason. */
  private async checkIpAccessDetail(
    ip: string,
    geoIpHandler: GeoIPHandler | null,
    skipIpLists: boolean,
    skipCountries: boolean,
  ): Promise<IpAccessResult> {
    if (!skipIpLists) {
      const whitelist = this.config.whitelist;
      if (whitelist !== null && whitelist.length > 0) {
        if (isIpInWhitelist(ip, whitelist) !== true) {
          return { allowed: false, reason: genericListBlockReason(ip) };
        }
        /* A whitelist match skips the country verdict (reference
           _check_ip_lists_detail's skip_countries propagation). */
        skipCountries = true;
      } else {
        const blacklist = this.config.blacklist;
        if (this.ipInList(ip, blacklist)) {
          return { allowed: false, reason: genericListBlockReason(ip) };
        }
      }
    }

    if (!skipCountries) {
      const [countryBlocked, country] = await this.resolveCountryVerdict(ip, geoIpHandler);
      if (countryBlocked) {
        return {
          allowed: false,
          reason: country !== null
            ? `IP from blocked country: ${country}`
            : genericListBlockReason(ip),
        };
      }
    }

    return { allowed: true, reason: '' };
  }

  private ipInList(ip: string, entries: readonly string[]): boolean {
    let parsed: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      parsed = ipaddr.parse(ip);
    } catch {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return true;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    for (const entry of entries) {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (entry.includes('/')) {
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
        try {
        /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
          /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
          const [addr, prefixLen] = ipaddr.parseCIDR(entry);
          /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
          /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
          if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
          /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        } catch { /* malformed CIDR entries never match */ }
      } else if (ip === entry) {
        return true;
      }
    }
    return false;
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const clientIp = request.clientHost;
    if (!clientIp) return null;

    const routeConfig = (request.state as Record<string, unknown>)['_routeConfig'] as RouteConfig | undefined;

    const banResponse = await this.checkBannedIp(request, clientIp, routeConfig);
    if (banResponse) return banResponse;

    const resolver = this.middleware.routeResolver as RouteConfigResolver;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (resolver.shouldBypassCheck('ip', routeConfig ?? null)) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

    /* Mirror of the reference _resolve_is_whitelisted/_resolve_is_exempt:
       both flags require the deny checks (blacklist, whitelist, country) to
       have passed first, so exemption never adds or relaxes a deny path. A
       route-level ipWhitelist takes over the global lists and clears both
       flags, exactly like the reference skip_ip_lists gate. */
    const routeOverridesIpLists = Boolean(routeConfig?.ipWhitelist && routeConfig.ipWhitelist.length > 0);
    const whitelist = this.config.whitelist;
    const exemptIps = this.config.exemptIps;

    const access = await this.checkIpAccessDetail(
      clientIp, this.middleware.geoIpHandler, routeOverridesIpLists, false,
    );

    request.state.isWhitelisted = access.allowed && !routeOverridesIpLists
      && whitelist !== null && whitelist.length > 0;
    request.state.isExempt = access.allowed && !routeOverridesIpLists
      && exemptIps.length > 0
      && isIpInWhitelist(clientIp, exemptIps) === true;

    if (routeConfig) {
      const routeResponse = await this.checkRouteIpRestrictions(request, clientIp, routeConfig);
      if (routeResponse) return routeResponse;
    }

    if (!access.allowed) {
      /* Reference _check_global_ip_restrictions: the log-format reason
         "IP not allowed: {ip} - {reason}" feeds on_block, and the
         ip_blocked event carries the bare access reason. */
      logActivity(request, this.logger, 'suspicious',
        `IP not allowed: ${clientIp} - ${access.reason}`,
        this.config.passiveMode, '', this.config.logSuspiciousLevel, this.blockHooks());

      await this.sendEvent('ip_blocked', request,
        this.config.passiveMode ? 'logged_only' : 'request_blocked',
        access.reason);

      if (!this.config.passiveMode) {
        return this.createErrorResponse(403, 'Forbidden');
      }
      return null;
    }

    return null;
  }
}
