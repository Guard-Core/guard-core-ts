import { SecurityConfigSchema } from '../../src/models/config.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { RedisManager } from '../../src/handlers/redis.js';
import { RateLimitManager } from '../../src/handlers/rate-limit.js';
import { IPBanManager } from '../../src/handlers/ip-ban.js';
import { BehaviorTracker } from '../../src/handlers/behavior.js';
import { SecurityHeadersManager } from '../../src/handlers/security-headers.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { CloudHandler } from '../../src/handlers/cloud.js';
import { IPInfoManager } from '../../src/handlers/geoip.js';
import { BehaviorRule } from '../../src/models/behavior-rule.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import { createMockResponseFactory } from '../helpers.js';

/* redis_interop-kind conformance harness (spec 4.1.0, suite redis_interop).

   Byte-level pins of the engine's on-the-wire Redis surface per
   specs/08-redis-schema.md, driven against a LIVE Redis (REDIS_URL, default
   redis://localhost:6379) exactly like specs/fixtures/tools/
   redis_interop_cases.py drives the reference: flush the per-case prefix,
   execute the operation through the REAL handlers, then scan the prefix and
   probe every key (TYPE, TTL, value bytes, zset members/scores).

   Pinning rules (index.json comparison.redis_interop):
   - keys, static string values and JSON values: byte-exact;
   - engine-generated values (ban expiry floats, epoch zset members): value
     SHAPE as a regex, never the value;
   - TTL: whether one is set and its configured value, never the remaining
     time. The probe reads the remaining TTL seconds; the comparison accepts
     the configured value minus a bounded probe-latency allowance (5 s), so
     a slow host can flip 120 to 119 but never to a different configured
     TTL. This keeps TTL semantics deterministic without wall-clock luck.
   - zset scores: floats at 6-decimal precision.

   Operations the TS engine cannot express (behavior zsets, cloud v2 stores,
   dynamic-rules snapshots, ipinfo database cache) are honest driver gaps:
   the drive runs the closest real TS seam and the missing keys are the
   recorded divergence, feeding conformance/ts_redis_interop_xfail.json. */

export interface RedisExpectedTtl {
  set: boolean;
  seconds?: number;
}

export interface RedisExpectedRecord {
  key: string;
  type: string;
  ttl: RedisExpectedTtl;
  card?: number;
  member_shape?: string;
  score_shape?: string;
  score_equals_member?: boolean;
  value_shape?: string;
  value?: string;
}

export interface RedisOperation {
  op: string;
  handler: string;
  call: string;
  args: Record<string, unknown>;
}

export interface RedisCase {
  id: string;
  prefix: string;
  operation: RedisOperation;
  expected: RedisExpectedRecord[];
}

export interface RedisSuite {
  suite: string;
  kind: string;
  doc?: string;
  cases: RedisCase[];
}

export function parseRedisSuite(text: string, name: string): RedisSuite {
  const obj = JSON.parse(text) as Record<string, unknown>;
  if (obj['suite'] !== name) {
    throw new Error(`${name}.json declares suite "${String(obj['suite'])}"`);
  }
  if (obj['kind'] !== 'redis_interop') {
    throw new Error(`${name}.json declares kind "${String(obj['kind'])}", expected redis_interop`);
  }
  if (!Array.isArray(obj['cases'])) {
    throw new Error(`${name}.json: "cases" must be an array`);
  }
  return { suite: name, kind: 'redis_interop', doc: obj['doc'] as string | undefined, cases: obj['cases'] as RedisCase[] };
}

export function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379/0';
}

export const NUMERIC_SHAPE = '^[0-9]+\\.[0-9]+(e[+-]?[0-9]+)?$';
export const UUID4_HEX_SHAPE = '^[0-9a-f]{32}$';

/* Probe-latency allowance for the TTL comparison (see module doc). */
export const TTL_PROBE_SLACK_SECONDS = 5;

interface RawClient {
  ping(): Promise<string>;
  quit(): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  type(key: string): Promise<string>;
  ttl(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  zrange(key: string, start: number, stop: number, withscores: 'WITHSCORES'): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

export async function connect(): Promise<RawClient> {
  const { default: Redis } = await import('ioredis');
  const client = new Redis(redisUrl(), { maxRetriesPerRequest: 1 });
  await client.ping();
  return client as unknown as RawClient;
}

export function rioConfig(prefix: string, overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
  return SecurityConfigSchema.parse({
    enableRedis: true,
    redisUrl: redisUrl(),
    redisPrefix: prefix,
    ...overrides,
  });
}

function corpusRequest(clientIp: string, urlPath: string): GuardRequest {
  return {
    urlPath,
    urlScheme: 'http',
    urlFull: `http://example.com${urlPath}`,
    urlReplaceScheme: (s: string) => `${s}://example.com${urlPath}`,
    method: 'GET',
    clientHost: clientIp,
    headers: {},
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: { clientIp } as never,
    scope: {},
  } as unknown as GuardRequest;
}

async function flushPrefix(client: RawClient, prefix: string): Promise<void> {
  const keys = await client.keys(`${prefix}*`);
  if (keys.length > 0) await client.del(...keys);
}

interface ProbedRecord {
  key: string;
  type: string;
  ttl: RedisExpectedTtl;
  json: boolean;
  value: string | null;
  members: Array<{ member: string; score: number }>;
}

async function probeKey(client: RawClient, key: string): Promise<ProbedRecord> {
  const keyType = await client.type(key);
  const ttlSeconds = await client.ttl(key);
  const record: ProbedRecord = {
    key,
    type: keyType,
    ttl: ttlSeconds > 0 ? { set: true, seconds: ttlSeconds } : { set: false },
    json: false,
    value: null,
    members: [],
  };
  if (keyType === 'string') {
    const value = await client.get(key);
    record.value = value;
    record.json = value !== null && parsesToJsonObject(value);
  } else if (keyType === 'zset') {
    const flat = await client.zrange(key, 0, -1, 'WITHSCORES');
    for (let i = 0; i + 1 < flat.length; i += 2) {
      record.members.push({ member: flat[i] as string, score: Number(flat[i + 1]) });
    }
  }
  return record;
}

function parsesToJsonObject(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function round6(value: number): number {
  const scaled = value * 1e6;
  return (scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled)) / 1e6;
}

/* _categorize of redis_interop_cases.py: turn the raw probe into the pinned
   expectation, replacing engine-generated volatiles with shape pins. */
export function categorize(record: ProbedRecord): Record<string, unknown> {
  const pinned: Record<string, unknown> = {
    key: record.key,
    type: record.type,
    ttl: record.ttl,
  };
  if (record.type === 'string' && record.value !== null) {
    if (record.json) {
      pinned['type'] = 'json';
      pinned['value'] = record.value;
    } else if (new RegExp(NUMERIC_SHAPE).test(record.value)) {
      pinned['value_shape'] = NUMERIC_SHAPE;
    } else {
      pinned['value'] = record.value;
    }
  } else if (record.type === 'zset') {
    pinned['card'] = record.members.length;
    const entries = record.members;
    const allUuid = entries.length > 0 && entries.every((e) => new RegExp(UUID4_HEX_SHAPE).test(e.member));
    const allNumericAndScoreEquals = entries.length > 0 && entries.every(
      (e) => new RegExp(NUMERIC_SHAPE).test(e.member) && Math.abs(e.score - Number(e.member)) < 1e-6,
    );
    if (allUuid) {
      pinned['member_shape'] = UUID4_HEX_SHAPE;
      pinned['score_shape'] = NUMERIC_SHAPE;
    } else if (allNumericAndScoreEquals) {
      pinned['member_shape'] = NUMERIC_SHAPE;
      pinned['score_equals_member'] = true;
    } else {
      pinned['members'] = entries.map((e) => ({ member: e.member, score: round6(e.score) }));
    }
  }
  return pinned;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

/* Byte equality with the two documented leniencies: zset scores at
   6-decimal precision, and the TTL freshness window. */
export function diffRedisRecord(expected: RedisExpectedRecord, observed: Record<string, unknown>): string[] {
  const diffs: string[] = [];
  if (observed['key'] !== expected.key) {
    diffs.push(`key: want ${expected.key}, got ${String(observed['key'])}`);
  }
  if (observed['type'] !== expected.type) {
    diffs.push(`type: want ${expected.type}, got ${String(observed['type'])}`);
  }
  const gotTtl = observed['ttl'] as RedisExpectedTtl;
  if (expected.ttl.set) {
    const wantSeconds = expected.ttl.seconds ?? 0;
    const gotSeconds = gotTtl.set === true ? (gotTtl.seconds ?? 0) : 0;
    if (gotTtl.set !== true || gotSeconds > wantSeconds || wantSeconds - gotSeconds > TTL_PROBE_SLACK_SECONDS) {
      diffs.push(`ttl: want set with configured ${wantSeconds}s, got ${JSON.stringify(gotTtl)}`);
    }
  } else if (gotTtl.set !== false) {
    diffs.push(`ttl: want no expiry, got ${JSON.stringify(gotTtl)}`);
  }
  for (const [field, wantValue] of Object.entries(expected)) {
    if (field === 'key' || field === 'type' || field === 'ttl') continue;
    if (!(field in observed)) {
      diffs.push(`field ${field}: want ${JSON.stringify(wantValue)}, observed record has none`);
      continue;
    }
    if (JSON.stringify(observed[field]) !== JSON.stringify(wantValue)) {
      diffs.push(`field ${field}: want ${JSON.stringify(wantValue)}, got ${JSON.stringify(observed[field])}`);
    }
  }
  return diffs;
}

/* Execute the operation, then pin everything the prefix scan observes
   (run_redis_case of redis_interop_cases.py). */
export async function runRedisCase(corpusCase: RedisCase): Promise<string[]> {
  const client = await connect();
  try {
    await flushPrefix(client, corpusCase.prefix);
    await executeOperation(corpusCase);
    const keys = (await client.keys(`${corpusCase.prefix}*`)).sort();
    if (keys.length === 0) {
      return ['operation wrote no keys under the prefix: the TS engine has no write seam for this key family'];
    }
    const diffs: string[] = [];
    if (keys.length !== corpusCase.expected.length) {
      diffs.push(`key count under the prefix: want ${corpusCase.expected.length}, got ${keys.length}`);
    }
    for (let i = 0; i < Math.min(keys.length, corpusCase.expected.length); i++) {
      const observed = categorize(await probeKey(client, keys[i] as string));
      diffs.push(...diffRedisRecord(corpusCase.expected[i] as RedisExpectedRecord, observed));
    }
    return diffs;
  } finally {
    await flushPrefix(client, corpusCase.prefix);
    await client.quit();
  }
}

async function redisManager(prefix: string): Promise<RedisManager> {
  const manager = new RedisManager(rioConfig(prefix), defaultLogger);
  await manager.initialize();
  return manager;
}

async function executeOperation(corpusCase: RedisCase): Promise<void> {
  const args = corpusCase.operation.args;
  switch (corpusCase.operation.op) {
    case 'rate_limit': {
      const redis = await redisManager(corpusCase.prefix);
      const config = rioConfig(corpusCase.prefix, { enableRateLimiting: true });
      const manager = new RateLimitManager(defaultLogger, config);
      await manager.initializeRedis(redis);
      const endpointPath = (args['endpoint_path'] as string) ?? '';
      await manager.checkRateLimit(
        corpusRequest(args['client_ip'] as string, endpointPath || '/api'),
        args['client_ip'] as string,
        async (statusCode, message) => createMockResponseFactory().createResponse(message, statusCode),
        endpointPath === '' ? null : endpointPath,
        args['rate_limit'] as number,
        args['rate_limit_window'] as number,
      );
      await redis.close();
      return;
    }
    case 'ban_ip': {
      const redis = await redisManager(corpusCase.prefix);
      const manager = new IPBanManager(defaultLogger);
      await manager.initializeRedis(redis);
      await manager.banIp(args['ip'] as string, args['duration'] as number, (args['reason'] as string) ?? 'rio_ban');
      await redis.close();
      return;
    }
    case 'behavior_usage': {
      /* The TS BehaviorTracker is memory-only: initializeRedis stores the
         handler but no tracking write ever reaches Redis (behavior.ts). */
      const redis = await redisManager(corpusCase.prefix);
      const tracker = new BehaviorTracker(rioConfig(corpusCase.prefix), defaultLogger);
      await tracker.initializeRedis(redis);
      const rule = args['rule'] as Record<string, unknown>;
      await tracker.trackEndpointUsage(
        args['endpoint_id'] as string,
        args['client_ip'] as string,
        new BehaviorRule(rule['rule_type'] as 'usage' | 'return_pattern' | 'frequency', rule['threshold'] as number, rule['window'] as number),
      );
      await redis.close();
      return;
    }
    case 'behavior_return': {
      const redis = await redisManager(corpusCase.prefix);
      const tracker = new BehaviorTracker(rioConfig(corpusCase.prefix), defaultLogger);
      await tracker.initializeRedis(redis);
      const rule = args['rule'] as Record<string, unknown>;
      const response = createMockResponseFactory().createResponse('not found', args['response_status'] as number);
      await tracker.trackReturnPattern(
        args['endpoint_id'] as string,
        args['client_ip'] as string,
        response,
        new BehaviorRule(
          rule['rule_type'] as 'usage' | 'return_pattern' | 'frequency',
          rule['threshold'] as number,
          rule['window'] as number,
          rule['pattern'] as string,
        ),
      );
      await redis.close();
      return;
    }
    case 'security_headers': {
      const redis = await redisManager(corpusCase.prefix);
      const manager = new SecurityHeadersManager(defaultLogger);
      await manager.initializeRedis(redis);
      const options: Record<string, unknown> = {};
      if (args['csp_config']) options['csp'] = args['csp_config'];
      if (args['hsts_config']) {
        const hsts = args['hsts_config'] as Record<string, unknown>;
        options['hstsMaxAge'] = hsts['max_age'];
        options['hstsIncludeSubdomains'] = hsts['include_subdomains'];
      }
      if (args['custom_headers']) options['customHeaders'] = args['custom_headers'];
      manager.configure(options);
      await redis.close();
      return;
    }
    case 'add_pattern': {
      const redis = await redisManager(corpusCase.prefix);
      const manager = new SusPatternsManager(rioConfig(corpusCase.prefix), defaultLogger);
      await manager.initializeRedis(redis);
      await manager.addPattern(args['pattern'] as string);
      await redis.close();
      return;
    }
    case 'ipinfo_database': {
      /* No TS seam: IPInfoManager.initializeRedis (geoip.ts) is an empty
         stub and there is no injectable download; drive the real
         initialize so the missing write is observed, not skipped. */
      const redis = await redisManager(corpusCase.prefix);
      const handler = new IPInfoManager(defaultLogger);
      await handler.initializeRedis(redis);
      await handler.initialize();
      await redis.close();
      return;
    }
    case 'cloud_ranges': {
      /* The TS CloudHandler writes the legacy cloud_ranges namespace with
         the ranges joined and no regions (cloud.ts), and fetches only the
         built-in providers; an unknown provider fetches empty. */
      const redis = await redisManager(corpusCase.prefix);
      const handler = new CloudHandler(defaultLogger);
      await handler.initializeRedis(redis, new Set([args['provider'] as string]), (args['ttl'] as number) ?? 3600);
      await redis.close();
      return;
    }
    case 'cloud_ip_store': {
      /* No TS seam: no RedisCloudIpStore port, no cloud_ip_v2 namespace. */
      return;
    }
    case 'dynamic_rules': {
      /* No TS seam: DynamicRuleManager (dynamic-rules.ts) does not persist
         a last_known snapshot. */
      return;
    }
    default:
      throw new Error(`unknown redis interop op ${String(corpusCase.operation.op)}`);
  }
}
