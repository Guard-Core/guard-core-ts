import { ALL_DETECTION_CATEGORIES } from '../../detection-engine/patterns/sources.js';
import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { RouteConfig } from '../../models/route-config.js';

/* Per-request detection exclusion resolution, the port of the _resolve_*
   helpers in guard_core/_utils/detection_config.py: every route surface
   overrides the global config when the route carries a non-null value (the
   Python sentinel is None; the TS sentinel is null), and the header
   exclusion set is additive (hardcoded defaults + config + route). */

/** The resolved exclusion set for one request. enabledCategories is null
 *  when every category scans (the reference passes None through to the
 *  scanners); scanBody defaults to true. */
export interface ResolvedDetectionExclusions {
  excludedParams: ReadonlySet<string>;
  excludedBodyFields: ReadonlySet<string>;
  excludedHeaders: ReadonlySet<string>;
  enabledCategories: ReadonlySet<string> | null;
  scanBody: boolean;
}

/** Hardcoded proxy identity defaults (the reference
 *  _DEFAULT_EXCLUDED_HEADERS in guard_core/_utils/detection_config.py),
 *  shared with the header-scan routing in utils.ts. */
export const EXCLUDED_HEADERS: ReadonlySet<string> = new Set([
  'host', 'user-agent', 'accept', 'accept-encoding', 'connection',
  'origin', 'referer', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest',
  'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
  'x-real-ip', 'x-client-ip', 'x-cluster-client-ip', 'cf-connecting-ip',
  'true-client-ip', 'fly-client-ip', 'x-envoy-external-address',
]);

export function resolveDetectionExclusions(
  config: ResolvedSecurityConfig | null,
  route: RouteConfig | null,
): ResolvedDetectionExclusions {
  const resolved: ResolvedDetectionExclusions = {
    excludedParams: new Set<string>(),
    excludedBodyFields: new Set<string>(),
    excludedHeaders: new Set<string>(),
    enabledCategories: null,
    scanBody: true,
  };
  const excludedParams = new Set<string>();
  const excludedBodyFields = new Set<string>();
  const excludedHeaders = new Set<string>();
  if (config !== null) {
    for (const name of config.excludedDetectionParams) {
      excludedParams.add(name.toLowerCase());
    }
    for (const name of config.excludedDetectionBodyFields) {
      excludedBodyFields.add(name.toLowerCase());
    }
    if (resolved.enabledCategories === null) {
      resolved.enabledCategories = new Set<string>();
    }
    for (const category of config.enabledDetectionCategories) {
      (resolved.enabledCategories as Set<string>).add(category);
    }
  }
  // The header set is a merge, never a replacement: the hardcoded proxy
  // identity defaults plus the configured set plus the route set
  // (_resolve_excluded_headers).
  for (const name of EXCLUDED_HEADERS) {
    excludedHeaders.add(name);
  }
  if (config !== null) {
    for (const name of config.excludedDetectionHeaders) {
      excludedHeaders.add(name.toLowerCase());
    }
  }
  if (route !== null) {
    // _resolve_excluded_params / _resolve_excluded_body_fields: a non-null
    // route set replaces the global one.
    if (route.excludedDetectionParams !== null) {
      excludedParams.clear();
      for (const name of route.excludedDetectionParams) excludedParams.add(name.toLowerCase());
    }
    if (route.excludedDetectionBodyFields !== null) {
      excludedBodyFields.clear();
      for (const name of route.excludedDetectionBodyFields) excludedBodyFields.add(name.toLowerCase());
    }
    if (route.excludedDetectionHeaders !== null) {
      for (const name of route.excludedDetectionHeaders) {
        excludedHeaders.add(name.toLowerCase());
      }
    }
    // _resolve_enabled_categories: a non-null route set replaces the global
    // set (null on the route keeps the global resolution, which itself stays
    // null = all categories when nothing is configured).
    if (route.enabledDetectionCategories !== null) {
      resolved.enabledCategories = new Set(route.enabledDetectionCategories);
    }
    // _resolve_scan_body: a non-null route flag replaces the global default
    // of true.
    if (route.detectionScanBody !== null) {
      resolved.scanBody = route.detectionScanBody;
    } else if (config !== null) {
      resolved.scanBody = config.detectionScanBody;
    }
  } else if (config !== null) {
    resolved.scanBody = config.detectionScanBody;
  }
  resolved.excludedParams = excludedParams;
  resolved.excludedBodyFields = excludedBodyFields;
  resolved.excludedHeaders = excludedHeaders;
  return resolved;
}

/** Categories that must not produce a threat for this request: the
 *  complement of the resolved enabled set (empty when every category
 *  scans). The scanners fold this into their per-value skip sets, matching
 *  the reference's per-category pattern gating. */
export function disabledCategoriesOf(
  exclusions: ResolvedDetectionExclusions,
): ReadonlySet<string> {
  if (exclusions.enabledCategories === null) return new Set<string>();
  const disabled = new Set<string>();
  for (const category of ALL_DETECTION_CATEGORIES) {
    if (!exclusions.enabledCategories.has(category)) disabled.add(category);
  }
  return disabled;
}
