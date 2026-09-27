import type { GuardRequest } from '../protocols/request.js';
import type { GuardResponse } from '../protocols/response.js';
import type { BehaviorRule } from './behavior-rule.js';

export class RouteConfig {
  rateLimit: number | null = null;
  rateLimitWindow: number | null = null;
  ipWhitelist: string[] | null = null;
  ipBlacklist: string[] | null = null;
  blockedCountries: string[] | null = null;
  whitelistCountries: string[] | null = null;
  bypassedChecks: Set<string> = new Set();
  requireHttps = false;
  authRequired: string | null = null;
  /* The reference RouteConfig auth surface
     (guard_core/decorators/route_config.py): verifier callables receive
     (request, credential) and resolve to a principal (or a promise of one);
     apiKeyHeader names the header the api_key_auth credential is read from;
     authorizationHeaderRequired is the presence-only scheme set by
     require_authorization_header and is mutually exclusive with
     authRequired / apiKeyRequired. */
  authVerifier: ((request: GuardRequest, credential: string) => unknown) | null = null;
  apiKeyVerifier: ((request: GuardRequest, credential: string) => unknown) | null = null;
  apiKeyHeader: string | null = null;
  authorizationHeaderRequired: string | null = null;
  customValidators: Array<(request: GuardRequest) => Promise<GuardResponse | null>> = [];
  blockedUserAgents: string[] = [];
  requiredHeaders: Record<string, string> = {};
  behaviorRules: BehaviorRule[] = [];
  blockCloudProviders: Set<string> = new Set();
  maxRequestSize: number | null = null;
  allowedContentTypes: string[] | null = null;
  timeRestrictions: { start: string; end: string } | null = null;
  enableSuspiciousDetection = true;
  requireReferrer: string[] | null = null;
  apiKeyRequired = false;
  sessionLimits: Record<string, number> | null = null;
  geoRateLimits: Record<string, [number, number]> | null = null;

  /* Per-route detection exclusion surface, mirrored from the reference
     route_config.detection_exclusion decorator
     (guard_core/decorators/content_filtering.py) and resolved with the
     _resolve_* helpers of guard_core/_utils/detection_config.py. A null
     field means "inherit the global config" for that surface; a non-null
     value replaces the global one (the header exclusion set is the
     exception: it always merges the hardcoded defaults with the config set
     and the route set, see resolveDetectionExclusions). Entries are matched
     lowercased like the reference. */
  excludedDetectionHeaders: Set<string> | null = null;
  excludedDetectionParams: Set<string> | null = null;
  excludedDetectionBodyFields: Set<string> | null = null;
  /* When non-null, replaces the global enabled category set for this route
     (an empty set disables every category, like the reference's empty
     frozenset). */
  enabledDetectionCategories: Set<string> | null = null;
  /* When non-null, overrides the reference detection_scan_body default
     (true): false skips the body surface while headers, params, and the URL
     path still scan. */
  detectionScanBody: boolean | null = null;
}
