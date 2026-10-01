import { expect, test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
  assertKindDriven,
  loadCorpusIndex,
  loadKindSuites,
  loadXfail,
  xfailPath,
  XfailLedger,
} from './suite-kinds.js';
import { EventsCaseRun, parseEventSuite } from './events-harness.js';

const BASELINE_UPDATE_ENV = 'GUARD_CONFORMANCE_UPDATE_BASELINE';

/* events-kind conformance (spec 4.1.0): drives the event_stream suite through
   the real TS engine event surface and compares the captured envelopes.
   Documented divergences live in conformance/ts_events_xfail.json with the
   fail-closed per-kind drift semantics: failing-not-listed is red,
   listed-but-passing is red, an entry that never ran is red, and a corpus
   kind with no driver is red. */

/* Where an expected event type has no TS emitter at all, the baseline entry
   names the responsible TS source. Everything else is the mechanical diff
   (the envelope comparison records absent fields and value mismatches). */
const EVENT_TYPE_GAPS: Readonly<Record<string, string>> = {
  access_denied: 'the TS decorator senders (decorators/base.ts) carry no ipAddress/endpoint/method envelope fields',
  authentication_failed: 'the TS decorator senders (decorators/base.ts) carry no ipAddress/endpoint/method envelope fields',
  cloud_blocked: 'the TS cloud_blocked envelope (core/events/event-bus.ts sendCloudDetectionEvents) carries a different reason and metadata contract',
  content_filtered: 'RequestSizeContentCheck (core/checks/implementations/request-size-content.ts) emits no event',
  country_blocked: 'the TS country verdict (core/checks/implementations/ip-security.ts) emits ip_blocked, not country_blocked',
  csp_violation: 'SecurityHeadersManager (handlers/security-headers.ts) has no CSP report validation and no csp_violation event',
  custom_request_check: 'CustomRequestCheck (core/checks/implementations/custom-request.ts) emits no event',
  detection_engine_callback_error: 'PerformanceMonitor.checkAnomalies (detection-engine/monitor.ts) swallows callback errors',
  dynamic_rule_updated: 'DynamicRuleManager.updateRules (handlers/dynamic-rules.ts) emits only dynamic_rule_applied',
  emergency_mode_activated: 'DynamicRuleManager.updateRules (handlers/dynamic-rules.ts) has no emergency-lockdown event',
  geo_lookup_failed: 'IPInfoManager.initialize (handlers/geoip.ts) has no injectable download and emits no event',
  https_enforced: 'no https_enforced emission path: HttpsEnforcementCheck (core/checks/implementations/https-enforcement.ts) redirects via ErrorResponseFactory.createHttpsRedirect without emitting, and SecurityEventBus.sendHttpsViolationEvent (core/events/event-bus.ts) has no call site',
  ip_ban_failed: 'no ip_ban_failed escalation telemetry in the TS engine (handlers/ip-ban.ts, core/checks/helpers.ts resolveThresholdBan)',
  pattern_added: 'SusPatternsManager.addPattern (handlers/sus-patterns.ts) emits no event',
  pattern_detected: 'SusPatternsManager.detect (handlers/sus-patterns.ts) emits no event',
  pattern_removed: 'SusPatternsManager.removePattern (handlers/sus-patterns.ts) emits no event',
  rate_limited: 'the TS rate-limit tiers (core/checks/implementations/rate-limit.ts) emit no rate_limited middleware event: the global tier is silent and the endpoint tier emits dynamic_rule_violation',
  rate_limit_script_reloaded: 'RateLimitManager (handlers/rate-limit.ts) has no NOSCRIPT recovery telemetry',
  redis_connection: 'RedisManager.initialize (handlers/redis.ts) only logs',
  redis_error: 'RedisManager.initialize (handlers/redis.ts) only logs',
  security_headers_applied: 'SecurityHeadersManager.getHeaders (handlers/security-headers.ts) emits no event',
  suspicious_request: 'extractClientIp (utils.ts) emits suspicious_request only when trustedProxies is empty; the untrusted-proxy XFF path is silent',
};

const HANDLER_NAME_NOTE =
  'envelope field handler_name is not observable: SecurityEventBus.sendMiddlewareEvent (core/events/event-bus.ts) carries no handler_name';

function baselineReason(diffs: string[]): string {
  const notes: string[] = [];
  for (const diff of diffs) {
    const countMatch = /^event count: want (\d+) \[(.*)\], got (\d+) \[(.*)\]$/.exec(diff);
    if (countMatch) {
      const gotTypes = countMatch[4] ?? '';
      const missing = (countMatch[2] ?? '')
        .split(', ')
        .filter((type) => type !== '' && !gotTypes.includes(type));
      for (const type of missing) {
        notes.push(EVENT_TYPE_GAPS[type] ?? `no TS emitter for event type ${type}`);
      }
      continue;
    }
    if (diff.includes('field handler_name')) {
      if (!notes.includes(HANDLER_NAME_NOTE)) notes.push(HANDLER_NAME_NOTE);
      continue;
    }
    notes.push(diff);
  }
  return notes.join('; ');
}

test(
  'event stream matches the vendored guard-core spec 4.1.0 corpus under the committed baseline',
  { timeout: 600_000 },
  async () => {
    const index = await loadCorpusIndex();
    assertKindDriven(index, 'events', ['event_stream']);
    const suites = await loadKindSuites(index, 'events', parseEventSuite);
    const updateBaseline = process.env[BASELINE_UPDATE_ENV] === '1';

    const ledger = new XfailLedger(updateBaseline ? {} : await loadXfail('events'));
    const regenerated: Record<string, string> = {};

    for (const { name, suite } of suites) {
      for (const corpusCase of suite.cases) {
        const key = `${name}/${corpusCase.id}`;
        const diffs = await new EventsCaseRun().run(corpusCase);
        if (updateBaseline) {
          if (diffs.length > 0) regenerated[key] = baselineReason(diffs);
          continue;
        }
        ledger.record(key, diffs);
      }
    }

    if (updateBaseline) {
      const payload = {
        spec_version: '4.1.0',
        _comment: 'Documented divergences of the TS event surface against the event_stream corpus. '
          + 'Fail-closed: a failing case NOT listed here is red; a listed case that now passes is red '
          + '(stale baseline). The TS event coverage is partial: middleware-bus envelopes carry a smaller '
          + 'field set than the reference SecurityEvent, several handler seams emit no event yet, and the '
          + 'envelope comparison records the absent fields. Entries name the TS source responsible.',
        cases: regenerated,
      };
      await writeFile(xfailPath('events'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      console.log(`events baseline regenerated at conformance/ts_events_xfail.json (${Object.keys(regenerated).length} entries)`);
      return;
    }

    ledger.finish('events');
    expect(
      ledger.failures,
      `events conformance drift:\n${ledger.failures.join('\n')}\nif this follows an intentional corpus or engine change, regenerate the baseline with:\n  ${BASELINE_UPDATE_ENV}=1 pnpm --filter @guardcore/core exec vitest run tests/conformance/events-conformance.test.ts`,
    ).toEqual([]);
  },
);
