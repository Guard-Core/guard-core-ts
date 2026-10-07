import ipaddr from 'ipaddr.js';

import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { GeoIPHandler } from '../../protocols/geo-ip.js';
import { UNKNOWN_CLIENT_IDENTITY } from '../client-identity.js';
import { checkIpCountry } from '../../utils.js';
import type { CloudHandler } from '../../handlers/cloud.js';

/* The standalone detailed IP-access verdict (the TS port of check_ip_access,
   guard_core/_utils/access_control.py): the full allow/block answer with
   the block reason and, for cloud-provider denials, the provider and
   network - the shape isIpAllowed (the is_ip_allowed twin) computes and
   discards. Exported from the package root like the reference
   guard_core.utils surface.

   Error semantics mirror the reference try/except: an unparseable ip or a
   malformed list entry lands in the ValueError arm (blocked with the
   generic reason - the reference ip_network(strict=False) raise), and no
   other failure mode can turn a clean ip into a block.

   The reference resolves cloud providers through the CloudManager
   singleton; the TS engine has no singletons, so the cloud tier takes the
   handler as an argument (the reference's singleton read becomes an
   injected CloudHandler). */

export interface IpAccessResult {
  allowed: boolean;
  reason: string;
  cloudProvider: string | null;
  network: string | null;
}

function allowedResult(): IpAccessResult {
  return { allowed: true, reason: '', cloudProvider: null, network: null };
}

function blockedResult(reason: string): IpAccessResult {
  return { allowed: false, reason, cloudProvider: null, network: null };
}

function genericListBlockReason(ip: string): string {
  return `IP ${ip} not in global allowlist/blocklist`;
}

function ipInList(parsed: ipaddr.IPv4 | ipaddr.IPv6, ip: string, entries: readonly string[]): boolean {
  for (const entry of entries) {
    if (entry.includes('/')) {
      const [addr, prefixLen] = ipaddr.parseCIDR(entry);
      if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
    } else if (ip === entry) {
      return true;
    }
  }
  return false;
}

/* The cloud-provider detail tier (the _check_cloud_providers_detail twin). */
function checkCloudProvidersDetail(
  ip: string,
  config: ResolvedSecurityConfig,
  cloudHandler: CloudHandler | null | undefined,
): IpAccessResult | null {
  if (!cloudHandler || config.blockCloudProviders.size === 0) return null;
  if (!cloudHandler.isCloudIp(ip, config.blockCloudProviders)) return null;

  const details = cloudHandler.getCloudProviderDetails(ip, config.blockCloudProviders);
  if (details === null) return blockedResult(genericListBlockReason(ip));

  const [provider, network] = details;
  return {
    allowed: false,
    reason: `IP belongs to blocked cloud provider: ${provider}`,
    cloudProvider: provider,
    network,
  };
}

/* The unknown-identity tier (the _check_unknown_identity_access twin): an
   unknown client identity only blocks when an allowlist tier is active. */
function checkUnknownIdentityAccess(
  ip: string,
  config: ResolvedSecurityConfig,
  skipIpLists: boolean,
  skipCountries: boolean,
): IpAccessResult | null {
  if (ip !== UNKNOWN_CLIENT_IDENTITY) return null;
  const whitelistBlocks = !skipIpLists && (config.whitelist?.length ?? 0) > 0;
  const countryWhitelistBlocks = !skipCountries && config.whitelistCountries.length > 0;
  if (whitelistBlocks || countryWhitelistBlocks) {
    return blockedResult(genericListBlockReason(ip));
  }
  return allowedResult();
}

export async function checkIpAccess(
  ip: string,
  config: ResolvedSecurityConfig,
  geoIpHandler?: GeoIPHandler | null,
  cloudHandler?: CloudHandler | null,
  options?: { skipIpLists?: boolean; skipCountries?: boolean },
): Promise<IpAccessResult> {
  const skipIpLists = options?.skipIpLists ?? false;
  const skipCountries = options?.skipCountries ?? false;

  const unknown = checkUnknownIdentityAccess(ip, config, skipIpLists, skipCountries);
  if (unknown !== null) return unknown;

  let skipCountryVerdict = skipCountries;

  try {
    const parsed = ipaddr.parse(ip);

    if (!skipIpLists) {
      if (config.whitelist && config.whitelist.length > 0) {
        if (!ipInList(parsed, ip, config.whitelist)) {
          return blockedResult(genericListBlockReason(ip));
        }
        /* A whitelist match skips the country verdict (the reference
           _check_ip_lists_detail's skip_countries propagation). */
        skipCountryVerdict = true;
      } else if (ipInList(parsed, ip, config.blacklist)) {
        return blockedResult(genericListBlockReason(ip));
      }
    }

    if (!skipCountryVerdict) {
      if (
        (config.blockedCountries.length > 0 || config.whitelistCountries.length > 0)
        && geoIpHandler
      ) {
        const countryBlocked = await checkIpCountry(ip, config, geoIpHandler);
        if (countryBlocked) {
          const country = geoIpHandler.getCountry(ip);
          return blockedResult(
            country
              ? `IP from blocked country: ${country}`
              : genericListBlockReason(ip),
          );
        }
      }
    }

    const cloud = checkCloudProvidersDetail(ip, config, cloudHandler);
    if (cloud !== null) return cloud;

    return allowedResult();
  } catch {
    /* The reference ValueError arm: an unparseable ip or a malformed list
       entry blocks with the generic reason. */
    return blockedResult(genericListBlockReason(ip));
  }
}
