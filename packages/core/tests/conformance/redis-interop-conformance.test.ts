import { afterAll, expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
  assertKindDriven,
  loadCorpusIndex,
  loadKindSuites,
  loadXfail,
  xfailPath,
  XfailLedger,
} from './suite-kinds.js';
import { FROZEN_EPOCH_MS } from './events-harness.js';
import { parseRedisSuite, runRedisCase } from './redis-interop-harness.js';
import type { RedisCase } from './redis-interop-harness.js';

const BASELINE_UPDATE_ENV = 'GUARD_CONFORMANCE_UPDATE_BASELINE';

/* redis_interop-kind conformance (spec 4.1.0): drives the redis_interop
   suite against a live Redis (REDIS_URL) and compares the prefix scan byte
   for byte under the corpus pinning rules. Documented divergences live in
   conformance/ts_redis_interop_xfail.json with the fail-closed per-kind
   drift semantics: failing-not-listed is red, listed-but-passing is red, an
   entry that never ran is red, and a corpus kind with no driver is red. */

/* Determinism: the engine derives ban expiry floats and rate-limit zset
   members from Date.now(); the corpus pins those by shape, and a timestamp
   with a 000 millisecond component would stringify without a fractional
   part one run in a thousand. Freezing Date at a fixed non-round instant
   removes that luck (timers stay real; nothing advances the fake clock). */
vi.useFakeTimers({ toFake: ['Date'], now: FROZEN_EPOCH_MS });
afterAll(() => {
  vi.useRealTimers();
});

function redisBaselineReason(corpusCase: RedisCase): string {
  switch (corpusCase.operation.op) {
    case 'rate_limit':
      return corpusCase.expected[0]?.key.includes(':702acf')
        ? 'endpoint-tier rate-limit keys use the raw request path (rate-limit.ts checkRateLimit key construction), not the reference sha256 path digest'
        : 'rate-limit zset/TTL semantics diverge from the pinned record';
    case 'ban_ip':
      return corpusCase.expected[0]?.key.includes('banned_networks')
        ? 'no CIDR network ban write seam: IPBanManager (ip-ban.ts) persists exact IPs only (banned_ips namespace)'
        : 'ban write diverges from the pinned record';
    case 'behavior_usage':
    case 'behavior_return':
      return 'BehaviorTracker (behavior.ts) is memory-only: initializeRedis stores the handler but no usage/return zset is ever written to Redis';
    case 'security_headers':
      return 'SecurityHeadersManager.cacheConfiguration (security-headers.ts) persists JSON.stringify bytes (camelCase hsts keys, no json.dumps spacing), diverging from the reference canonical JSON';
    case 'add_pattern':
      return 'custom pattern registry write diverges from the pinned record';
    case 'ipinfo_database':
      return 'IPInfoManager.initializeRedis (geoip.ts) is an empty stub: no ipinfo:database cache write and no injectable download';
    case 'cloud_ranges':
      return 'CloudHandler (cloud.ts) refresh runs the store flow (the Redis store persists cloud_ip_v2 JSON); the redis-handler cloud_ranges_v2 write path (ranges|regions joined string) only runs with the store opted out, and the drive provider fetches no ranges to record';
    case 'cloud_ip_store':
      return 'no RedisCloudIpStore port: the cloud_ip_v2 namespace does not exist in the TS engine';
    case 'dynamic_rules':
      return 'DynamicRuleManager (dynamic-rules.ts) does not persist a dynamic_rules:last_known snapshot';
    default:
      return 'divergence from the pinned record';
  }
}

test(
  'redis interop matches the vendored guard-core spec 4.1.0 corpus on a live Redis under the committed baseline',
  { timeout: 600_000 },
  async () => {
    const index = await loadCorpusIndex();
    assertKindDriven(index, 'redis_interop', ['redis_interop']);
    const suites = await loadKindSuites(index, 'redis_interop', parseRedisSuite);

    const updateBaseline = process.env[BASELINE_UPDATE_ENV] === '1';
    const ledger = new XfailLedger(updateBaseline ? {} : await loadXfail('redis_interop'));
    const regenerated: Record<string, string> = {};

    for (const { name, suite } of suites) {
      for (const corpusCase of suite.cases) {
        const key = `${name}/${corpusCase.id}`;
        if (updateBaseline) {
          const diffs = await runRedisCase(corpusCase).catch((error: unknown) => [`drive failed: ${(error as Error).message}`]);
          if (diffs.length > 0) regenerated[key] = redisBaselineReason(corpusCase);
          continue;
        }
        ledger.record(key, await runRedisCase(corpusCase));
      }
    }

    if (updateBaseline) {
      const payload = {
        spec_version: '4.1.0',
        _comment: 'Documented divergences of the TS on-the-wire Redis surface against the redis_interop '
          + 'corpus (live Redis, per-case prefix, byte equality per index.json comparison.redis_interop). '
          + 'Fail-closed: a failing case NOT listed here is red; a listed case that now passes is red '
          + '(stale baseline). Each entry names the TS source responsible.',
        cases: regenerated,
      };
      await writeFile(xfailPath('redis_interop'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      console.log(`redis_interop baseline regenerated at conformance/ts_redis_interop_xfail.json (${Object.keys(regenerated).length} entries)`);
      return;
    }

    ledger.finish('redis_interop');
    expect(
      ledger.failures,
      `redis_interop conformance drift:\n${ledger.failures.join('\n')}\nif this follows an intentional corpus or engine change, regenerate the baseline with:\n  ${BASELINE_UPDATE_ENV}=1 pnpm --filter @guardcore/core exec vitest run tests/conformance/redis-interop-conformance.test.ts`,
    ).toEqual([]);
  },
);
