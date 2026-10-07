import { createHash } from 'node:crypto';

import ipaddr from 'ipaddr.js';

import { GuardRedisError } from '../errors.js';
import type { ResolvedSecurityConfig } from '../models/config.js';
import { defaultLogger } from '../models/logger.js';
import type { Logger } from '../models/logger.js';
import { redactEndpointForDisplay } from '../redaction.js';
import { resolveThresholdBan } from '../core/checks/helpers.js';
import { IPBanManager } from './ip-ban.js';
import type { RedisManager } from './redis.js';

/* The standalone request-free rate-limit primitive (the TS port of
   check_rate_limit_by_ip, guard_core/handlers/ratelimit_handler.py):
   "check and record a rate-limit hit for a raw IP, outside the HTTP
   pipeline". It is a full subsystem, not a wrapper over the tiered check:

   - its own sliding-window counters (byIpRequestTimestamps), LRU-capped,
     never shared with the pipeline manager's in-memory store;
   - its own auto-ban feed (byIpAutobanCounts), a dedicated per-process
     counter never merged with the pipeline's suspiciousRequestCounts,
     resolved through the same pure threshold helper the middleware path
     uses (one threshold implementation, not two);
   - input validation before any side effect: a rejected ip or
     endpointPath records no hit and feeds no ban;
   - with endpointPath='' the Redis key collapses to
     `{prefix}rate_limit:rate:{ip}` - the same bucket the HTTP pipeline's
     global rate limit uses for that IP, so the two share one budget by
     design; a non-empty endpointPath is hashed into the key (the reference
     _hash_identity_segment), so isolation is guaranteed and the raw path
     text never reaches Redis. */

/* The module logger (the reference _by_ip_logger =
   logging.getLogger("guard_core.handlers.ratelimit")). */
const byIpLogger: Logger = defaultLogger;

/* The module-level stores (the reference _by_ip_request_timestamps /
   _by_ip_autoban_counts), exported like the reference module globals for
   tests and introspection. */
export const byIpRequestTimestamps = new Map<string, number[]>();
export const byIpAutobanCounts = new Map<string, number>();

/* The LRU cap (the reference _MAX_TRACKED_RATE_LIMIT_KEYS module
   attribute). setMaxTrackedRateLimitKeys exists for the eviction tests
   that monkeypatch the reference attribute. */
export let MAX_TRACKED_RATE_LIMIT_KEYS = 10_000;

export function setMaxTrackedRateLimitKeys(value: number): void {
  MAX_TRACKED_RATE_LIMIT_KEYS = value;
}

/* The twin of _hash_identity_segment: sha256 hexdigest of the segment. */
export function hashIdentitySegment(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/* The twin of _lru_pop_or_create: touch-refreshes an existing entry
   (delete + re-insert moves it to MRU), evicts the oldest key at
   capacity, otherwise creates the default. */
function lruPopOrCreate<T>(
  store: Map<string, T>,
  key: string,
  maxSize: number,
  create: () => T,
): T {
  const existing = store.get(key);
  if (existing !== undefined) {
    store.delete(key);
    return existing;
  }
  if (store.size >= maxSize) {
    const oldestKey = store.keys().next().value;
    /* v8 ignore next -- oldestKey is undefined only for an empty map, which the size guard excludes */
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  return create();
}

/* The twin of _warn_redis_fail_open_in_memory_fallback: warn once per
   process. */
let redisFailOpenWarned = false;

function warnRedisFailOpenOnce(): void {
  if (redisFailOpenWarned) return;
  redisFailOpenWarned = true;
  byIpLogger.warn(
    'Redis unavailable for rate limiting; using the in-memory window '
    + '(redis_fail_open=True); with several workers the effective limit '
    + 'is workers x rate_limit',
  );
}

/* The twin of _resolve_redis_rate_limit_failure: fail-open warns once and
   falls back; fail-closed raises GuardRedisError so the caller decides
   (the primitive has no pipeline fail_secure handling to fall back on). */
function resolveRedisFailure(
  error: unknown,
  redisFailOpen: boolean,
  context: string,
): void {
  if (redisFailOpen) {
    warnRedisFailOpenOnce();
    return;
  }
  byIpLogger.error(`${context}: ${String(error)}`);
  throw new GuardRedisError(503, 'Redis rate limiting unavailable');
}

/* The twin of _redis_request_count for the primitive: the sha-less
   pipeline path (zadd / zremrangebyscore / zcard / expire). Returns null
   on a handled failure (fail-open), throws GuardRedisError on fail-closed,
   and never returns a count when Redis is unavailable. */
export async function redisRequestCountByIp(
  redisHandler: RedisManager,
  clientIp: string,
  currentTime: number,
  windowStart: number,
  rateLimitWindow: number,
  endpointPath = '',
  redisFailOpen = false,
): Promise<number | null> {
  const client = redisHandler.getRawClient();
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!client) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

  const rateKey = endpointPath
    ? `rate:${clientIp}:${hashIdentitySegment(endpointPath)}`
    : `rate:${clientIp}`;
  const prefix = (redisHandler as unknown as { prefix: string }).prefix;
  const keyName = `${prefix}rate_limit:${rateKey}`;

  try {
    await client.zadd(keyName, currentTime, String(currentTime));
    await client.zremrangebyscore(keyName, 0, windowStart);
    const count = await client.zcard(keyName);
    await client.expire(keyName, rateLimitWindow * 2);
    return count;
  } catch (e) {
    resolveRedisFailure(e, redisFailOpen, 'Redis rate limiting error');
  }
  /* The fail-open arm falls through to the in-memory window. */
  return null;
}

/* The twin of _in_memory_request_count for the primitive: the dedicated
   sliding-window store with the hashed endpoint suffix. The answer is the
   count BEFORE this hit lands (the reference counts len, then appends),
   so the comparison is strict `<`; the Redis path counts the just-added
   member and compares `<=` - both reference quirks are preserved. */
export function inMemoryRequestCountByIp(
  clientIp: string,
  windowStart: number,
  currentTime: number,
  endpointPath = '',
): number {
  const key = endpointPath
    ? `${clientIp}:${hashIdentitySegment(endpointPath)}`
    : clientIp;

  const timestamps = lruPopOrCreate(byIpRequestTimestamps, key, MAX_TRACKED_RATE_LIMIT_KEYS, () => []);

  while (timestamps.length > 0 && timestamps[0]! <= windowStart) {
    timestamps.shift();
  }

  const requestCount = timestamps.length;
  timestamps.push(currentTime);
  byIpRequestTimestamps.set(key, timestamps);

  return requestCount;
}

/* The twin of _feed_rate_limit_autoban: the rate-limited call feeds the
   shared auto-ban engine through the primitive's dedicated counter.
   No-ops unless both auto-ban knobs are on and passive mode is off, and
   when the ip is already banned (so a repeatedly rate-limited banned ip
   neither refreshes the ban TTL nor grows the counter). */
export async function feedRateLimitAutoban(
  ip: string,
  config: ResolvedSecurityConfig,
): Promise<void> {
  if (!(config.enableRateLimitAutoBan && config.enableIpBanning)) return;
  if (config.passiveMode) return;

  const ipBanManager = new IPBanManager(defaultLogger);
  if (await ipBanManager.isIpBanned(ip)) return;

  const count = lruPopOrCreate(byIpAutobanCounts, ip, MAX_TRACKED_RATE_LIMIT_KEYS, () => 0) + 1;
  byIpAutobanCounts.set(ip, count);

  const ipCounts = new Map<string, number>([['rate_limit', count]]);
  const result = await resolveThresholdBan(
    ipCounts, config, ipBanManager, ip, ['rate_limit'], 'rate_limit_exceeded',
  );
  if (result !== null) {
    byIpLogger.warn(`check_rate_limit_by_ip: auto-banned ${ip} (rate_limit_exceeded)`);
  }
}

/* Check and record a rate-limit hit for a raw IP, outside the HTTP
   pipeline. Returns true when the call is allowed (under limit), false
   when rate-limited. Every call records a hit in the sliding window,
   exactly like the pipeline path, so calling this to "just check" also
   consumes one slot of the budget. Does not construct or mutate the
   RateLimitManager: it calls the same module-level counting functions the
   pipeline uses, against a store dedicated to this primitive.

   When the call is rate-limited and both enableRateLimitAutoBan and
   enableIpBanning are set, the violation feeds the same auto-ban engine
   the RateLimitCheck uses in the HTTP pipeline (threatBanConfig
   rate_limit first, then the flat autoBanThreshold/autoBanDuration),
   reason "rate_limit_exceeded". passiveMode suppresses the counting
   entirely. Once the ip is already banned, further over-limit calls
   neither count nor re-ban nor refresh the ban TTL.

   Throws TypeError (the reference ValueError) when ip does not parse as
   an IP address or endpointPath contains a ':'; validation runs before
   any counting side effect and before the enableRateLimiting early
   return, so rejected input never records a hit and never feeds
   auto-ban. Throws GuardRedisError when Redis is enabled and the Redis
   call fails while redisFailOpen is false; with redisFailOpen the same
   failure falls back to the in-memory window. */
export async function checkRateLimitByIp(
  ip: string,
  config: ResolvedSecurityConfig,
  redisHandler?: RedisManager | null,
  endpointPath = '',
): Promise<boolean> {
  if (!isValidIp(ip)) {
    throw new TypeError(`check_rate_limit_by_ip: invalid ip ${JSON.stringify(ip)}`);
  }
  if (endpointPath.includes(':')) {
    const safeEndpointPath = redactEndpointForDisplay(
      endpointPath,
      config.logSensitiveParams,
      config.logSensitiveBodyFields,
      config.logSensitiveHeaders,
    );
    throw new TypeError(
      `check_rate_limit_by_ip: endpoint_path must not contain ':' `
      + `(got ${JSON.stringify(safeEndpointPath)})`,
    );
  }

  if (!config.enableRateLimiting) return true;

  const currentTime = Date.now() / 1000;
  const windowStart = currentTime - config.rateLimitWindow;

  let allowed: boolean | null = null;
  if (config.enableRedis && redisHandler) {
    const count = await redisRequestCountByIp(
      redisHandler, ip, currentTime, windowStart,
      config.rateLimitWindow, endpointPath, config.redisFailOpen,
    );
    if (count !== null) {
      allowed = count <= config.rateLimit;
    }
  }

  if (allowed === null) {
    const requestCount = inMemoryRequestCountByIp(ip, windowStart, currentTime, endpointPath);
    allowed = requestCount < config.rateLimit;
  }

  if (!allowed) {
    await feedRateLimitAutoban(ip, config);
  }

  return allowed;
}

/* The reference validates with ipaddress.ip_address: a bare literal that
   must parse as IPv4 or IPv6 (no CIDR, no zone, no integers). */
function isValidIp(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    return parsed.kind() === 'ipv4' || parsed.kind() === 'ipv6';
  } catch {
    return false;
  }
}
