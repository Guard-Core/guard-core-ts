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
}
