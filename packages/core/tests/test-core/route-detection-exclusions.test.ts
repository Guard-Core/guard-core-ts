import { describe, it, expect } from 'vitest';

import { SecurityConfigSchema } from '../../src/models/config.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { resolveDetectionExclusions, disabledCategoriesOf, EXCLUDED_HEADERS } from '../../src/core/routing/detection-exclusions.js';
import { ALL_DETECTION_CATEGORIES } from '../../src/detection-engine/patterns/sources.js';
import { SecurityDecorator } from '../../src/decorators/index.js';
import { scanRequestWithManager } from '../../src/utils.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import type { SusPatternsManager } from '../../src/handlers/sus-patterns.js';

async function makeManager(): Promise<SusPatternsManager> {
  const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
  return new SusPatternsManager(createTestConfig(), defaultLogger);
}

function jsonRequest(
  body: string,
  overrides: Partial<GuardRequest> = {},
): GuardRequest {
  return createMockRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: async () => new TextEncoder().encode(body),
    ...overrides,
  });
}

const SQLI = "1' OR '1'='1";
const XSS = '<script>alert(1)</script>';
const SSRF_URL = 'http://127.0.0.1/admin';

describe('enabledDetectionCategories / detectionScanBody config surface', () => {
  it('defaults enabledDetectionCategories to every pattern-table category and scan body to true', () => {
    const config = createTestConfig();
    expect(config.detectionScanBody).toBe(true);
    expect(new Set(config.enabledDetectionCategories)).toEqual(ALL_DETECTION_CATEGORIES);
  });

  it('rejects unknown categories like _validate_enabled_detection_categories_value', () => {
    expect(() => SecurityConfigSchema.parse({ enabledDetectionCategories: ['sqli', 'not_a_category'] }))
      .toThrow(/Unknown detection categories/);
  });
});

describe('resolveDetectionExclusions', () => {
  it('replaces params, body fields and categories when the route carries a non-null set', () => {
    const config = createTestConfig({ excludedDetectionParams: ['global_q'], excludedDetectionBodyFields: ['global_f'] });
    const route = new RouteConfig();
    route.excludedDetectionParams = new Set(['route_q']);
    route.excludedDetectionBodyFields = new Set(['route_f']);
    route.enabledDetectionCategories = new Set(['sqli']);
    const resolved = resolveDetectionExclusions(config, route);
    expect(resolved.excludedParams).toEqual(new Set(['route_q']));
    expect(resolved.excludedBodyFields).toEqual(new Set(['route_f']));
    expect(resolved.enabledCategories).toEqual(new Set(['sqli']));
    expect(disabledCategoriesOf(resolved).has('sqli')).toBe(false);
    expect(disabledCategoriesOf(resolved).has('xss')).toBe(true);
  });

  it('keeps the global resolution when the route fields stay null', () => {
    const config = createTestConfig({ excludedDetectionParams: ['Global_Q'], detectionScanBody: false });
    const resolved = resolveDetectionExclusions(config, new RouteConfig());
    expect(resolved.excludedParams).toEqual(new Set(['global_q']));
    expect(resolved.enabledCategories).toEqual(ALL_DETECTION_CATEGORIES);
    expect(resolved.scanBody).toBe(false);
  });

  it('merges headers: hardcoded defaults + config + route, lowercased', () => {
    const config = createTestConfig({ excludedDetectionHeaders: ['X-Config-H'] });
    const route = new RouteConfig();
    route.excludedDetectionHeaders = new Set(['X-Route-H']);
    const resolved = resolveDetectionExclusions(config, route);
    for (const name of EXCLUDED_HEADERS) expect(resolved.excludedHeaders.has(name)).toBe(true);
    expect(resolved.excludedHeaders.has('x-config-h')).toBe(true);
    expect(resolved.excludedHeaders.has('x-route-h')).toBe(true);
  });

  it('an empty route category set disables every category and scanBody=false propagates from config', () => {
    const config = createTestConfig({ detectionScanBody: false });
    const route = new RouteConfig();
    route.enabledDetectionCategories = new Set();
    const resolved = resolveDetectionExclusions(config, route);
    expect(resolved.enabledCategories).toEqual(new Set());
    expect(disabledCategoriesOf(resolved).size).toBe(ALL_DETECTION_CATEGORIES.size);
    expect(resolved.scanBody).toBe(false);
  });

  it('route scanBody=true opts back in over a global false', () => {
    const config = createTestConfig({ detectionScanBody: false });
    const route = new RouteConfig();
    route.detectionScanBody = true;
    expect(resolveDetectionExclusions(config, route).scanBody).toBe(true);
    expect(resolveDetectionExclusions(config, null).scanBody).toBe(false);
    expect(resolveDetectionExclusions(null, null).scanBody).toBe(true);
  });
});

describe('route surface through the live scan', () => {
  let manager: SusPatternsManager;

  it('setup', async () => { manager = await makeManager(); });

  it('an excluded route query param skips the whole pair', async () => {
    const request = createMockRequest({ queryParams: { q: SQLI, other: 'benign' } });
    const config = createTestConfig();
    const route = new RouteConfig();
    route.excludedDetectionParams = new Set(['Q']);
    const [isThreat] = await scanRequestWithManager(
      manager, request, config, resolveDetectionExclusions(config, route),
    );
    expect(isThreat).toBe(false);

    const [globalHit] = await scanRequestWithManager(manager, request, config);
    expect(globalHit).toBe(true);
  });

  it('a route-enabled category filter drops xss while keeping sqli', async () => {
    const config = createTestConfig();
    const route = new RouteConfig();
    route.enabledDetectionCategories = new Set(['sqli']);
    const exclusions = resolveDetectionExclusions(config, route);

    const xssRequest = createMockRequest({ queryParams: { q: XSS } });
    expect((await scanRequestWithManager(manager, xssRequest, config, exclusions))[0]).toBe(false);

    const sqliRequest = createMockRequest({ queryParams: { q: SQLI } });
    expect((await scanRequestWithManager(manager, sqliRequest, config, exclusions))[0]).toBe(true);
  });

  it('detectionScanBody=false skips the body but still scans the query surface', async () => {
    const config = createTestConfig();
    const route = new RouteConfig();
    route.detectionScanBody = false;
    const exclusions = resolveDetectionExclusions(config, route);

    const bodyOnly = jsonRequest(JSON.stringify({ comment: XSS }));
    expect((await scanRequestWithManager(manager, bodyOnly, config, exclusions))[0]).toBe(false);
    expect((await scanRequestWithManager(manager, bodyOnly, config))[0]).toBe(true);

    const withQuery = jsonRequest(JSON.stringify({ comment: 'benign' }), { queryParams: { q: SQLI } });
    expect((await scanRequestWithManager(manager, withQuery, config, exclusions))[0]).toBe(true);
  });

  it('a route-excluded header carrying an address chain skips ssrf, an attack payload still detects', async () => {
    const config = createTestConfig();
    const route = new RouteConfig();
    route.excludedDetectionHeaders = new Set(['x-route-host']);
    const exclusions = resolveDetectionExclusions(config, route);

    // Address-chain values in the excluded header skip the ssrf category
    // (_excluded_header_skip_categories), so the request passes.
    const chainExcluded = createMockRequest({ headers: { 'x-route-host': '127.0.0.1, 8.8.8.8' } });
    expect((await scanRequestWithManager(manager, chainExcluded, config, exclusions))[0]).toBe(false);
    // The same address chain in a non-excluded header still ssrf-detects.
    const chainElsewhere = createMockRequest({ headers: { 'x-evil': '127.0.0.1' } });
    expect((await scanRequestWithManager(manager, chainElsewhere, config, exclusions))[0]).toBe(true);

    // The exclusion is a category skip, not a blind skip: sqli in the same
    // excluded header still detects (reference _scan_excluded_header_component).
    const sqliInExcluded = createMockRequest({ headers: { 'x-route-host': SQLI } });
    expect((await scanRequestWithManager(manager, sqliInExcluded, config, exclusions))[0]).toBe(true);
    // The ssrf URL itself is not an address chain, so even the excluded
    // header keeps detecting it.
    const ssrfUrl = createMockRequest({ headers: { 'x-route-host': SSRF_URL } });
    expect((await scanRequestWithManager(manager, ssrfUrl, config, exclusions))[0]).toBe(true);
  });
});

describe('the detectionExclusion decorator writes the route config', () => {
  it('sets only the given surfaces and tags the route id', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mixin composition needs the any cast
    const decorator = new (SecurityDecorator as any)(createTestConfig());
    const handler = function routeHandler(): string { return 'ok'; };
    decorator.detectionExclusion({
      headers: new Set(['X-Route-H']),
      params: new Set(['q']),
      bodyFields: new Set(['comment']),
      categories: new Set(['sqli', 'xss']),
      scanBody: false,
    })(handler);

    const routeId = (handler as Record<string, unknown>)['_guardRouteId'] as string;
    const rc = decorator.getRouteConfig(routeId)!;
    expect(rc.excludedDetectionHeaders).toEqual(new Set(['X-Route-H']));
    expect(rc.excludedDetectionParams).toEqual(new Set(['q']));
    expect(rc.excludedDetectionBodyFields).toEqual(new Set(['comment']));
    expect(rc.enabledDetectionCategories).toEqual(new Set(['sqli', 'xss']));
    expect(rc.detectionScanBody).toBe(false);
    // Untouched surfaces keep the null sentinel: they inherit the global config.
    expect(rc.excludedDetectionHeaders).not.toBeNull();
    expect(new RouteConfig().excludedDetectionParams).toBeNull();
  });

  it('omitted surfaces keep the null inherit sentinel', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decorator = new (SecurityDecorator as any)(createTestConfig());
    const handler = (): string => 'ok';
    decorator.detectionExclusion({ scanBody: true })(handler);
    const rc = decorator.getRouteConfig((handler as Record<string, unknown>)['_guardRouteId'] as string)!;
    expect(rc.detectionScanBody).toBe(true);
    expect(rc.excludedDetectionParams).toBeNull();
    expect(rc.enabledDetectionCategories).toBeNull();
  });
});

describe('RouteConfigResolver route-config resolution precedence', () => {
  it('direct state config wins, then routeId, then the path registry', async () => {
    const { RouteConfigResolver } = await import('../../src/core/routing/resolver.js');
    const resolver = new RouteConfigResolver(createTestConfig());

    const registryConfig = new RouteConfig();
    registryConfig.detectionScanBody = false;
    const methodScoped = new RouteConfig();
    methodScoped.excludedDetectionParams = new Set(['m']);
    resolver.registerPathRouteConfigs([
      { path: '/api', config: registryConfig },
      { path: '/api/*', config: registryConfig },
      { method: 'POST', path: '/api/open', config: methodScoped },
      { path: '/api/open', config: registryConfig },
    ]);

    // Method-scoped exact entry wins for POST /api/open (same path length
    // as the plain exact entry, registered first); the plain exact entry
    // serves GET /api/open.
    const postOpen = createMockRequest({ method: 'POST', urlPath: '/api/open' });
    expect(resolver.getRouteConfig(postOpen)).toBe(methodScoped);

    const getOpen = createMockRequest({ method: 'GET', urlPath: '/api/open' });
    expect(resolver.getRouteConfig(getOpen)).toBe(registryConfig);

    const postNested = createMockRequest({ method: 'POST', urlPath: '/api/open/edit' });
    expect(resolver.getRouteConfig(postNested)).toBe(registryConfig);

    const getNested = createMockRequest({ method: 'GET', urlPath: '/api/other' });
    expect(resolver.getRouteConfig(getNested)).toBe(registryConfig);

    const miss = createMockRequest({ urlPath: '/elsewhere' });
    expect(resolver.getRouteConfig(miss)).toBeNull();

    // A direct state override beats the registry.
    const direct = new RouteConfig();
    (direct as unknown as Record<string, unknown>);
    const directReq = createMockRequest({ urlPath: '/api/open' });
    (directReq.state as Record<string, unknown>)['guardRouteConfig'] = direct;
    expect(resolver.getRouteConfig(directReq)).toBe(direct);
  });
});
