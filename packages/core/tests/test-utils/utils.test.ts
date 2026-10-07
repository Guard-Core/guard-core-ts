import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeForLog, extractClientIp, isIpAllowed, isUserAgentAllowed, logActivity, detectPenetrationAttempt, scanRequestWithManager, checkIpCountry } from '../../src/utils.js';
import {
  checkCountryAccess,
  checkRouteIpAccess,
  checkUserAgentAllowed,
  detectPenetrationPatterns,
} from '../../src/core/checks/helpers.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createTestConfig, createMockMiddleware } from '../helpers.js';
import type { GuardRequest, GuardRequestState } from '../../src/protocols/request.js';
import type { GeoIPHandler } from '../../src/protocols/geo-ip.js';

function createMockRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
  return {
    urlPath: '/api/test',
    urlScheme: 'https',
    urlFull: 'https://example.com/api/test',
    urlReplaceScheme: (s: string) => `${s}://example.com/api/test`,
    method: 'GET',
    clientHost: '1.2.3.4',
    headers: { 'user-agent': 'TestAgent/1.0' },
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: {} as GuardRequestState,
    scope: {},
    ...overrides,
  };
}

describe('sanitizeForLog', () => {
  it('escapes newlines', () => {
    expect(sanitizeForLog('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes carriage returns', () => {
    expect(sanitizeForLog('line1\rline2')).toBe('line1\\rline2');
  });

  it('escapes tabs', () => {
    expect(sanitizeForLog('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('escapes control characters as unicode escapes', () => {
    expect(sanitizeForLog('hello\x00world')).toBe('hello\\u0000world');
    expect(sanitizeForLog('esc\x1b[31m')).toBe('esc\\u001b[31m');
    expect(sanitizeForLog('del\x7f')).toBe('del\\u007f');
  });

  it('escapes non-ASCII BMP characters', () => {
    expect(sanitizeForLog('café')).toBe('caf\\u00e9');
    expect(sanitizeForLog('中文')).toBe('\\u4e2d\\u6587');
  });

  it('escapes astral characters as a single code point escape', () => {
    expect(sanitizeForLog('👍')).toBe('\\u1f44d');
  });

  it('escapes lone surrogates', () => {
    expect(sanitizeForLog('\udc80\udcff\udca1')).toBe('\\x80\\xff\\xa1');
    expect(sanitizeForLog('a\ud83db')).toBe('a\\ud83db');
  });

  it('escapes a mixed string', () => {
    expect(
      sanitizeForLog('mixed \x00 ctrl and é accent and \u{1f600} emoji end'),
    ).toBe('mixed \\u0000 ctrl and \\u00e9 accent and \\u1f600 emoji end');
  });

  it('leaves pure ASCII unchanged', () => {
    expect(sanitizeForLog('pure ASCII 123 !?')).toBe('pure ASCII 123 !?');
    expect(sanitizeForLog('')).toBe('');
  });

  it('leaves normal text unchanged', () => {
    expect(sanitizeForLog('normal text')).toBe('normal text');
  });
});

describe('extractClientIp', () => {
  it('returns clientHost when no forwarded header', async () => {
    const request = createMockRequest();
    const config = SecurityConfigSchema.parse({});
    const ip = await extractClientIp(request, config);
    expect(ip).toBe('1.2.3.4');
  });

  it('returns unknown when no clientHost', async () => {
    const request = createMockRequest({ clientHost: null });
    const config = SecurityConfigSchema.parse({});
    const ip = await extractClientIp(request, config);
    expect(ip).toBe('unknown');
  });

  it('extracts from X-Forwarded-For with trusted proxy', async () => {
    const request = createMockRequest({
      clientHost: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.50', 'user-agent': 'TestAgent' },
    });
    const config = SecurityConfigSchema.parse({
      trustedProxies: ['10.0.0.0/8'],
      trustedProxyDepth: 1,
    });
    const ip = await extractClientIp(request, config);
    expect(ip).toBe('203.0.113.50');
  });

  it('ignores X-Forwarded-For from untrusted source', async () => {
    const request = createMockRequest({
      clientHost: '1.2.3.4',
      headers: { 'x-forwarded-for': '10.0.0.1', 'user-agent': 'TestAgent' },
    });
    const config = SecurityConfigSchema.parse({});
    const ip = await extractClientIp(request, config);
    expect(ip).toBe('1.2.3.4');
  });
});

describe('isIpAllowed', () => {
  it('allows non-blacklisted IP', async () => {
    const config = SecurityConfigSchema.parse({ blacklist: ['5.6.7.8'] });
    expect(await isIpAllowed('1.2.3.4', config)).toBe(true);
  });

  it('blocks blacklisted IP', async () => {
    const config = SecurityConfigSchema.parse({ blacklist: ['1.2.3.4'] });
    expect(await isIpAllowed('1.2.3.4', config)).toBe(false);
  });

  it('blocks IP in blacklisted CIDR', async () => {
    const config = SecurityConfigSchema.parse({ blacklist: ['192.168.0.0/16'] });
    expect(await isIpAllowed('192.168.1.100', config)).toBe(false);
  });

  it('allows whitelisted IP', async () => {
    const config = SecurityConfigSchema.parse({ whitelist: ['1.2.3.4'] });
    expect(await isIpAllowed('1.2.3.4', config)).toBe(true);
  });

  it('blocks non-whitelisted IP when whitelist exists', async () => {
    const config = SecurityConfigSchema.parse({ whitelist: ['10.0.0.1'] });
    expect(await isIpAllowed('1.2.3.4', config)).toBe(false);
  });

  it('returns false for invalid IP', async () => {
    const config = SecurityConfigSchema.parse({});
    expect(await isIpAllowed('not-an-ip', config)).toBe(false);
  });
});

describe('isUserAgentAllowed', () => {
  it('allows non-matching user agent', async () => {
    const config = SecurityConfigSchema.parse({ blockedUserAgents: ['badbot'] });
    expect(await isUserAgentAllowed('Chrome/120', config)).toBe(true);
  });

  it('blocks matching user agent', async () => {
    const config = SecurityConfigSchema.parse({ blockedUserAgents: ['badbot'] });
    expect(await isUserAgentAllowed('badbot/1.0', config)).toBe(false);
  });

  it('is case insensitive', async () => {
    const config = SecurityConfigSchema.parse({ blockedUserAgents: ['BadBot'] });
    expect(await isUserAgentAllowed('BADBOT/2.0', config)).toBe(false);
  });

  it('supports regex patterns', async () => {
    const config = SecurityConfigSchema.parse({ blockedUserAgents: ['scrapy|crawl'] });
    expect(await isUserAgentAllowed('Scrapy/2.0', config)).toBe(false);
    expect(await isUserAgentAllowed('GoogleCrawler', config)).toBe(false);
    expect(await isUserAgentAllowed('Chrome/120', config)).toBe(true);
  });
});

describe('logActivity', () => {
  it('logs request activity', () => {
    const spy = vi.spyOn(defaultLogger, 'info').mockImplementation(() => {});
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', 'INFO');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not log when level is null', () => {
    const spy = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', null);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs suspicious activity with passive mode prefix', () => {
    const spy = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'suspicious', 'SQL injection', true, 'UNION SELECT', 'WARNING');
    expect(spy).toHaveBeenCalled();
    const msg = spy.mock.calls[0][0];
    expect(msg).toContain('PASSIVE');
    expect(msg).toContain('SQL injection');
    spy.mockRestore();
  });
});

function createMockGeoIpHandler(countryMap: Record<string, string> = {}): GeoIPHandler {
  return {
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    initializeRedis: vi.fn().mockResolvedValue(undefined),
    initializeAgent: vi.fn().mockResolvedValue(undefined),
    getCountry: vi.fn().mockImplementation((ip: string) => countryMap[ip] ?? null),
  };
}

describe('detectPenetrationAttempt', () => {
  /* Trigger strings mirror the reference value routing
     (guard_core/_utils/detection_scan.py): each surface names the component
     that matched, e.g. "Query param 'q': ..." rather than the old
     "Suspicious query_params: ..." shortcut format. */
  it('detects XSS in query params', async () => {
    const request = createMockRequest({
      queryParams: { q: '<script>alert(1)</script>' },
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(true);
    expect(info).toContain("Query param 'q':");
  });

  it('detects path traversal in URL path', async () => {
    const request = createMockRequest({
      urlPath: '/files/../../etc/passwd',
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(true);
    expect(info).toContain('URL path:');
  });

  it('detects malicious header value', async () => {
    const request = createMockRequest({
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-custom': '<script>alert(1)</script>',
      },
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(true);
    expect(info).toContain("Header 'x-custom':");
  });

  it('returns false for clean request', async () => {
    const request = createMockRequest({
      urlPath: '/api/users',
      queryParams: { page: '1', sort: 'name' },
      headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' },
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(false);
    expect(info).toBe('');
  });

  it('detects malicious JSON body', async () => {
    const encoder = new TextEncoder();
    const maliciousBody = JSON.stringify({ input: '<script>alert(1)</script>' });
    const request = createMockRequest({
      body: async () => encoder.encode(maliciousBody),
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(true);
    expect(info).toContain('body');
  });

  it('detects SQL injection in query params', async () => {
    const request = createMockRequest({
      queryParams: { id: "1 UNION SELECT * FROM users" },
    });
    const [isThreat, info] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(true);
    expect(info).toContain("Query param 'id':");
  });

  it('handles body read failure gracefully', async () => {
    const request = createMockRequest({
      urlPath: '/api/safe',
      queryParams: {},
      headers: { 'user-agent': 'Mozilla/5.0' },
      body: async () => { throw new Error('read error'); },
    });
    const [isThreat] = await detectPenetrationAttempt(request);
    expect(isThreat).toBe(false);
  });

  it('treats a request that cannot cache its body as a failed read', async () => {
    /* A frozen request state makes the bounded reader's per-request cache
       write throw, so readCappedBody rejects; detection must treat the body
       as unavailable instead of crashing the scan. */
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const body = new TextEncoder().encode(JSON.stringify({ comment: 'safe text' }));
    const request = createMockRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: async () => body,
    });
    Object.freeze(request.state);
    const [isThreat] = await scanRequestWithManager(manager, request);
    expect(isThreat).toBe(false);
  });
});

describe('scanRequestWithManager engine routing', () => {
  /* Real-manager tests: the value routing must reach the full pattern table
     with the reference contexts. */
  it('blocks attacks carried in a query param NAME', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { '<img src=x onerror=alert(1)>': '1' } }),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain('Query param name');
  });

  it('blocks attack leaves inside root-array JSON bodies', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const body = new TextEncoder().encode(JSON.stringify([{ comment: '<img src=x onerror=alert(1)>' }]));
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: async () => body,
      }),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Request body field 'comment':");
  });

  it('detects attacks below the JSON depth cap through the serialized subtree', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    let node: Record<string, unknown> = { payload: '<img src=x onerror=alert(1)>' };
    for (let i = 0; i < 35; i++) node = { nested: node };
    const body = new TextEncoder().encode(JSON.stringify(node));
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: async () => body,
      }),
    );
    expect(isThreat).toBe(true);
  });

  it('blob-scans non-JSON bodies sent with a json content type', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const body = new TextEncoder().encode('not json but <img src=x onerror=alert(1)>');
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: async () => body,
      }),
    );
    expect(isThreat).toBe(true);
  });

  it('blob-scans scalar JSON bodies', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const body = new TextEncoder().encode('"just a string with <script>alert(1)</script>"');
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: async () => body,
      }),
    );
    expect(isThreat).toBe(true);
  });

  it('ignores whitespace-only bodies', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: async () => new TextEncoder().encode('   \n\t '),
      }),
    );
    expect(isThreat).toBe(false);
  });

  /* Scan-budget behavior (reference _scan_value_budget defaults: 512 values,
     65536 chars): values beyond the budget are not scanned. */
  it('stops scanning after the 512 value budget', { timeout: 30_000 }, async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const queryParams: Record<string, string> = {};
    for (let i = 0; i < 300; i++) queryParams[`field${i}`] = String(i);
    queryParams['zlast'] = '<img src=x onerror=alert(1)>';
    const [isThreat] = await scanRequestWithManager(manager, createMockRequest({ queryParams }));
    expect(isThreat).toBe(false);
  });

  it('stops scanning after the 65536 char budget', async () => {
    const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
    const manager = new SusPatternsManager(createTestConfig(), defaultLogger);
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({
        queryParams: { big: 'x'.repeat(70000), evil: '<img src=x onerror=alert(1)>' },
      }),
    );
    expect(isThreat).toBe(false);
  });

  /* Stub-manager tests for the error and message-formatting branches. */
  function stubManager(
    detectImpl: (content: string, ip: string, context: string) => unknown,
  ): import('../../src/handlers/sus-patterns.js').SusPatternsManager {
    return {
      detect: async (content: string, ip: string, context: string) => detectImpl(content, ip, context),
    } as unknown as import('../../src/handlers/sus-patterns.js').SusPatternsManager;
  }

  it('formats semantic threats like the reference message builder', async () => {
    const manager = stubManager((content) => content !== 'q' ? {
      isThreat: true,
      threatScore: 0.95,
      threats: [{
        pattern: 'semantic:xss',
        context: 'query_param',
        matchedContent: 'score=0.950',
        detectionMethod: 'semantic',
      }],
      executionTime: 0,
      timeouts: [],
      correlationId: null,
      originalLength: 1,
      processedLength: 1,
    } : { isThreat: false, threats: [] });
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { q: 'something semantic' } }),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Query param 'q': Semantic attack: xss (score: 0.95)");
  });

  it('reports a threat without entries as generic', async () => {
    const manager = stubManager((content) => content !== 'q'
      ? { isThreat: true, threats: [] }
      : { isThreat: false, threats: [] });
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { q: 'x' } }),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Query param 'q': Threat detected");
  });

  it('treats engine failures as non-threats', async () => {
    const manager = stubManager(() => { throw new Error('engine boom'); });
    const [isThreat] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { q: '<img src=x onerror=alert(1)>' } }),
    );
    expect(isThreat).toBe(false);
  });
});

describe('checkIpCountry', () => {
  it('blocks IP from blocked country', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'CN' });
    const config = createTestConfig({ blockedCountries: ['CN'], geoIpHandler: geoIp });
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(true);
  });

  it('allows IP from non-blocked country', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const config = createTestConfig({ blockedCountries: ['CN'], geoIpHandler: geoIp });
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(false);
  });

  it('returns false when no country config', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const config = createTestConfig();
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(false);
  });

  it('blocks IP not in whitelist countries', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'RU' });
    const config = createTestConfig({ whitelistCountries: ['US', 'GB'], geoIpHandler: geoIp });
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(true);
  });

  it('allows IP in whitelist countries', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const config = createTestConfig({ whitelistCountries: ['US', 'GB'], geoIpHandler: geoIp });
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(false);
  });

  it('calls initialize when geoIpHandler is not initialized', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'CN' });
    (geoIp as { isInitialized: boolean }).isInitialized = false;
    const config = createTestConfig({ blockedCountries: ['CN'], geoIpHandler: geoIp });
    await checkIpCountry('10.0.0.1', config, geoIp);
    expect(geoIp.initialize).toHaveBeenCalled();
  });

  it('returns false when country is null', async () => {
    const geoIp = createMockGeoIpHandler({});
    const config = createTestConfig({ blockedCountries: ['CN'], geoIpHandler: geoIp });
    const result = await checkIpCountry('10.0.0.1', config, geoIp);
    expect(result).toBe(false);
  });
});

describe('logActivity extended', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs suspicious activity with passive mode prefix', () => {
    const logSpy = vi.spyOn(defaultLogger, 'warn');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'suspicious', 'test reason', true, 'xss detected');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[PASSIVE MODE]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('xss detected'));
  });

  it('logs generic message for other logType', () => {
    const logSpy = vi.spyOn(defaultLogger, 'warn');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'blocked', 'access denied');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('blocked from'));
  });

  it('logs with ERROR level', () => {
    const logSpy = vi.spyOn(defaultLogger, 'error');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', 'ERROR');
    expect(logSpy).toHaveBeenCalled();
  });

  it('logs with DEBUG level', () => {
    const logSpy = vi.spyOn(defaultLogger, 'debug');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', 'DEBUG');
    expect(logSpy).toHaveBeenCalled();
  });

  it('logs with INFO level for request logType', () => {
    const logSpy = vi.spyOn(defaultLogger, 'info');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', 'INFO');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Request from'));
  });

  it('logs with CRITICAL level uses error', () => {
    const logSpy = vi.spyOn(defaultLogger, 'error');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', 'CRITICAL');
    expect(logSpy).toHaveBeenCalled();
  });

  it('returns early when level is null', () => {
    const infoSpy = vi.spyOn(defaultLogger, 'info');
    const warnSpy = vi.spyOn(defaultLogger, 'warn');
    const errorSpy = vi.spyOn(defaultLogger, 'error');
    const debugSpy = vi.spyOn(defaultLogger, 'debug');
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'request', '', false, '', null);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });
});

describe('checks/helpers - checkCountryAccess', () => {
  it('returns null when no geoIpHandler', () => {
    const routeConfig = new RouteConfig();
    const result = checkCountryAccess('10.0.0.1', routeConfig, null);
    expect(result).toBeNull();
  });

  it('returns false when IP is from blocked country', () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'CN' });
    const routeConfig = new RouteConfig();
    routeConfig.blockedCountries = ['CN', 'RU'];
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBe(false);
  });

  it('returns true when IP is from whitelisted country', () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const routeConfig = new RouteConfig();
    routeConfig.whitelistCountries = ['US', 'GB'];
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBe(true);
  });

  it('returns false when IP is not from whitelisted country', () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'RU' });
    const routeConfig = new RouteConfig();
    routeConfig.whitelistCountries = ['US', 'GB'];
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBe(false);
  });

  it('returns false when country is unknown and whitelist is set', () => {
    const geoIp = createMockGeoIpHandler({});
    const routeConfig = new RouteConfig();
    routeConfig.whitelistCountries = ['US'];
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBe(false);
  });

  it('returns null when no country restrictions', () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const routeConfig = new RouteConfig();
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBeNull();
  });

  it('checks both blocked and whitelist, blocked takes priority', () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'CN' });
    const routeConfig = new RouteConfig();
    routeConfig.blockedCountries = ['CN'];
    routeConfig.whitelistCountries = ['US'];
    const result = checkCountryAccess('10.0.0.1', routeConfig, geoIp);
    expect(result).toBe(false);
  });
});

describe('checks/helpers - checkRouteIpAccess', () => {
  it('returns false for blacklisted IP', async () => {
    const middleware = createMockMiddleware();
    const routeConfig = new RouteConfig();
    routeConfig.ipBlacklist = ['10.0.0.1'];
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBe(false);
  });

  it('returns true for whitelisted IP', async () => {
    const middleware = createMockMiddleware();
    const routeConfig = new RouteConfig();
    routeConfig.ipWhitelist = ['10.0.0.1'];
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBe(true);
  });

  it('returns false for IP not in whitelist', async () => {
    const middleware = createMockMiddleware();
    const routeConfig = new RouteConfig();
    routeConfig.ipWhitelist = ['192.168.1.1'];
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBe(false);
  });

  it('returns null when no restrictions', async () => {
    const middleware = createMockMiddleware();
    const routeConfig = new RouteConfig();
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBeNull();
  });

  it('delegates to checkCountryAccess when geoIpHandler is present', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'CN' });
    const middleware = createMockMiddleware();
    (middleware as Record<string, unknown>)['geoIpHandler'] = geoIp;
    const routeConfig = new RouteConfig();
    routeConfig.blockedCountries = ['CN'];
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBe(false);
  });

  it('returns null when country check returns null', async () => {
    const geoIp = createMockGeoIpHandler({ '10.0.0.1': 'US' });
    const middleware = createMockMiddleware();
    (middleware as Record<string, unknown>)['geoIpHandler'] = geoIp;
    const routeConfig = new RouteConfig();
    const result = await checkRouteIpAccess('10.0.0.1', routeConfig, middleware);
    expect(result).toBeNull();
  });
});

describe('checks/helpers - checkUserAgentAllowed', () => {
  it('blocks user agent matching route-level pattern', async () => {
    const routeConfig = new RouteConfig();
    routeConfig.blockedUserAgents = ['BadBot.*'];
    const config = createTestConfig();
    const result = await checkUserAgentAllowed('BadBot/1.0', routeConfig, config);
    expect(result).toBe(false);
  });

  it('blocks user agent matching config-level pattern', async () => {
    const config = createTestConfig({ blockedUserAgents: ['EvilCrawler'] });
    const result = await checkUserAgentAllowed('EvilCrawler/2.0', null, config);
    expect(result).toBe(false);
  });

  it('allows user agent not matching any pattern', async () => {
    const config = createTestConfig({ blockedUserAgents: ['BadBot'] });
    const result = await checkUserAgentAllowed('Mozilla/5.0', null, config);
    expect(result).toBe(true);
  });

  it('allows user agent when no patterns configured', async () => {
    const config = createTestConfig();
    const result = await checkUserAgentAllowed('Mozilla/5.0', null, config);
    expect(result).toBe(true);
  });
});

describe('checks/helpers - detectPenetrationPatterns', () => {
  it('returns disabled_by_decorator when route disables detection but config enables it', async () => {
    const routeConfig = new RouteConfig();
    routeConfig.enableSuspiciousDetection = false;
    const config = createTestConfig({ enablePenetrationDetection: true });
    const [isThreat, reason] = await detectPenetrationPatterns(
      createMockRequest(),
      routeConfig,
      config,
      () => false,
    );
    expect(isThreat).toBe(false);
    expect(reason).toBe('disabled_by_decorator');
  });

  it('returns not_enabled when detection is off globally', async () => {
    const config = createTestConfig({ enablePenetrationDetection: false });
    const [isThreat, reason] = await detectPenetrationPatterns(
      createMockRequest(),
      null,
      config,
      () => false,
    );
    expect(isThreat).toBe(false);
    expect(reason).toBe('not_enabled');
  });

  it('detects threats when enabled', async () => {
    const config = createTestConfig({ enablePenetrationDetection: true });
    const request = createMockRequest({ queryParams: { q: '<script>alert(1)</script>' } });
    const [isThreat] = await detectPenetrationPatterns(
      request,
      null,
      config,
      () => false,
    );
    expect(isThreat).toBe(true);
  });

  it('returns false when check is bypassed', async () => {
    const config = createTestConfig({ enablePenetrationDetection: true });
    const request = createMockRequest({ queryParams: { q: '<script>alert(1)</script>' } });
    const [isThreat, reason] = await detectPenetrationPatterns(
      request,
      null,
      config,
      () => true,
    );
    expect(isThreat).toBe(false);
    expect(reason).toBe('not_enabled');
  });
});

describe('detectPenetrationAttempt with nested JSON body', () => {
  it('detects XSS in nested JSON field', async () => {
    const req = createMockRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'T' },
      body: async () => new TextEncoder().encode(JSON.stringify({ nested: { field: '<script>alert(1)</script>' } })),
    });
    const [isThreat] = await detectPenetrationAttempt(req);
    expect(isThreat).toBe(true);
  });

  it('returns false for clean nested JSON', async () => {
    const req = createMockRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'T' },
      body: async () => new TextEncoder().encode(JSON.stringify({ user: { name: 'Alice', age: 30 } })),
    });
    const [isThreat] = await detectPenetrationAttempt(req);
    expect(isThreat).toBe(false);
  });
});

describe('helpers remaining branches', () => {
  it('checkUserAgentAllowed with empty route patterns', async () => {
    const config = createTestConfig({ blockedUserAgents: ['bad'] });
    const rc = new RouteConfig();
    rc.blockedUserAgents = [];
    expect(await checkUserAgentAllowed('Chrome', rc, config)).toBe(true);
  });
});

async function makeManager(): Promise<import('../../src/handlers/sus-patterns.js').SusPatternsManager> {
  const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
  return new SusPatternsManager(createTestConfig(), defaultLogger);
}

describe('scanRequestWithManager bounded body reads', () => {
  it('skips the body surface when the bounded reader refuses an oversized body', async () => {
    const manager = await makeManager();
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    /* Oversized declared body and no readBodyPrefix on the request: the
       bounded read returns null and the scan treats the body as absent
       (headers/params still scanned). */
    const request = createMockRequest({
      headers: { 'content-length': '5000', 'user-agent': 'TestAgent/1.0' },
      body: async () => new Uint8Array(0),
      queryParams: { safe: 'value' },
    });
    const [isThreat] = await scanRequestWithManager(manager, request, config);
    expect(isThreat).toBe(false);
  });

  it('treats a benign body over the read budget as clean, not an error', async () => {
    const manager = await makeManager();
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const request = createMockRequest({
      headers: { 'content-type': 'text/plain', 'user-agent': 'TestAgent/1.0' },
      body: async () => new TextEncoder().encode('just some words'),
    });
    const [isThreat, info] = await scanRequestWithManager(manager, request, config);
    expect(isThreat).toBe(false);
    expect(info).toBe('');
  });
});

describe('logActivity CRITICAL level', () => {
  it('logs at CRITICAL level (maps to error)', () => {
    const spy = vi.spyOn(defaultLogger, 'error').mockImplementation(() => {});
    logActivity(createMockRequest(), defaultLogger, 'custom', 'reason', false, '', 'CRITICAL');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
