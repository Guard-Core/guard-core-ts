import { z } from 'zod';

/* The last-known-rules snapshot envelope (the TS port of the snapshot half
   of guard_core/_dynamic_rules.py): the versioned, strict envelope that
   backs the dynamic_rules_cache_path disk fallback and the Redis
   last_known snapshot. The envelope is what the DynamicRuleManager writes
   on every accepted rule update and re-reads on boot, so a restart during a
   SaaS outage restores the last applied rules instead of base config.

   The wire format is the reference's exact snake_case bytes (the redis
   interop corpus pins dynamic_rules:last_known byte for byte), so a
   snapshot written by this engine is loadable by the reference engine and
   vice versa. Strictness contract (the reference extra="forbid" on both
   levels): an envelope written by a NEWER engine (unknown fields) or
   carrying an unknown schema version is discarded, never partially
   applied. */

export const LAST_KNOWN_RULES_SNAPSHOT_SCHEMA_VERSION = 1;

const VALID_CLOUD_PROVIDERS = ['AWS', 'GCP', 'Azure'] as const;

/* The mirrored rules payload on the wire. The fields mirror the reference
   DynamicRules model exactly, including the three auto-ban override knobs
   the TS live model does not carry (they ride the snapshot as null so the
   reference engine reads the payload unchanged). Key order below is the
   reference model order, which JSON.stringify preserves for byte parity. */
export const LastKnownDynamicRulesWireSchema = z.strictObject({
  rule_id: z.string(),
  version: z.number().int(),
  timestamp: z.string(),
  expires_at: z.string().nullable(),
  ttl: z.number().int(),
  ip_blacklist: z.array(z.string()),
  ip_whitelist: z.array(z.string()),
  ip_ban_duration: z.number().int(),
  blocked_countries: z.array(z.string()),
  whitelist_countries: z.array(z.string()),
  global_rate_limit: z.number().int().nullable(),
  global_rate_window: z.number().int().nullable(),
  endpoint_rate_limits: z.record(z.string(), z.tuple([z.number(), z.number()])),
  blocked_cloud_providers: z.array(z.string()),
  blocked_user_agents: z.array(z.string()),
  suspicious_patterns: z.array(z.string()),
  enable_penetration_detection: z.boolean().nullable(),
  enable_ip_banning: z.boolean().nullable(),
  enable_rate_limiting: z.boolean().nullable(),
  auto_ban_threshold: z.number().int().nullable(),
  auto_ban_duration: z.number().int().nullable(),
  enable_rate_limit_auto_ban: z.boolean().nullable(),
  emergency_mode: z.boolean(),
  emergency_whitelist: z.array(z.string()),
});

export const LastKnownRulesSnapshotWireSchema = z.strictObject({
  schema_version: z.number().int(),
  rules: LastKnownDynamicRulesWireSchema,
});

export type LastKnownRulesWire = z.output<typeof LastKnownDynamicRulesWireSchema>;

/* The reference serializes UTC datetimes with a trailing Z and no
   fractional part when the instant is whole seconds (pydantic v2
   model_dump_json behavior); normalize every timestamp the same way so the
   bytes match. Returns the sentinel when the value is not a datetime
   string, which the dump path turns into a TypeError. */
function normalizeTimestamp(value: unknown, sentinel: string): string {
  if (typeof value !== 'string' || value.length === 0) return sentinel;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return sentinel;
  const iso = parsed.toISOString();
  return iso.endsWith('.000Z') ? iso.slice(0, iso.length - 5) + 'Z' : iso;
}


/** Serialize the last-known snapshot envelope: the DynamicRules fields only,
 * wrapped in the versioned strict envelope, in the reference snake_case
 * wire bytes (the reference dump_last_known_rules_snapshot). Agent-only
 * extras on the input object never reach the payload. Throws when the
 * mirrored rules do not satisfy the model - a missing or mistyped required
 * field, an unparseable timestamp, a malformed list - exactly like the
 * reference model_validate failure (the caller owns the error log and
 * keeps running). */
export function dumpLastKnownRulesSnapshot(
  rules: Record<string, unknown>,
): string {
  const ruleId = rules['ruleId'] ?? rules['rule_id'];
  const version = rules['version'];
  const timestamp = normalizeTimestamp(rules['timestamp'], 'timestamp');
  if (typeof ruleId !== 'string') {
    throw new TypeError('last-known dynamic rules snapshot: ruleId must be a string');
  }
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new TypeError('last-known dynamic rules snapshot: version must be an integer');
  }
  if (timestamp === 'timestamp') {
    throw new TypeError('last-known dynamic rules snapshot: timestamp must be a datetime string');
  }
  const expiresRaw = rules['expiresAt'] ?? rules['expires_at'] ?? null;
  const expiresAt = expiresRaw === null
    ? null
    : normalizeTimestamp(expiresRaw, 'expires');
  if (expiresAt === 'expires') {
    throw new TypeError('last-known dynamic rules snapshot: expiresAt must be a datetime string or null');
  }
  const wire: LastKnownRulesWire = LastKnownDynamicRulesWireSchema.parse({
    rule_id: ruleId,
    version,
    timestamp,
    expires_at: expiresAt,
    ttl: rules['ttl'] ?? 300,
    ip_blacklist: rules['ipBlacklist'] ?? rules['ip_blacklist'] ?? [],
    ip_whitelist: rules['ipWhitelist'] ?? rules['ip_whitelist'] ?? [],
    ip_ban_duration: rules['ipBanDuration'] ?? rules['ip_ban_duration'] ?? 3600,
    blocked_countries: rules['blockedCountries'] ?? rules['blocked_countries'] ?? [],
    whitelist_countries: rules['whitelistCountries'] ?? rules['whitelist_countries'] ?? [],
    global_rate_limit: rules['globalRateLimit'] ?? rules['global_rate_limit'] ?? null,
    global_rate_window: rules['globalRateWindow'] ?? rules['global_rate_window'] ?? null,
    endpoint_rate_limits: rules['endpointRateLimits'] ?? rules['endpoint_rate_limits'] ?? {},
    blocked_cloud_providers: rules['blockedCloudProviders'] instanceof Set
      ? [...rules['blockedCloudProviders']]
      : rules['blockedCloudProviders'] ?? rules['blocked_cloud_providers'] ?? [],
    blocked_user_agents: rules['blockedUserAgents'] ?? rules['blocked_user_agents'] ?? [],
    suspicious_patterns: rules['suspiciousPatterns'] ?? rules['suspicious_patterns'] ?? [],
    enable_penetration_detection: rules['enablePenetrationDetection'] ?? rules['enable_penetration_detection'] ?? null,
    enable_ip_banning: rules['enableIpBanning'] ?? rules['enable_ip_banning'] ?? null,
    enable_rate_limiting: rules['enableRateLimiting'] ?? rules['enable_rate_limiting'] ?? null,
    auto_ban_threshold: rules['autoBanThreshold'] ?? rules['auto_ban_threshold'] ?? null,
    auto_ban_duration: rules['autoBanDuration'] ?? rules['auto_ban_duration'] ?? null,
    enable_rate_limit_auto_ban: rules['enableRateLimitAutoBan'] ?? rules['enable_rate_limit_auto_ban'] ?? null,
    emergency_mode: rules['emergencyMode'] ?? rules['emergency_mode'] ?? false,
    emergency_whitelist: rules['emergencyWhitelist'] ?? rules['emergency_whitelist'] ?? [],
  });
  return JSON.stringify({
    schema_version: LAST_KNOWN_RULES_SNAPSHOT_SCHEMA_VERSION,
    rules: wire,
  });
}


/** The hydrated rules state in the TS live model shape: the DynamicRules
 * fields (camelCase, blockedCloudProviders back as a Set). The three
 * snapshot-only auto-ban knobs are reference-model surface the TS engine
 * does not consume; they round-trip through dump only. */
export interface LoadedLastKnownRules {
  ruleId: string;
  version: number;
  timestamp: string;
  expiresAt: string | null;
  ttl: number;
  ipBlacklist: string[];
  ipWhitelist: string[];
  ipBanDuration: number;
  blockedCountries: string[];
  whitelistCountries: string[];
  globalRateLimit: number | null;
  globalRateWindow: number | null;
  endpointRateLimits: Record<string, [number, number]>;
  blockedCloudProviders: Set<string>;
  blockedUserAgents: string[];
  suspiciousPatterns: string[];
  enablePenetrationDetection: boolean | null;
  enableIpBanning: boolean | null;
  enableRateLimiting: boolean | null;
  emergencyMode: boolean;
  emergencyWhitelist: string[];
}

/** Parse a last-known snapshot payload back into the live rules state (the
 * reference load_last_known_rules_snapshot). Throws on an unknown schema
 * version, unknown fields or a malformed payload; the caller owns the
 * discard-and-continue fallback. Accepts only the reference snake_case
 * wire format (the bytes this engine and the reference engine both
 * write). */
export function loadLastKnownRulesSnapshot(payload: string): LoadedLastKnownRules {
  const envelope = LastKnownRulesSnapshotWireSchema.parse(JSON.parse(payload));
  if (envelope.schema_version !== LAST_KNOWN_RULES_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported last-known dynamic rules snapshot schema version: ${envelope.schema_version}`,
    );
  }
  const r = envelope.rules;
  return {
    ruleId: r.rule_id,
    version: r.version,
    timestamp: r.timestamp,
    expiresAt: r.expires_at,
    ttl: r.ttl,
    ipBlacklist: r.ip_blacklist,
    ipWhitelist: r.ip_whitelist,
    ipBanDuration: r.ip_ban_duration,
    blockedCountries: r.blocked_countries,
    whitelistCountries: r.whitelist_countries,
    globalRateLimit: r.global_rate_limit,
    globalRateWindow: r.global_rate_window,
    endpointRateLimits: r.endpoint_rate_limits,
    blockedCloudProviders: new Set(r.blocked_cloud_providers),
    blockedUserAgents: r.blocked_user_agents,
    suspiciousPatterns: r.suspicious_patterns,
    enablePenetrationDetection: r.enable_penetration_detection,
    enableIpBanning: r.enable_ip_banning,
    enableRateLimiting: r.enable_rate_limiting,
    emergencyMode: r.emergency_mode,
    emergencyWhitelist: r.emergency_whitelist,
  };
}
