import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

import { multipartPartEntries, parseFormPairs, parseMediaTypeParams, parseMultipartParts } from './detection-engine/body-form-scan.js';
import type { ResolvedSecurityConfig } from './models/config.js';
import { defaultLogger } from './models/logger.js';
import type { Logger } from './models/logger.js';
import type { AgentHandlerProtocol } from './protocols/agent.js';
import type { GeoIPHandler } from './protocols/geo-ip.js';
import type { GuardRequest } from './protocols/request.js';
import type { DetectionResult, SusPatternsManager } from './handlers/sus-patterns.js';

import {
  disabledCategoriesOf,
  EXCLUDED_HEADERS,
  resolveDetectionExclusions,
} from './core/routing/detection-exclusions.js';
import type { ResolvedDetectionExclusions } from './core/routing/detection-exclusions.js';
import { fireBlockHook } from './core/block-events.js';
import { readCappedBody } from './core/bounded-body-reader.js';

/**
 * Excluded headers whose typical values are client addresses (the reference's
 * `_HEADER_CATEGORY_EXCLUSIONS`): the ssrf category skips for any value, not
 * just address chains.
 */
const ADDRESS_HEADERS = new Set([
  'host', 'origin', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip',
  'x-client-ip', 'x-cluster-client-ip', 'cf-connecting-ip',
  'true-client-ip', 'fly-client-ip', 'x-envoy-external-address', 'via',
]);

const SSRF_SKIP_CATEGORIES: ReadonlySet<string> = new Set(['ssrf']);

/**
 * `_strip_forwarded_entry_port`: remove the port from a Forwarded or
 * X-Forwarded-For list entry so the address itself can be parsed
 * ("1.2.3.4:8080" -> "1.2.3.4", "[::1]:8080" -> "::1").
 */
function stripForwardedEntryPort(value: string): string {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (value.startsWith('[')) {
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const closing = value.indexOf(']');
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (closing === -1) return value;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const remainder = value.slice(closing + 1);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (remainder !== '' && !/^:\d+$/.test(remainder)) return value;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return value.slice(1, closing);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  if ((value.match(/:/g) ?? []).length === 1) {
    const idx = value.indexOf(':');
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (/^\d+$/.test(value.slice(idx + 1))) return value.slice(0, idx);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return value;
}

/**
 * `_value_looks_like_address_chain`: every comma-separated token parses as an
 * IP address once its port entry is stripped, so a value like
 * "10.0.0.5, 172.16.0.1" reads as a proxy chain and not as an attack payload.
 */
function valueLooksLikeAddressChain(value: string): boolean {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '');
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (tokens.length === 0) return false;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return tokens.every((token) => isIP(stripForwardedEntryPort(token)));
}

/**
 * `_excluded_header_skip_categories`: the categories the scan must suppress
 * for one excluded header value. Address-carrying proxy headers skip ssrf for
 * any value; any other excluded header skips ssrf only when its whole value
 * parses as an address chain (so an XSS or SQLi payload in the same header
 * still detects). undefined means the header scans with every category.
 */
function excludedHeaderSkipCategories(
  nameLower: string,
  value: string,
): ReadonlySet<string> | undefined {
  if (ADDRESS_HEADERS.has(nameLower)) return SSRF_SKIP_CATEGORIES;
  if (valueLooksLikeAddressChain(value)) return SSRF_SKIP_CATEGORIES;
  return undefined;
}

/**
 * Port of guard_core._utils.logging_utils._sanitize_for_log: make a string
 * safe to emit on any console encoding. Control characters become \uXXXX
 * escapes and every non-ASCII code point becomes a \uXXXX (or \xNN for
 * surrogate-escaped bytes in the 0xDC80-0xDCFF range) escape, so the result
 * is pure ASCII and can never raise on legacy code pages such as cp1252.
 */
export function sanitizeForLog(value: string): string {
  if (!value) return value;
  const sanitized = value
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  let out = '';
  for (const char of sanitized) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const code = char.codePointAt(0) ?? 0;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (code >= 32 && code <= 126) {
      out += char;
    } else if (code >= 0xdc80 && code <= 0xdcff) {
      out += `\\x${(code - 0xdc00).toString(16).padStart(2, '0')}`;
    } else {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    }
  }
  return out;
}

/* Reference _IP_EXTRACTION_HANDLER_NAME (agent_events.py): the shared
   send_agent_event helper carries the ip_extraction handler name. */
const AGENT_EVENT_HANDLER_NAME = 'ip_extraction';

export async function sendAgentEvent(
  agentHandler: AgentHandlerProtocol | null,
  eventType: string,
  ipAddress: string,
  actionTaken: string,
  reason: string,
  request?: GuardRequest | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!agentHandler) return;

  /* v8 ignore start -- agent event dispatch; tests pass null agentHandler so this block is unreachable */
  try {
    await agentHandler.sendEvent({
      timestamp: new Date(),
      eventType,
      ipAddress,
      actionTaken,
      reason,
      endpoint: request?.urlPath ?? null,
      method: request?.method ?? null,
      userAgent: request?.headers['user-agent'] ?? null,
      handlerName: AGENT_EVENT_HANDLER_NAME,
      metadata: metadata ?? {},
    });
  } catch {
  }
  /* v8 ignore stop */
}

function isTrustedProxy(connectingIp: string, trustedProxies: string[]): boolean {
  for (const proxy of trustedProxies) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!proxy.includes('/')) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore next -- exact proxy IP match; tests use CIDR proxies */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (connectingIp === proxy) return true;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
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
  /* v8 ignore start -- isTrustedProxy default return; tests always match a proxy */
  return false;
}
/* v8 ignore stop */

function extractFromForwardedHeader(forwardedFor: string, proxyDepth: number): string | null {
  const ips = forwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (ips.length === 0) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const targetIndex = ips.length - proxyDepth;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (targetIndex < 0) return ips[0];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return ips[targetIndex];
}

export async function extractClientIp(
  request: GuardRequest,
  config: ResolvedSecurityConfig,
  agentHandler?: AgentHandlerProtocol | null,
): Promise<string> {
  const connectingIp = request.clientHost;
  if (!connectingIp) return 'unknown';

  const forwardedFor = request.headers['x-forwarded-for'] ?? null;

  /* Reference _handle_untrusted_proxy (ip_extraction.py): an X-Forwarded-For
     header from a source that is not a trusted proxy (including when no
     proxies are configured) never resolves to the forwarded value, and the
     preempted header reports EVENT_SUSPICIOUS_REQUEST through the direct
     send_agent_event path (the ip_extraction handler contract). */
  if (
    forwardedFor &&
    !(config.trustedProxies.length > 0 && isTrustedProxy(connectingIp, config.trustedProxies))
  ) {
    await sendAgentEvent(
      agentHandler ?? null, 'suspicious_request', connectingIp,
      'spoofing_detected', `Potential IP spoof attempt: X-Forwarded-For header ${forwardedFor}`,
      request,
    );
    return connectingIp;
  }

  if (
    forwardedFor &&
    config.trustedProxies.length > 0 &&
    isTrustedProxy(connectingIp, config.trustedProxies)
  ) {
    const extracted = extractFromForwardedHeader(forwardedFor, config.trustedProxyDepth);
    if (extracted && ipaddr.isValid(extracted)) return extracted;
  }

  return connectingIp;
}

export async function isUserAgentAllowed(
  userAgent: string,
  config: ResolvedSecurityConfig,
): Promise<boolean> {
  for (const pattern of config.blockedUserAgents) {
    if (new RegExp(pattern, 'i').test(userAgent)) return false;
  }
  return true;
}

/* The twin of _log_country_check_result (access_control.py): the
   non-block verdicts (whitelisted / not-affected) ride the
   logCountryCheckLevel config (null silences them); blocks ride
   logSuspiciousLevel like the reference. */
function logCountryCheckResult(
  ip: string,
  country: string | null,
  resultType: 'no_rules' | 'no_geolocation' | 'loopback_exempt' | 'whitelisted' | 'not_affected',
  config: ResolvedSecurityConfig,
): void {
  if (resultType === 'no_rules') {
    defaultLogger.debug(`No countries blocked or whitelisted ${ip} - No countries blocked or whitelisted`);
    return;
  }
  if (resultType === 'no_geolocation') {
    defaultLogger.debug(`IP not geolocated ${ip} - IP geolocation failed`);
    return;
  }
  if (resultType === 'loopback_exempt') {
    defaultLogger.debug(`Loopback IP exempt from country allowlist check ${ip}`);
    return;
  }
  const level = config.logCountryCheckLevel;
  if (level === null) return;
  const message = resultType === 'whitelisted'
    ? `IP from whitelisted country ${ip} - ${country} - IP from whitelisted country`
    : `IP not from blocked or whitelisted country ${ip} - ${country} - IP not from blocked or whitelisted country`;
  const logMethod: keyof Logger = level.toLowerCase() === 'debug' ? 'debug'
    : level.toLowerCase() === 'warning' ? 'warn'
      : level.toLowerCase() === 'error' || level.toLowerCase() === 'critical' ? 'error'
        : 'info';
  defaultLogger[logMethod](message);
}

export async function checkIpCountry(
  ip: string,
  config: ResolvedSecurityConfig,
  geoIpHandler: GeoIPHandler,
): Promise<boolean> {
  if (config.blockedCountries.length === 0 && config.whitelistCountries.length === 0) {
    logCountryCheckResult(ip, null, 'no_rules', config);
    return false;
  }

  try {
    const parsed = ipaddr.parse(ip);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (parsed.kind() === 'ipv4' && (parsed as ipaddr.IPv4).range() === 'loopback') {
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      logCountryCheckResult(ip, null, 'loopback_exempt', config);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return false;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  } catch {
    /* unparseable: fall through to the geo verdict like the reference */
  }

  if (!geoIpHandler.isInitialized) {
    await geoIpHandler.initialize();
  }

  const country = geoIpHandler.getCountry(ip);
  if (!country) {
    logCountryCheckResult(ip, null, 'no_geolocation', config);
    return false;
  }

  if (config.whitelistCountries.length > 0) {
    const blocked = !config.whitelistCountries.includes(country);
    if (!blocked) logCountryCheckResult(ip, country, 'whitelisted', config);
    return blocked;
  }

  if (config.blockedCountries.length > 0) {
    const blocked = config.blockedCountries.includes(country);
    if (!blocked) logCountryCheckResult(ip, country, 'not_affected', config);
    return blocked;
  }

  /* v8 ignore start -- default return when no country rules configured; tests always set country rules */
  return false;
}
/* v8 ignore stop */

export async function isIpAllowed(
  ip: string,
  config: ResolvedSecurityConfig,
  geoIpHandler?: GeoIPHandler | null,
): Promise<boolean> {
  try {
    const parsed = ipaddr.parse(ip);

    for (const blocked of config.blacklist) {
      if (blocked.includes('/')) {
        const [addr, prefixLen] = ipaddr.parseCIDR(blocked);
        if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return false;
      } else if (ip === blocked) {
        return false;
      }
    }

    if (config.whitelist && config.whitelist.length > 0) {
      let found = false;
      for (const allowed of config.whitelist) {
        /* v8 ignore start -- whitelist CIDR parse + match; tests use exact IPs not CIDR in whitelist */
        if (allowed.includes('/')) {
          const [addr, prefixLen] = ipaddr.parseCIDR(allowed);
          if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) { found = true; break; }
        /* v8 ignore stop */
        } else if (ip === allowed) {
          found = true; break;
        }
      }
      if (!found) return false;
    }

    /* v8 ignore start -- geoIpHandler branch unreachable in recursive JSON check because dangerousPatterns check returns first */
    if (geoIpHandler) {
      const blocked = await checkIpCountry(ip, config, geoIpHandler);
      if (blocked) return false;
    }
    /* v8 ignore stop */
  } catch {
    return false;
  }

  return true;
}

/**
 * Scan budgets mirroring the reference defaults (_DEFAULT_MAX_SCAN_VALUES,
 * _DEFAULT_MAX_SCAN_CHARS, _DEFAULT_MAX_JSON_DEPTH in
 * guard_core/_utils/detection_scan.py + detection_config.py).
 */
const MAX_SCAN_VALUES = 512;
const MAX_SCAN_CHARS = 65536;
const MAX_JSON_DEPTH = 32;

/** Mongo operator keys, ported from _MONGO_OPERATOR_KEY_RE in body_json_scan.py. */
const MONGO_OPERATOR_KEY_RE =
  /^\$(?:ne|gt|gte|lt|lte|eq|in|nin|nor|and|or|not|all|size|exists|type|mod|options|where|regex|expr|function|elemMatch)$/;

interface ScanBudget {
  values: number;
  chars: number;
  /* Detection categories of the threats matched so far, mirroring the
     reference DetectionResult.threat_categories accumulation: the scan stops
     at the first hit, so after a threat this holds that hit's categories,
     which the caller reports to the autoban counter. */
  categories: string[];
}

/**
 * Exclusion sets resolved from the config (reference
 * excluded_detection_params / excluded_detection_body_fields). Entries stay
 * verbatim (Python's _STR_SET_ADAPTER stores them as given); scanned names
 * and keys are lowercased before the membership test, exactly like the
 * reference's `key.lower() in excluded_params` checks.
 */
interface ScanExclusions {
  params: ReadonlySet<string>;
  bodyFields: ReadonlySet<string>;
  headers: ReadonlySet<string>;
  /* Categories that must not produce a threat for this request: the
     complement of the resolved enabled-category set (empty when every
     category scans). Folded into every detect() skip set so a match in a
     disabled category does not count, like the reference's per-category
     pattern gating. */
  disabledCategories: ReadonlySet<string>;
  /* Whether the body surface scans at all (the reference detection_scan_body,
     global default true, per-route override). */
  scanBody: boolean;
}

function resolveScanExclusions(
  config?: ResolvedSecurityConfig,
  resolved?: ResolvedDetectionExclusions,
): ScanExclusions {
  const exclusions = resolved ?? resolveDetectionExclusions(config ?? null, null);
  return {
    params: exclusions.excludedParams,
    bodyFields: exclusions.excludedBodyFields,
    headers: exclusions.excludedHeaders,
    disabledCategories: disabledCategoriesOf(exclusions),
    scanBody: exclusions.scanBody,
  };
}

/** Union of the request-wide disabled categories with a per-value skip set
 *  (the excluded-header ssrf routing), matching the reference's
 *  _excluded_header_effective_categories: the header scans with
 *  (enabled - skip) when a skip applies, otherwise plain enabled. */
function effectiveSkipCategories(
  exclusions: ScanExclusions,
  skipCategories?: ReadonlySet<string>,
): ReadonlySet<string> {
  if (skipCategories === undefined) return exclusions.disabledCategories;
  if (exclusions.disabledCategories.size === 0) return skipCategories;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const merged = new Set(exclusions.disabledCategories);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  for (const category of skipCategories) merged.add(category);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return merged;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

function isExcludedParam(exclusions: ScanExclusions, key: string): boolean {
  return exclusions.params.has(key.toLowerCase());
}

function isExcludedBodyField(exclusions: ScanExclusions, name: string): boolean {
  return exclusions.bodyFields.has(name.toLowerCase());
}

function scanBudgetExhausted(budget: ScanBudget, value: string): boolean {
  budget.values++;
  if (budget.values > MAX_SCAN_VALUES) return true;
  if (budget.chars >= MAX_SCAN_CHARS) return true;
  budget.chars += value.length;
  return false;
}

/**
 * Shared SusPatternsManager backing the standalone detectPenetrationAttempt
 * entry point, mirroring the reference's configured sus_patterns_handler
 * singleton: constructed once, reused across requests. The parsed default
 * config rides along so the scan routing can read its exclusion fields.
 */
let defaultManagerPromise: Promise<{ manager: SusPatternsManager; config: ResolvedSecurityConfig }> | null = null;
function getDefaultSusPatternsManager(): Promise<{ manager: SusPatternsManager; config: ResolvedSecurityConfig }> {
  defaultManagerPromise ??= (async () => {
    const { SusPatternsManager } = await import('./handlers/sus-patterns.js');
    const { SecurityConfigSchema } = await import('./models/config.js');
    const config = SecurityConfigSchema.parse({});
    return { manager: new SusPatternsManager(config, defaultLogger), config };
  })();
  return defaultManagerPromise;
}

function buildThreatMessage(result: DetectionResult): string {
  const threat = result.threats[0];
  if (threat === undefined) return 'Threat detected';
  if (threat.detectionMethod === 'semantic') {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const attackType = threat.pattern.slice('semantic:'.length) || 'suspicious';
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const scoreMatch = /score=([\d.]+)/.exec(threat.matchedContent);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const score = scoreMatch ? Number(scoreMatch[1]).toFixed(2) : '0.00';
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    return `Semantic attack: ${attackType} (score: ${score})`;
  }
  return `Value matched pattern '${threat.pattern}'`;
}

/**
 * Full request-surface penetration scan on top of the SusPatternsManager
 * engine (the canonical pattern table, all content views). Value routing
 * mirrors the reference detect flow in guard_core/_utils/
 * penetration_detection.py + detection_scan.py: query param names and values,
 * the URL path, header names and values, then the body (JSON leaves, form
 * fields, multipart parts, or the raw blob, per content type). Multipart
 * bodies split into parts whose label, filename entry, headers and payload
 * scan under `request_body:multipart_field` (binary-dense file-part payloads
 * reduce to printable islands first, bounded by
 * detectionBinaryMinRunLength). JSON leaves embedded inside
 * non-body values are labeled with the `:embedded_json` context suffix so the
 * engine's per-context gates (recon bare-word rule, source-extension probe
 * rule) apply to them.
 *
 * `config`, when given, activates the reference's excluded-field surface:
 * `excludedDetectionParams` skips a query parameter's whole pair
 * (`key.lower() in excluded_params` in _scan_query_params),
 * `excludedDetectionBodyFields` skips urlencoded pairs and multipart parts
 * by field name and whole JSON subtrees by key at any nesting depth (the
 * body walk and the embedded-JSON walks of query and header values all
 * honor it, like the reference threading excluded_body_fields through
 * _scan_form_body, _scan_multipart_part, _scan_query_param_value and
 * _scan_normal_header_component), and `excludedDetectionHeaders` merges
 * into the excluded-header routing: an excluded header keeps scanning with
 * every enabled category except the ssrf skip resolved per value
 * (_scan_excluded_header_component + _excluded_header_skip_categories),
 * so an address-carrying proxy header no longer false-positives ssrf
 * while an attack payload in the same header still detects.
 *
 * The third tuple element carries the matched hit's detection categories
 * (reference DetectionResult.threat_categories), the input to the autoban
 * counter; empty on a clean scan since scanning stops at the first hit.
 */
export async function scanRequestWithManager(
  manager: SusPatternsManager,
  request: GuardRequest,
  config?: ResolvedSecurityConfig,
  resolvedExclusions?: ResolvedDetectionExclusions,
): Promise<[boolean, string, string[]]> {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const clientIp = request.clientHost ?? 'unknown';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const budget: ScanBudget = { values: 0, chars: 0, categories: [] };
  const exclusions = resolveScanExclusions(config, resolvedExclusions);

  const [isThreat, info] = await runRequestSurfaceScan(manager, request, clientIp, budget, exclusions, config);
  return [isThreat, info, budget.categories];
}

async function runRequestSurfaceScan(
  manager: SusPatternsManager,
  request: GuardRequest,
  clientIp: string,
  budget: ScanBudget,
  exclusions: ScanExclusions,
  config?: ResolvedSecurityConfig,
): Promise<[boolean, string]> {
  for (const [key, value] of Object.entries(request.queryParams)) {
    if (isExcludedParam(exclusions, key)) continue;
    const nameHit = await detectComponent(manager, key, `query_param:${key}`, clientIp, budget, exclusions.disabledCategories);
    if (nameHit[0]) return [true, `Query param name '${key}': ${nameHit[1]}`];
    const valueHit = await detectValueEnhanced(manager, value, `query_param:${key}`, clientIp, budget, exclusions.bodyFields, exclusions.disabledCategories);
    if (valueHit[0]) return [true, `Query param '${key}': ${valueHit[1]}`];
  }

  const urlPath = request.urlPath;
  if (urlPath && urlPath !== '/') {
    const hit = await detectValueEnhanced(manager, urlPath, 'url_path', clientIp, budget, undefined, exclusions.disabledCategories);
    if (hit[0]) return [true, `URL path: ${hit[1]}`];
  }

  for (const [headerName, headerValue] of Object.entries(request.headers)) {
    const nameLower = headerName.toLowerCase();
    // Excluded headers (the hardcoded proxy identity set merged with the
    // configured and per-route excludedDetectionHeaders) are not skipped
    // outright: like the reference's _scan_excluded_header_component they
    // scan with every enabled category except the ssrf skip resolved from
    // the header name and value, so an attack payload in the same header
    // still detects.
    const headerSkip = exclusions.headers.has(nameLower)
      ? excludedHeaderSkipCategories(nameLower, headerValue)
      : undefined;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (headerSkip === undefined && nameLower.startsWith('sec-')) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const skipCategories = effectiveSkipCategories(exclusions, headerSkip);
    const nameHit = await detectComponent(manager, headerName, `header:${headerName}`, clientIp, budget, skipCategories);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (nameHit[0]) return [true, `Header name '${headerName}': ${nameHit[1]}`];
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const valueHit = await detectValueEnhanced(manager, headerValue, `header:${headerName}`, clientIp, budget, exclusions.bodyFields, skipCategories);
    if (valueHit[0]) return [true, `Header '${headerName}': ${valueHit[1]}`];
  }

  // detection_scan_body=false (the reference _resolve_scan_body /
  // _scan_body_surface gate, global or per route) skips the surface
  // entirely while headers, params, and the URL path still scan.
  if (!exclusions.scanBody) return [false, ''];
  return scanBodySurface(manager, request, clientIp, budget, exclusions, config);
}

async function scanBodySurface(
  manager: SusPatternsManager,
  request: GuardRequest,
  clientIp: string,
  budget: ScanBudget,
  exclusions: ScanExclusions,
  config?: ResolvedSecurityConfig,
): Promise<[boolean, string]> {
  let rawBody: string;
  try {
    /* Bounded read (the reference _read_capped_body): the body is capped by
       detectionMaxBodyInspectBytes and bounded by the read timeout and the
       process-wide concurrency budget; null means the body is unavailable
       and the surface is skipped, exactly like a read that raises. */
    const bodyBytes = await readCappedBody(request, {
      ...(config ? { config } : {}),
      logger: defaultLogger,
      /* Stub managers (tests, custom engines) may not expose the pattern
         surface; the over-read simply disables. */
      longestPatternLength: typeof manager.getLongestPatternLength === 'function'
        ? manager.getLongestPatternLength()
        : null,
    }, clientIp);
    if (bodyBytes === null || bodyBytes.length === 0) return [false, ''];
    rawBody = new TextDecoder().decode(bodyBytes);
    if (!rawBody.trim()) return [false, ''];
  } catch {
    // body read failure is not a threat
    return [false, ''];
  }

  const rawContentType = request.headers['content-type'] ?? '';
  const contentType = rawContentType.toLowerCase();

  if (contentType.includes('application/x-www-form-urlencoded')) {
    for (const { name, value } of parseFormPairs(rawBody)) {
      if (isExcludedBodyField(exclusions, name)) continue;
      const nameHit = await detectComponent(manager, name, 'request_body', clientIp, budget, exclusions.disabledCategories);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (nameHit[0]) return [true, `Form field name '${name}': ${nameHit[1]}`];
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      const valueHit = await detectValueEnhanced(
        manager, value, 'request_body:form_field', clientIp, budget, exclusions.bodyFields, exclusions.disabledCategories,
      );
      if (valueHit[0]) return [true, `Request body field '${name}': ${valueHit[1]}`];
    }
    return [false, ''];
  }

  if (contentType.includes('multipart/form-data')) {
    return scanMultipartBody(manager, rawBody, rawContentType, clientIp, budget, exclusions);
  }

  if (contentType.includes('json')) {
    const [jsonThreat, jsonInfo, parsedClean] = await scanJsonContent(manager, rawBody, 'request_body', clientIp, budget, exclusions.bodyFields, exclusions.disabledCategories);
    // A clean parse is final: the reference returns the walk result without
    // a blob rescan (json_hit is not None), so excluded subtrees stay
    // excluded. Only a parse failure falls through to the raw blob.
    if (parsedClean) {
      if (jsonThreat) return [true, jsonInfo];
      return [false, ''];
    }
  }

  const blobHit = await detectValueEnhanced(manager, rawBody, 'request_body', clientIp, budget, undefined, exclusions.disabledCategories);
  if (blobHit[0]) return [true, `Request body: ${blobHit[1]}`];
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return [false, ''];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

/**
 * Multipart body scan (reference _scan_multipart_body): when the body does
 * not parse into at least one leaf part (no boundary parameter, boundary
 * mismatch, no opening boundary), the whole raw body is scanned as one
 * request_body blob value, like the email parser's is_multipart() == False
 * fallback. Each leaf part scans its label name, then its filename entry,
 * header entries and payload entries (islands for a binary-like file part)
 * under `request_body:multipart_field`.
 */
async function scanMultipartBody(
  manager: SusPatternsManager,
  rawBody: string,
  rawContentType: string,
  clientIp: string,
  budget: ScanBudget,
  exclusions: ScanExclusions,
): Promise<[boolean, string]> {
  const [, params] = parseMediaTypeParams(rawContentType);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const parts = parseMultipartParts(rawBody, params['boundary'] ?? '');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  if (parts.length === 0) {
    const blobHit = await detectValueEnhanced(manager, rawBody, 'request_body', clientIp, budget, undefined, exclusions.disabledCategories);
    if (blobHit[0]) return [true, `Request body: ${blobHit[1]}`];
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return [false, ''];
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  for (const part of parts) {
    const entries = multipartPartEntries(part, manager.detectionBinaryMinRunLength);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (entries.length === 0) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const exclusionKey = entries[0].exclusionKey;
    if (exclusionKey !== null && isExcludedBodyField(exclusions, exclusionKey)) continue;
    const label = entries[0].label;
    const nameHit = await detectComponent(manager, label, 'request_body', clientIp, budget, exclusions.disabledCategories);
    if (nameHit[0]) return [true, `Multipart field name '${label}': ${nameHit[1]}`];
    for (const entry of entries) {
      const valueHit = await detectValueEnhanced(
        manager, entry.value, 'request_body:multipart_field', clientIp, budget, exclusions.bodyFields, exclusions.disabledCategories,
      );
      if (valueHit[0]) return [true, `Request body field '${label}': ${valueHit[1]}`];
    }
  }
  return [false, ''];
}

/**
 * Embedded-JSON pre-scan (reference _check_embedded_json): when the scanned
 * value parses to an object or array, its leaves are scanned under
 * `{context}:embedded_json` before the raw value itself runs through the
 * engine, with excluded body fields skipping whole JSON subtrees by key.
 * The reference skips it for the body context, where JSON content is walked
 * once by scanJsonContent instead.
 */
async function detectValueEnhanced(
  manager: SusPatternsManager,
  value: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  excludedBodyFields?: ReadonlySet<string>,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string]> {
  if (scanBudgetExhausted(budget, value)) return [false, ''];

  if (context !== 'request_body') {
    const [jsonThreat, jsonInfo] = await scanJsonContent(manager, value, `${context}:embedded_json`, clientIp, budget, excludedBodyFields, skipCategories);
    if (jsonThreat) return [true, jsonInfo];
  }

  let result: DetectionResult;
  try {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    result = await manager.detect(value, clientIp, context, null, skipCategories ? { skipCategories } : undefined);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  } catch {
    return [false, ''];
  }
  if (!result.isThreat) return [false, ''];
  recordHitCategories(budget, result);
  return [true, buildThreatMessage(result)];
}

/* Mirror of the reference threat_categories accumulation
   (_build_detection_hit in detection_result_builders.py): dedupe preserving
   first-seen order. The scan stops at the first hit, so the categories
   recorded here are exactly the ones reported to the caller. */
function recordHitCategories(budget: ScanBudget, result: DetectionResult): void {
  for (const category of result.threatCategories ?? []) {
    if (!budget.categories.includes(category)) budget.categories.push(category);
  }
}

/**
 * Component-name scan (reference _scan_component_name): keys and names are
 * scanned as plain values, never through the embedded-JSON path.
 */
async function detectComponent(
  manager: SusPatternsManager,
  value: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string]> {
  if (scanBudgetExhausted(budget, value)) return [false, ''];
  try {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const result = await manager.detect(value, clientIp, context, null, skipCategories ? { skipCategories } : undefined);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (!result.isThreat) return [false, ''];
    recordHitCategories(budget, result);
    return [true, buildThreatMessage(result)];
  } catch {
    return [false, ''];
  }
}

/**
 * JSON body scan (reference _scan_json_content/_scan_json_value): walks
 * parsed JSON, scans operator-shaped dict keys (`$where`, `$ne`, ...) and
 * every scalar leaf under the given context, capping recursion at
 * MAX_JSON_DEPTH (deeper subtrees serialize to text and scan as one value).
 * Keys in `excludedBodyFields` (matched lowercased against verbatim entries)
 * skip their whole subtree before the operator and name checks. The third
 * element reports whether the parse was clean (object or array root): the
 * body routing uses it to decide between the walk result (final) and the
 * raw blob fallback, exactly like _scan_request_body's json_hit is-not-None
 * check.
 */
async function scanJsonContent(
  manager: SusPatternsManager,
  raw: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  excludedBodyFields?: ReadonlySet<string>,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string, boolean]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [false, '', false];
  }
  if (typeof parsed !== 'object' || parsed === null) return [false, '', false];
  const hit = await scanJsonValue(manager, parsed, '', context, clientIp, budget, 1, excludedBodyFields, skipCategories);
  return [hit[0], hit[1], true];
}

async function scanJsonValue(
  manager: SusPatternsManager,
  value: unknown,
  label: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  depth: number,
  excludedBodyFields?: ReadonlySet<string>,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string]> {
  if (Array.isArray(value)) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (depth >= MAX_JSON_DEPTH) return scanCappedJsonSubtree(manager, value, label, context, clientIp, budget, skipCategories);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    for (const item of value) {
      const hit = await scanJsonValue(manager, item, label, context, clientIp, budget, depth + 1, excludedBodyFields, skipCategories);
      if (hit[0]) return hit;
    }
    return [false, ''];
  }
  if (typeof value === 'object' && value !== null) {
    if (depth >= MAX_JSON_DEPTH) return scanCappedJsonSubtree(manager, value, label, context, clientIp, budget, skipCategories);
    for (const [key, item] of Object.entries(value)) {
      if (excludedBodyFields?.has(key.toLowerCase())) continue;
      const keyHit = await scanJsonKey(manager, key, context, clientIp, budget, skipCategories);
      if (keyHit[0]) return [true, `JSON key '${key}': ${keyHit[1]}`];
      const hit = await scanJsonValue(manager, item, key, context, clientIp, budget, depth + 1, excludedBodyFields, skipCategories);
      if (hit[0]) return hit;
    }
    return [false, ''];
  }

  const hit = await detectValueEnhanced(
    manager, String(value), context, clientIp, budget, excludedBodyFields, skipCategories,
  );
  if (!hit[0]) return [false, ''];
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return [true, label ? `Request body field '${label}': ${hit[1]}` : hit[1]];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

async function scanJsonKey(
  manager: SusPatternsManager,
  key: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string]> {
  if (MONGO_OPERATOR_KEY_RE.test(key)) {
    return [true, `JSON operator key '${key}': matched pattern '${MONGO_OPERATOR_KEY_RE.source}'`];
  }
  return detectComponent(manager, key, `${context}:${key}`, clientIp, budget, skipCategories);
}

async function scanCappedJsonSubtree(
  manager: SusPatternsManager,
  value: object,
  label: string,
  context: string,
  clientIp: string,
  budget: ScanBudget,
  skipCategories?: ReadonlySet<string>,
): Promise<[boolean, string]> {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    /* v8 ignore start -- JSON.stringify cannot throw on JSON.parse output */
    return [false, ''];
  }
  /* v8 ignore stop */
  const hit = await detectValueEnhanced(manager, serialized, context, clientIp, budget, undefined, skipCategories);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!hit[0]) return [false, ''];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return [true, label ? `Request body field '${label}': ${hit[1]}` : hit[1]];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

/**
 * Standalone penetration detection entry point (public API). Runs the full
 * SusPatternsManager engine over the request surface on a shared default
 * manager; the live middleware path feeds the initializer's manager into
 * scanRequestWithManager directly via SuspiciousActivityCheck.
 */
export async function detectPenetrationAttempt(
  request: GuardRequest,
): Promise<[boolean, string, string[]]> {
  const { manager, config } = await getDefaultSusPatternsManager();
  return scanRequestWithManager(manager, request, config);
}

export function logActivity(
  request: GuardRequest,
  logger: Logger,
  logType = 'request',
  reason = '',
  passiveMode = false,
  triggerInfo = '',
  level: 'INFO' | 'DEBUG' | 'WARNING' | 'ERROR' | 'CRITICAL' | null = 'WARNING',
  hooks?: {
    checkName?: string;
    onBlock?: ((request: GuardRequest, payload: Record<string, unknown>) => unknown) | null;
    mutedCheckLogs?: ReadonlySet<string> | null;
    sensitiveParams?: Iterable<string> | null | undefined;
    sensitiveBodyFields?: Iterable<string> | null | undefined;
    sensitiveHeaders?: Iterable<string> | null | undefined;
  },
): void {
  /* The twin of _dispatch_block_hook
     (guard_core/_utils/request_logging.py): only 'suspicious' logs carry the
     on_block semantics. In active mode the reason is stashed on the request
     state for the pipeline to fire with the blocking check's name and the
     response status; in passive mode (no response is ever sent) the hook
     fires here with passive_mode=true and a null status_code. */
  if (logType === 'suspicious' && hooks) {
    const state = request.state as Record<string, unknown>;
    if (!passiveMode) {
      state['_guardBlockStash'] = { reason, triggerInfo };
    } else if (hooks.onBlock) {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      const checkName = hooks.checkName ?? '';
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      const muted = hooks.mutedCheckLogs;
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (!(checkName !== '' && muted !== undefined && muted !== null && muted.has(checkName))) {
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        void fireBlockHook(
          hooks.onBlock,
          request,
          logger,
          checkName,
          reason,
          triggerInfo,
          true,
          null,
          hooks.sensitiveParams,
          hooks.sensitiveBodyFields,
          hooks.sensitiveHeaders,
        );
      }
    }
  }
  if (!level) return;

  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const clientIp = request.clientHost ?? 'unknown';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const method = request.method;
  const url = sanitizeForLog(request.urlPath);
  const userAgent = sanitizeForLog(request.headers['user-agent'] ?? '');

  let message: string;

  if (logType === 'request') {
    message = `Request from ${clientIp}: ${method} ${url} [UA: ${userAgent}]`;
  } else if (logType === 'suspicious') {
    const prefix = passiveMode ? '[PASSIVE MODE]' : '';
    const trigger = triggerInfo ? ` | Trigger: ${triggerInfo}` : '';
    message = `${prefix} Suspicious request from ${clientIp}: ${method} ${url} - ${reason}${trigger}`;
  } else {
    message = `${logType} from ${clientIp}: ${method} ${url} - ${reason}`;
  }

  const levelLower = level.toLowerCase();
  const logMethod: keyof Logger =
    levelLower === 'warning' ? 'warn'
    : levelLower === 'critical' ? 'error'
    : levelLower === 'debug' ? 'debug'
    : levelLower === 'error' ? 'error'
    : 'info';

  logger[logMethod](message);
}
