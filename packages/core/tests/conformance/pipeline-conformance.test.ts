import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import { createMockResponseFactory } from '../helpers.js';
import {
  CORPUS_DIR,
  loadPipelineSuites,
  loadPipelineXfail,
} from './pipeline-harness.js';
import type { PipelineCase, PipelineDrive } from './pipeline-harness.js';

/* Pipeline-kind conformance suites (spec 4.1.0): replays the reference
   pipeline harness cases through the real TS middleware pipeline. Comparison
   follows specs/fixtures/README.md: only the keys present in each expected
   record are compared. The events key is compared through a recording agent
   handler (the engine's real SecurityEventBus surface). Documented
   divergences live in conformance/ts_pipeline_xfail.json with fail-closed
   drift semantics. */

const EVENTS: Array<{ eventType: string; actionTaken: string }> = [];

function recordingAgentHandler(): AgentHandlerProtocol {
  return {
    async sendEvent(event: { eventType: string; actionTaken: string }) {
      EVENTS.push({ eventType: event.eventType, actionTaken: event.actionTaken });
    },
  } as unknown as AgentHandlerProtocol;
}

function corpusGeo(table: Record<string, string>) {
  return {
    isInitialized: true,
    getCountry: (ip: string): string | null => table[ip] ?? null,
    initialize: async (): Promise<void> => {},
    initializeRedis: async (): Promise<void> => {},
    initializeAgent: async (): Promise<void> => {},
    refresh: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
  };
}

function toCamelConfig(raw: Record<string, unknown>, geo: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    enableRedis: false,
    enableRateLimitAutoBan: false,
    enableIpBanning: false,
    autoBanThreshold: 1000,
  };
  const direct: Array<[string, string]> = [
    ['whitelist', 'whitelist'],
    ['blacklist', 'blacklist'],
    ['exempt_ips', 'exemptIps'],
    ['blocked_user_agents', 'blockedUserAgents'],
    ['blocked_countries', 'blockedCountries'],
    ['whitelist_countries', 'whitelistCountries'],
    ['rate_limit', 'rateLimit'],
    ['rate_limit_window', 'rateLimitWindow'],
    ['passive_mode', 'passiveMode'],
    ['custom_error_responses', 'customErrorResponses'],
    ['enable_cors', 'enableCors'],
    ['cors_allow_origins', 'corsAllowOrigins'],
    ['cors_allow_methods', 'corsAllowMethods'],
    ['cors_allow_headers', 'corsAllowHeaders'],
    ['cors_allow_credentials', 'corsAllowCredentials'],
  ];
  for (const [from, to] of direct) {
    if (from in raw) out[to] = raw[from];
  }
  if ('endpoint_rate_limits' in raw) {
    const tiers: Record<string, [number, number]> = {};
    for (const [p, pair] of Object.entries(raw['endpoint_rate_limits'] as Record<string, [number, number]>)) {
      tiers[p] = [pair[0], pair[1]];
    }
    out['endpointRateLimits'] = tiers;
  }
  if (('blocked_countries' in (raw as Record<string, unknown>) && (raw['blocked_countries'] as string[]).length > 0) || ('whitelist_countries' in raw && (raw['whitelist_countries'] as string[]).length > 0)) {
    out['geoResolver'] = (ip: string) => geo[ip] ?? null;
  }
  if ('security_headers' in raw) {
    const sh = raw['security_headers'] as Record<string, unknown>;
    const mapped: Record<string, unknown> = { ...sh };
    if ('hsts' in sh) {
      const hsts = sh['hsts'] as Record<string, unknown>;
      mapped['hsts'] = {
        maxAge: hsts['max_age'],
        includeSubdomains: hsts['include_subdomains'] ?? true,
        preload: hsts['preload'] ?? false,
      };
    }
    out['securityHeaders'] = mapped;
  }
  return out;
}

function buildRoute(overrides: Record<string, unknown>): RouteConfig {
  const rc = new RouteConfig();
  if ('rate_limit' in overrides) rc.rateLimit = overrides['rate_limit'] as number;
  if ('rate_limit_window' in overrides) rc.rateLimitWindow = overrides['rate_limit_window'] as number;
  if ('ip_whitelist' in overrides) rc.ipWhitelist = overrides['ip_whitelist'] as string[];
  if ('ip_blacklist' in overrides) rc.ipBlacklist = overrides['ip_blacklist'] as string[];
  if ('blocked_countries' in overrides) rc.blockedCountries = overrides['blocked_countries'] as string[];
  if ('whitelist_countries' in overrides) rc.whitelistCountries = overrides['whitelist_countries'] as string[];
  if ('blocked_user_agents' in overrides) rc.blockedUserAgents = overrides['blocked_user_agents'] as string[];
  if ('bypassed_checks' in overrides) rc.bypassedChecks = new Set(overrides['bypassed_checks'] as string[]);
  if ('enable_suspicious_detection' in overrides) {
    rc.enableSuspiciousDetection = overrides['enable_suspicious_detection'] as boolean;
  }
  if ('excluded_detection_headers' in overrides) {
    rc.excludedDetectionHeaders = new Set(overrides['excluded_detection_headers'] as string[]);
  }
  return rc;
}

async function runCase(c: PipelineCase): Promise<string[]> {
  const failures: string[] = [];
  const payloads: Array<Record<string, unknown>> = [];
  EVENTS.length = 0;
  const configRaw = toCamelConfig(c.config, c.geo_countries ?? {});
  configRaw['onBlock'] = (_request: unknown, payload: Record<string, unknown>) => {
    const observable: Record<string, unknown> = {};
    for (const key of ['check_name', 'reason', 'trigger_info', 'passive_mode', 'client_ip', 'path', 'method', 'status_code']) {
      observable[key] = payload[key];
    }
    payloads.push(observable);
  };

  let config: ResolvedSecurityConfig;
  try {
    config = SecurityConfigSchema.parse(configRaw);
  } catch (e) {
    return [`DIVERGENCE config rejected: ${(e as Error).message}`];
  }
  const components = await initializeSecurityMiddleware(
    config,
    defaultLogger,
    createMockResponseFactory(),
    recordingAgentHandler(),
    corpusGeo(c.geo_countries ?? {}),
  );

  for (let index = 0; index < c.drives.length; index++) {
    const drive = c.drives[index] as PipelineDrive;
    payloads.length = 0;
    const eventsBefore = EVENTS.length;
    if (index >= c.expected.length) break;
    const want = c.expected[index];

    const urlPath = drive.url_path ?? '/api';
    const state: Record<string, unknown> = { clientIp: drive.client_ip };
    if (c.routes?.[urlPath]) state["guardRouteConfig"] = buildRoute(c.routes[urlPath]);
    const encoder = new TextEncoder();
    const bodyBytes = drive.body ? encoder.encode(drive.body) : new Uint8Array(0);
    const request = {
      urlPath,
      urlScheme: 'http',
      urlFull: `http://example.com${urlPath}`,
      urlReplaceScheme: (s: string) => `${s}://example.com${urlPath}`,
      method: drive.method ?? 'GET',
      clientHost: drive.client_ip,
      headers: Object.fromEntries(
        Object.entries(drive.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
      ),
      queryParams: {},
      body: async () => bodyBytes,
      state: state as never,
      scope: {},
    };

    let resp: { statusCode: number; headers: Record<string, string>; bodyText?: string | null } | null;
    if (drive.stage === 'process_response') {
      const mock = createMockResponseFactory().createResponse(
        drive.response_body ?? 'ok',
        drive.response_status ?? 200,
      );
      resp = await components.errorResponseFactory.processResponse(
        request as never,
        mock,
        0,
        (state['guardRouteConfig'] as RouteConfig) ?? null,
      );
    } else {
      resp = (await components.pipeline.execute(request as never)) as never;
    }

    const prefix = `drive ${index}`;
    if ('status' in want) {
      const got = resp === null ? null : resp.statusCode;
      if (got !== want['status']) {
        failures.push(`${prefix} status: got ${String(got)} want ${String(want['status'])}`);
        continue;
      }
    }
    if (resp !== null) {
      if ('body' in want && resp.bodyText !== want['body']) {
        failures.push(`${prefix} body: got ${String(resp.bodyText)} want ${String(want['body'])}`);
      }
      const wantHeaders = want['headers'] as Record<string, string> | undefined;
      if (wantHeaders) {
        for (const [name, value] of Object.entries(wantHeaders)) {
          if (resp.headers[name] !== value) {
            failures.push(`${prefix} header ${name}: got ${String(resp.headers[name])} want ${String(value)}`);
          }
        }
      }
    }
    for (const [key, stateKey] of [['is_exempt', 'isExempt'], ['is_whitelisted', 'isWhitelisted']]) {
      if (key in want) {
        const got = (state as Record<string, unknown>)[stateKey] ?? null;
        if (got !== want[key]) {
          failures.push(`${prefix} ${key}: got ${String(got)} want ${String(want[key])}`);
        }
      }
    }
    if ('events' in want) {
      const got = EVENTS.slice(eventsBefore).map((e) => [e.eventType, e.actionTaken]);
      const wanted = want['events'] as unknown[];
      if (JSON.stringify(got) !== JSON.stringify(wanted)) {
        failures.push(`${prefix} events: got ${JSON.stringify(got)} want ${JSON.stringify(wanted)}`);
      }
    }
    if ('on_block' in want) {
      const wantPayloads = want['on_block'] as Array<Record<string, unknown>>;
      if (payloads.length !== wantPayloads.length) {
        failures.push(`${prefix} on_block count: got ${payloads.length} want ${wantPayloads.length}`);
      } else {
        for (let pi = 0; pi < wantPayloads.length; pi++) {
          for (const [key, value] of Object.entries(wantPayloads[pi])) {
            if (JSON.stringify(payloads[pi][key]) !== JSON.stringify(value)) {
              failures.push(`${prefix} on_block ${key}: got ${String(payloads[pi][key])} want ${String(value)}`);
            }
          }
        }
      }
    }
  }
  return failures;
}

test(
  'pipeline conformance against the guard-core spec 4.1.0 corpus',
  { timeout: 600_000 },
  async () => {
    const indexText = await readFile(path.join(CORPUS_DIR, 'index.json'), 'utf8');
    const index = JSON.parse(indexText) as {
      spec_version: string;
      suites: Record<string, { kind?: string; consumers?: string[] }>;
    };
    expect(index.spec_version).toBe('4.1.0');

    const suites = await loadPipelineSuites(index);
    const xfail = await loadPipelineXfail();

    let total = 0;
    let failed = 0;
    let xfailed = 0;
    let divergent = 0;
    const failures: string[] = [];
    const seenXfail = new Set<string>();

    for (const { name, suite } of suites) {
      for (const c of suite.cases) {
        total++;
        const key = `${name}/${c.id}`;
        const diffs = await runCase(c);
        if (diffs.length === 0) {
          if (xfail[key] !== undefined) {
            failures.push(`stale xfail baseline entry ${key}: case now passes; remove the entry`);
          }
          continue;
        }
        if (diffs.length === 1 && diffs[0].startsWith('DIVERGENCE')) {
          divergent++;
          seenXfail.add(key);
          console.log(`DIVERGENCE ${key}: ${diffs[0]}`);
          continue;
        }
        if (xfail[key] !== undefined) {
          xfailed++;
          seenXfail.add(key);
          console.log(`xfail ${key} [${xfail[key]}]: ${diffs.join('; ')}`);
          continue;
        }
        failed++;
        failures.push(`${key}: ${diffs.join('; ')}`);
      }
    }
    for (const key of Object.keys(xfail)) {
      if (!seenXfail.has(key)) {
        failures.push(`xfail baseline entry ${key} never ran or now passes; corpus changed?`);
      }
    }
    console.log(
      `pipeline conformance gate: ${total - failed - divergent - xfailed} passed, ${failed} failed, ${xfailed} xfail, ${divergent} config divergences (spec 4.1.0)`,
    );
    expect(failures, `pipeline conformance drift:\n${failures.join('\n')}`).toEqual([]);
  },
);
