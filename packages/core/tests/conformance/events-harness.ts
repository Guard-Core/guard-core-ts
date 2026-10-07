import { SecurityConfigSchema } from '../../src/models/config.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { BehaviorRule } from '../../src/models/behavior-rule.js';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import { BaseSecurityDecorator } from '../../src/decorators/base.js';
import { BehaviorTracker } from '../../src/handlers/behavior.js';
import { DynamicRuleManager } from '../../src/handlers/dynamic-rules.js';
import { IPInfoManager } from '../../src/handlers/geoip.js';
import { IPBanManager } from '../../src/handlers/ip-ban.js';
import { PerformanceMonitor } from '../../src/detection-engine/monitor.js';
import { RateLimitManager } from '../../src/handlers/rate-limit.js';
import { RedisManager } from '../../src/handlers/redis.js';
import { SecurityHeadersManager } from '../../src/handlers/security-headers.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { extractClientIp } from '../../src/utils.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { GeoIPHandler } from '../../src/protocols/geo-ip.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import { CloudHandler } from '../../src/handlers/cloud.js';
import { corpusConfigToCamel, corpusRoutesToRouteConfig, defaultSafetyKnobs, EVENTS_REDIS_PREFIX } from './events-config.js';
import { canonicalJson, VOLATILE_EVENT_FIELDS } from './suite-kinds.js';
import { createMockResponseFactory } from '../helpers.js';

/* events-kind conformance harness (spec 4.1.0, suite event_stream).

   Drives the real TS engine event surface in-process and captures every
   emitted event object, the way specs/fixtures/tools/events_harness.py
   drives the reference. Two step kinds:

   - pipeline drive: one request through the real SecurityCheckPipeline of a
     middleware initialized with a capturing agent handler;
   - handler call: a direct call against the engine component that owns the
     event seam (ip ban, behavior tracker, pattern manager, monitor, dynamic
     rules, decorator senders, validator, bypass handler, redis manager,
     rate limiter, security headers, client-ip extraction).

   Comparison follows index.json comparison.events_envelopes: the observed
   stream is the ordered flat list of captured envelopes (volatile fields
   dropped recursively, camelCase normalized to the corpus snake_case), and
   only the keys present in each expected envelope are compared. A field the
   TS envelope structurally cannot carry is recorded as absent; absence
   matches an expected null and diverges from an expected value.

   Seams the TS engine does not have are honest driver gaps: the driver
   notes the gap (or drives the closest real seam to surface the emission
   gap) instead of exercising an unrelated path. Those notes feed the
   per-case entries in conformance/ts_events_xfail.json. */

export interface EventDrive {
  client_ip?: string;
  method?: string;
  url_path?: string;
  headers?: Record<string, string>;
  body?: string;
  guard_route_unresolved?: boolean;
  drop_cached_client_ip?: boolean;
  call?: string;
  [key: string]: unknown;
}

export interface EventCase {
  id: string;
  config: Record<string, unknown>;
  geo_countries: Record<string, string>;
  routes: Record<string, Record<string, unknown>>;
  drives: EventDrive[];
  expected: Array<Record<string, unknown>>;
  xfail?: boolean;
  xfail_reason?: string;
}

export interface EventSuite {
  suite: string;
  kind: string;
  doc?: string;
  cases: EventCase[];
}

export function parseEventSuite(text: string, name: string): EventSuite {
  const obj = JSON.parse(text) as Record<string, unknown>;
  if (obj['suite'] !== name) {
    throw new Error(`${name}.json declares suite "${String(obj['suite'])}"`);
  }
  if (obj['kind'] !== 'events') {
    throw new Error(`${name}.json declares kind "${String(obj['kind'])}", expected events`);
  }
  if (!Array.isArray(obj['cases'])) {
    throw new Error(`${name}.json: "cases" must be an array`);
  }
  return { suite: name, kind: 'events', doc: obj['doc'] as string | undefined, cases: obj['cases'] as EventCase[] };
}

/* Determinism: the corpus pins wall-clock-derived float shapes (ban expiry
   strings, rate-limit zset members) only by regex, but a Date.now() whose
   millisecond component is 000 stringifies without a fractional part in JS
   and would break the pinned shape one run in a thousand. Freezing the clock
   at a fixed non-round instant removes that luck; captured timestamps are
   volatile and dropped anyway. */
export const FROZEN_EPOCH_MS = 1767225600123; // 2026-01-01T00:00:00.123Z

export function eventsRedisUrl(): string {
  /* The reference harness pins the corpus redis URL as a constant so the
     captured redis_url metadata is deterministic. */
  return 'redis://localhost:6379/0';
}

/* Widened runtime registry: handler-initializer returns the full handler
   set; the public HandlerRegistry interface narrows to three fields. */
interface FullRegistry {
  redisHandler: RedisManager | null;
  ipBanHandler: IPBanManager;
  rateLimitHandler: RateLimitManager;
  cloudHandler: CloudHandler;
  susPatternsHandler: SusPatternsManager;
  securityHeadersHandler: SecurityHeadersManager;
  dynamicRuleHandler: DynamicRuleManager;
}

interface MiddlewareComponentsLike {
  registry: FullRegistry;
  pipeline: { execute(request: GuardRequest): Promise<unknown> };
  validator: { isPathExcluded(request: GuardRequest): Promise<boolean> };
  bypassHandler: {
    handleSecurityBypass(
      request: GuardRequest,
      callNext: (req: GuardRequest) => Promise<unknown>,
      routeConfig: RouteConfig | null,
    ): Promise<unknown>;
  };
  errorResponseFactory: { createErrorResponse(statusCode: number, message: string): Promise<unknown> };
}

interface CapturedEvent extends Record<string, unknown> {
  timestamp: Date;
}

function corpusRequest(
  overrides: {
    client_ip?: string;
    url_path?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
  routes: Record<string, Record<string, unknown>>,
): GuardRequest {
  const urlPath = overrides.url_path ?? '/api';
  const encoder = new TextEncoder();
  const bodyBytes = overrides.body ? encoder.encode(overrides.body) : new Uint8Array(0);
  const headers = Object.fromEntries(
    Object.entries(overrides.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  /* The reference _PipelineRequest derives content-length from the body when
     the drive does not pin it. */
  if (bodyBytes.length > 0 && !('content-length' in headers)) {
    headers['content-length'] = String(bodyBytes.length);
  }
  const state: Record<string, unknown> = { clientIp: overrides.client_ip };
  if (routes[urlPath]) state['guardRouteConfig'] = corpusRoutesToRouteConfig(routes[urlPath]);
  return {
    urlPath,
    urlScheme: 'http',
    urlFull: `http://example.com${urlPath}`,
    /* Plain display form without the path, matching the reference mock's
       url_replace_scheme. */
    urlReplaceScheme: (s: string) => `${s}://example.com`,
    method: overrides.method ?? 'GET',
    clientHost: overrides.client_ip,
    headers,
    queryParams: {},
    body: async () => bodyBytes,
    state: state as never,
    scope: {},
  } as unknown as GuardRequest;
}

function corpusGeoStub(table: Record<string, string>): GeoIPHandler {
  return {
    isInitialized: true,
    getCountry: (ip: string): string | null => table[ip] ?? null,
    initialize: async (): Promise<void> => {},
    initializeRedis: async (): Promise<void> => {},
    initializeAgent: async (): Promise<void> => {},
    refresh: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
  } as unknown as GeoIPHandler;
}

export class EventsCaseRun {
  private readonly sink: CapturedEvent[] = [];
  private dynamicRulesPayload: unknown = null;

  observedEnvelopes(): Array<Record<string, unknown>> {
    return this.sink;
  }

  async run(corpusCase: EventCase): Promise<string[]> {
    const rawConfig = corpusConfigToCamel(corpusCase.config, corpusCase.geo_countries ?? {});
    let config: ResolvedSecurityConfig;
    try {
      config = SecurityConfigSchema.parse(rawConfig);
    } catch (error: unknown) {
      return [`DIVERGENCE config rejected: ${(error as Error).message}`];
    }

    const agent = this.wireAgent();
    const geo = corpusGeoStub(corpusCase.geo_countries ?? {});
    const components = (await initializeSecurityMiddleware(
      config,
      defaultLogger,
      createMockResponseFactory(),
      agent,
      geo,
    )) as unknown as MiddlewareComponentsLike;
    /* The reference harness runs every pipeline drive against the fresh
       engine state from reset_global_state(): the sus-patterns and security
       headers module singletons carry no agent handler (prepare() never
       attaches one; the direct handler drives attach theirs explicitly).
       Mirror that wiring by detaching the initializer-wired managers, so a
       pipeline drive captures only the middleware-bus events like the
       reference capture run (handler-driven direct drives build their own
       manager instances). */
    (components.registry.susPatternsHandler as { agentHandler: unknown })['agentHandler'] = null;
    (components.registry.securityHeadersHandler as { agentHandler: unknown })['agentHandler'] = null;

    for (const drive of corpusCase.drives) {
      try {
        await this.step(components, config, agent, geo, drive, corpusCase.routes);
      } catch (error: unknown) {
        /* A throwing drive is itself an observation: the seam misbehaved.
           Recorded into the stream so the count comparison sees it. */
        this.sink.push({ timestamp: new Date(FROZEN_EPOCH_MS), driverError: (error as Error).message });
      }
    }
    await this.cleanup(components);

    return compareEnvelopes(corpusCase.expected, this.observedEnvelopes());
  }

  private wireAgent(): AgentHandlerProtocol {
    const self = this;
    return {
      async sendEvent(event: unknown) {
        self.sink.push(
          (event as Record<string, unknown>) instanceof Object && 'timestamp' in (event as Record<string, unknown>)
            ? (event as CapturedEvent)
            : { timestamp: new Date(FROZEN_EPOCH_MS), ...(event as Record<string, unknown>) },
        );
      },
      async getDynamicRules() {
        return self.dynamicRulesPayload;
      },
      async sendMetric(): Promise<void> {},
      async start(): Promise<void> {},
      async stop(): Promise<void> {},
      async flushBuffer(): Promise<void> {},
      async healthCheck(): Promise<boolean> {
        return true;
      },
      async initializeRedis(): Promise<void> {},
    } as unknown as AgentHandlerProtocol;
  }

  private async step(
    components: MiddlewareComponentsLike,
    config: ResolvedSecurityConfig,
    agent: AgentHandlerProtocol,
    geo: GeoIPHandler,
    drive: EventDrive,
    routes: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    if (drive.call === 'cloud_stub') {
      /* The reference harness pins the cloud handler's lookup answers
         (provider + network detail) with the capturing agent wired; the TS
         seam is the CloudProviderCheck's private handler reference. */
      const check = findCheck(components, 'cloud_provider');
      const stub = new CloudHandler(defaultLogger);
      stub['isCloudIp'] = (): boolean => true;
      (stub as unknown as { getCloudProviderDetails: () => [string, string] })['getCloudProviderDetails'] = (): [string, string] => [
        (drive['provider'] as string) ?? 'AWS',
        (drive['network'] as string) ?? '203.0.113.0/24',
      ];
      await stub.initializeAgent(agent);
      check['cloudHandler'] = stub;
      return;
    }
    if (drive.call === 'ipban_fault') {
      components.registry.ipBanHandler['banIp'] = async (): Promise<boolean> => {
        throw new Error('corpus injected ban failure');
      };
      return;
    }
    if (drive.call !== undefined) {
      await this.call(components, config, agent, geo, drive);
      return;
    }
    const request = corpusRequest(
      {
        client_ip: drive.client_ip,
        url_path: drive.url_path,
        method: drive.method,
        headers: drive.headers,
        body: drive.body,
      },
      routes,
    );
    if (drive.guard_route_unresolved) {
      (request.state as Record<string, unknown>)['guard_route_unresolved'] = true;
    }
    /* Adapter-dispatch mirror (reference _EventsMiddleware.dispatch): the
       middleware resolves the client identity through extract_client_ip with
       the capturing agent before the pipeline runs, so an untrusted
       X-Forwarded-For chain reports the spoofing event exactly once.
       drop_cached_client_ip deletes the preset identity first, modeling the
       first request. */
    if (drive.drop_cached_client_ip) {
      delete (request.state as Record<string, unknown>).clientIp;
    }
    (request.state as Record<string, unknown>).clientIp = await extractClientIp(request, config, agent);
    await components.pipeline.execute(request);
  }

  private async call(
    components: MiddlewareComponentsLike,
    config: ResolvedSecurityConfig,
    agent: AgentHandlerProtocol,
    geo: GeoIPHandler,
    drive: EventDrive,
  ): Promise<void> {
    switch (drive.call) {
      case 'ban_ip': {
        await components.registry.ipBanHandler.initializeAgent(agent);
        await components.registry.ipBanHandler.banIp(
          drive['ip'] as string,
          (drive['duration'] as number) ?? 3600,
          (drive['reason'] as string) ?? 'corpus_ban',
        );
        return;
      }
      case 'unban_ip': {
        await components.registry.ipBanHandler.initializeAgent(agent);
        await components.registry.ipBanHandler.unbanIp(drive['ip'] as string);
        return;
      }
      case 'behavior_action': {
        const tracker = new BehaviorTracker(config, defaultLogger);
        await tracker.initializeAgent(agent);
        const rule = drive['rule'] as Record<string, unknown>;
        await tracker.applyAction(
          new BehaviorRule(
            rule['rule_type'] as BehaviorRule['ruleType'],
            rule['threshold'] as number,
            (rule['window'] as number) ?? 3600,
            (rule['pattern'] as string | null) ?? null,
            (rule['action'] as BehaviorRule['action']) ?? 'log',
          ),
          drive['ip'] as string,
          (drive['endpoint_id'] as string) ?? 'corpus.endpoint',
          (drive['details'] as string) ?? 'Usage threshold exceeded: 1 calls in 60s',
        );
        return;
      }
      case 'detect': {
        const manager = new SusPatternsManager(config, defaultLogger);
        await manager.initializeAgent(agent);
        await manager.detect(
          drive['content'] as string,
          (drive['ip'] as string) ?? '203.0.113.7',
          (drive['context'] as string) ?? 'request_body',
        );
        return;
      }
      case 'add_pattern': {
        const manager = new SusPatternsManager(config, defaultLogger);
        await manager.initializeAgent(agent);
        await manager.addPattern(drive['pattern'] as string);
        return;
      }
      case 'remove_pattern': {
        /* The reference seeds the registry directly with no agent wired so
           the case pins the removal event alone (totals stay deterministic);
           the TS manager mirrors that: seed with the agent detached, attach,
           then remove. */
        const manager = new SusPatternsManager(config, defaultLogger);
        await manager.addPattern(drive['pattern'] as string);
        await manager.initializeAgent(agent);
        await manager.removePattern(drive['pattern'] as string);
        return;
      }
      case 'monitor_anomaly': {
        const monitor = new PerformanceMonitor(
          (drive['anomaly_threshold'] as number) ?? 3.0,
          (drive['slow_pattern_threshold'] as number) ?? 0.1,
          1000,
          1000,
        );
        for (const sample of (drive['samples'] as Array<Record<string, unknown>>) ?? []) {
          await monitor.recordMetric(
            sample['pattern'] as string,
            sample['execution_time'] as number,
            (sample['content_length'] as number) ?? 128,
            (sample['matched'] as boolean) ?? false,
            (sample['timeout'] as boolean) ?? false,
            agent,
          );
        }
        return;
      }
      case 'monitor_callback_fault': {
        const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000);
        monitor.registerAnomalyCallback(() => {
          throw new Error('corpus injected callback failure');
        });
        await monitor.recordMetric(drive['pattern'] as string, (drive['execution_time'] as number) ?? 0.5, 128, false, false, agent);
        return;
      }
      case 'dynamic_rules': {
        const payload = drive['rules'] as Record<string, unknown>;
        this.dynamicRulesPayload = {
          ruleId: payload['rule_id'],
          version: payload['version'],
          timestamp: '2026-01-01T00:00:00.000Z',
          emergencyMode: payload['emergency_mode'] === true,
          emergencyWhitelist: (payload['emergency_whitelist'] as string[]) ?? [],
        };
        const manager = new DynamicRuleManager(config, defaultLogger);
        await manager.initializeAgent(agent);
        await manager.updateRules();
        await manager.stop();
        return;
      }
      case 'decorator_event': {
        const decorator = new BaseSecurityDecorator(config);
        await decorator.initializeAgent(agent);
        const request = corpusRequest(
          { client_ip: drive['client_ip'] as string, url_path: (drive['url_path'] as string) ?? '/api' },
          {},
        );
        const kwargs = (drive['kwargs'] ?? {}) as Record<string, unknown>;
        if (drive['send'] === 'send_access_denied_event') {
          await decorator.sendAccessDeniedEvent(
            request,
            kwargs['reason'] as string,
            kwargs['decorator_type'] as string,
            { violation_type: kwargs['violation_type'] },
          );
        } else {
          await decorator.sendAuthenticationFailedEvent(request, kwargs['reason'] as string, kwargs['auth_type'] as string);
        }
        return;
      }
      case 'geo_country_stub': {
        /* The reference seam is IPInfoManager.check_country_access driven
           directly with the case's blocked list and the stubbed country
           answer (events_harness.py _call_geo_country_stub). */
        const handler = new IPInfoManager(defaultLogger);
        const savedGetCountry = handler.getCountry.bind(handler);
        handler['getCountry'] = (ip: string): string | null =>
          ip === (drive['ip'] as string) ? ((drive['country'] as string) ?? 'CN') : savedGetCountry(ip);
        await handler.initializeAgent(agent);
        await handler.checkCountryAccess(
          drive['ip'] as string,
          (drive['blocked_countries'] as string[]) ?? ['CN'],
        );
        return;
      }
      case 'geo_download_failure': {
        /* The TS initialize() failure path emits EVENT_GEO_LOOKUP_FAILED
           (database_download_failed); drive the real initialize so the
           emission gap or match is observed, not skipped. */
        const handler = new IPInfoManager(defaultLogger);
        await handler.initializeAgent(agent);
        await handler.initialize();
        return;
      }
      case 'csp_report': {
        const manager = new SecurityHeadersManager(defaultLogger);
        await manager.initializeAgent(agent);
        const valid = await manager.validateCspReport(drive['report'] as Record<string, unknown>);
        if (!valid) throw new Error('corpus CSP report was rejected as invalid');
        return;
      }
      case 'path_excluded': {
        const request = corpusRequest(
          { client_ip: drive['client_ip'] as string, url_path: (drive['url_path'] as string) ?? '/health' },
          {},
        );
        await components.validator.isPathExcluded(request);
        return;
      }
      case 'rate_limit_script_reload': {
        /* The reference harness re-points the config at the corpus redis
           (model_copy update) for this scenario; the TS drive does the same
           at the call level. */
        const redisConfig = SecurityConfigSchema.parse({
          ...defaultSafetyKnobs(),
          enableRedis: true,
          enableRateLimiting: true,
          redisUrl: eventsRedisUrl(),
          redisPrefix: EVENTS_REDIS_PREFIX,
        });
        const redis = new RedisManager(redisConfig, defaultLogger);
        await redis.initialize();
        const manager = new RateLimitManager(defaultLogger, redisConfig);
        await manager.initializeRedis(redis);
        await manager.initializeAgent(agent);
        /* Force the NOSCRIPT path: a bogus script sha makes evalsha fail and
           the manager fall back (rate-limit.ts getRedisRequestCount). */
        manager['rateLimitScriptSha'] = 'f'.repeat(40);
        const request = corpusRequest(
          { client_ip: drive['client_ip'] as string, url_path: (drive['url_path'] as string) ?? '/api' },
          {},
        );
        await manager.checkRateLimit(
          request,
          drive['client_ip'] as string,
          async (statusCode: number, message: string) =>
            (await components.errorResponseFactory.createErrorResponse(statusCode, message)) as never,
        );
        /* Silent teardown like the reference drive (only the reload event is
           captured). */
        redis['closed'] = true;
        redis['client'] = null;
        return;
      }
      case 'redis_connect': {
        const redisConfig = SecurityConfigSchema.parse({
          ...defaultSafetyKnobs(),
          enableRedis: true,
          redisUrl: eventsRedisUrl(),
          redisPrefix: EVENTS_REDIS_PREFIX,
        });
        const redis = new RedisManager(redisConfig, defaultLogger);
        await redis.initializeAgent(agent);
        await redis.initialize();
        /* The reference drive tears down silently (_closed + _discard_client)
           so only the connection_established event is captured. */
        redis['closed'] = true;
        redis['client'] = null;
        return;
      }
      case 'redis_connect_error': {
        const failing = SecurityConfigSchema.parse({
          ...defaultSafetyKnobs(),
          enableRedis: true,
          redisUrl: 'redis://localhost:59999/0',
          redisPrefix: EVENTS_REDIS_PREFIX,
        });
        const redis = new RedisManager(failing, defaultLogger);
        await redis.initializeAgent(agent);
        await redis.initialize();
        redis['closed'] = true;
        redis['client'] = null;
        return;
      }
      case 'bypass': {
        const urlPath = (drive['url_path'] as string) ?? '/open';
        const request = corpusRequest({ client_ip: drive['client_ip'] as string, url_path: urlPath }, {});
        const routeConfig = new RouteConfig();
        routeConfig.bypassedChecks = new Set(['all']);
        await components.bypassHandler.handleSecurityBypass(
          request,
          async () => ({ statusCode: 200, headers: {}, body: null, bodyText: 'passthrough', setHeader: () => {} }),
          routeConfig,
        );
        return;
      }
      case 'headers_applied': {
        /* The reference drives get_headers(path, config=self.config), so the
           config's HSTS default rides the fresh build; the TS configure()
           seam carries the same default-config headers. */
        const manager = new SecurityHeadersManager(defaultLogger);
        await manager.initializeAgent(agent);
        const headersConfig = config.securityHeaders;
        manager.configure({
          enabled: headersConfig?.enabled,
          hstsMaxAge: headersConfig?.hsts?.maxAge,
          hstsIncludeSubdomains: headersConfig?.hsts?.includeSubdomains,
          hstsPreload: headersConfig?.hsts?.preload,
          frameOptions: headersConfig?.frameOptions,
          contentTypeOptions: headersConfig?.contentTypeOptions,
          xssProtection: headersConfig?.xssProtection,
          referrerPolicy: headersConfig?.referrerPolicy,
          permissionsPolicy: headersConfig?.permissionsPolicy,
          customHeaders: headersConfig?.custom ?? undefined,
        });
        await manager.getHeaders((drive['path'] as string) ?? '/api');
        return;
      }
      case 'suspicious_request': {
        /* The TS seam is extractClientIp (utils.ts); the reference emitter
           handler_name is ip_extraction. drop_cached_client_ip has no TS
           counterpart (nothing is cached in request state). */
        const request = corpusRequest(
          {
            client_ip: drive['client_ip'] as string,
            url_path: (drive['url_path'] as string) ?? '/api',
            headers: drive['headers'],
          },
          {},
        );
        await extractClientIp(request, config, agent);
        return;
      }
      default:
        throw new Error(`unknown events harness call ${String(drive['call'])}`);
    }
  }

  private async cleanup(components: MiddlewareComponentsLike): Promise<void> {
    if (components.registry.redisHandler) {
      try {
        /* Silent teardown: the reference capture run never holds a
           redis-backed close event in the pipeline stream. */
        components.registry.redisHandler['closed'] = true;
        components.registry.redisHandler['client'] = null;
      } catch {
        /* harness cleanup never throws */
      }
    }
  }
}

function findCheck(components: MiddlewareComponentsLike, checkName: string): Record<string, unknown> {
  const checks = (components.pipeline as unknown as { checks: Array<{ checkName: string }> }).checks;
  const found = checks.find((check) => check.checkName === checkName);
  if (!found) throw new Error(`pipeline has no ${checkName} check`);
  return found as unknown as Record<string, unknown>;
}

/* Volatile-dropped recursive comparison over expected-present keys only
   (index.json comparison.events_envelopes + events_volatile_fields). */
export function compareEnvelopes(
  expected: Array<Record<string, unknown>>,
  observed: Array<Record<string, unknown>>,
): string[] {
  const normalized = observed.map((event) => normalizeEvent(event)) as Array<Record<string, unknown>>;
  if (normalized.length !== expected.length) {
    const gotTypes = normalized.map((event) => String(event['event_type'] ?? event['driver_error'] ?? '<none>')).join(', ');
    const wantTypes = expected.map((envelope) => String(envelope['event_type'])).join(', ');
    return [`event count: want ${expected.length} [${wantTypes}], got ${normalized.length} [${gotTypes}]`];
  }
  const diffs: string[] = [];
  for (const [index, event] of normalized.entries()) {
    if (typeof event['driver_error'] === 'string') {
      diffs.push(`drive ${index} threw: ${event['driver_error']}`);
    }
  }
  for (let index = 0; index < expected.length; index++) {
    const want = expected[index] as Record<string, unknown>;
    const got = normalized[index] as Record<string, unknown>;
    for (const [key, wantValue] of Object.entries(want)) {
      if (!(key in got)) {
        if (wantValue !== null) {
          diffs.push(`event ${index} field ${key} not observable in the TS envelope (expected ${JSON.stringify(wantValue)})`);
        }
        continue;
      }
      if (canonicalJson(got[key]) !== canonicalJson(wantValue)) {
        diffs.push(`event ${index} field ${key}: want ${JSON.stringify(wantValue)}, got ${JSON.stringify(got[key])}`);
      }
    }
  }
  return diffs;
}

function normalizeEvent(value: unknown): unknown {
  if (value instanceof Date) return undefined; // volatile timestamp, dropped
  if (Array.isArray(value)) return value.map((item) => normalizeEvent(item));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
      if (VOLATILE_EVENT_FIELDS.has(snakeKey)) continue;
      out[snakeKey] = normalizeEvent(item);
    }
    return out;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Math.round(value * 1e6) / 1e6;
  }
  return value;
}
