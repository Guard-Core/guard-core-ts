/**
 * Client IP resolution parity with the reference engine (guard-core Python,
 * guard_core/_utils/ip_extraction.py and _utils/access_control.py): the
 * resolved identity is canonical (IPv4-mapped IPv6 maps to IPv4), X-Forwarded-For
 * is honored only from a trusted connecting peer at the reference depth, and
 * every consumer (ip lists, bans, rate-limit keys, events) reads the resolved
 * identity from request.state.client_ip instead of the raw peer address.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractClientIp, isIpAllowed, resetIpExtractionWarnings } from '../../src/utils.js';
import { ipInList } from '../../src/ip-identity.js';
import { checkIpAccess } from '../../src/core/checks/ip-access.js';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import type { SecurityMiddlewareComponents } from '../../src/middleware-support.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { GuardRequest, GuardRequestState } from '../../src/protocols/request.js';
import { createMockResponseFactory } from '../helpers.js';
import { IP_EXTRACTION_CASES } from './ip-extraction-cases.js';

const LOOPBACK = '127.0.0.1';

function req(host: string | null, headers: Record<string, string> = {}): GuardRequest {
  return {
    urlPath: '/api/test',
    urlScheme: 'https',
    urlFull: 'https://example.com/api/test',
    urlReplaceScheme: (s: string) => `${s}://example.com/api/test`,
    method: 'GET',
    clientHost: host,
    headers: { 'user-agent': 'TestAgent/1.0', ...headers },
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: {} as GuardRequestState,
    scope: {},
  };
}

function cfg(overrides: Record<string, unknown> = {}) {
  return SecurityConfigSchema.parse({ enableRedis: false, ...overrides });
}

async function build(overrides: Record<string, unknown> = {}): Promise<SecurityMiddlewareComponents> {
  return initializeSecurityMiddleware(
    cfg({ enableRateLimiting: false, ...overrides }), defaultLogger, createMockResponseFactory(),
  );
}

async function status(components: SecurityMiddlewareComponents, request: GuardRequest): Promise<number> {
  const response = await components.pipeline.execute(request);
  return response ? response.statusCode : 200;
}

beforeEach(() => resetIpExtractionWarnings());

describe('extractClientIp matches the reference over its own outputs', () => {
  it.each(IP_EXTRACTION_CASES.map((c, i) => [i, c] as const))('case %i', async (_i, c) => {
    const headers: Record<string, string> = c.xff === null ? {} : { 'x-forwarded-for': c.xff };
    const request = req(c.host === '' ? null : c.host, headers);
    const resolved = await extractClientIp(
      request, cfg({ trustedProxies: c.tp, trustedProxyDepth: c.depth }),
    );
    expect(resolved).toBe(c.expected);
  });

  it('returns the identity cached on request.state.client_ip', async () => {
    const request = req('203.0.113.5');
    request.state['client_ip'] = '198.51.100.9';
    expect(await extractClientIp(request, cfg())).toBe('198.51.100.9');
  });
});

describe('trusted proxy matching', () => {
  it('an unparseable proxy entry makes the peer untrusted (reference ValueError arm)', async () => {
    const config = { ...cfg({ trustedProxyDepth: 1 }), trustedProxies: ['10.0.0.0/99'] };
    const request = req(LOOPBACK, { 'x-forwarded-for': '1.2.3.4' });
    expect(await extractClientIp(request, config)).toBe(LOOPBACK);
  });
});

describe('untrusted X-Forwarded-For', () => {
  it('is ignored and reported once as a spoofing event with the canonical peer', async () => {
    const sendEvent = vi.fn(async () => {});
    const agent = { sendEvent } as never;
    const request = req('::ffff:203.0.113.5', { 'x-forwarded-for': '1.2.3.4, evil' });
    const resolved = await extractClientIp(request, cfg({ trustedProxies: [LOOPBACK] }), agent);
    expect(resolved).toBe('203.0.113.5');
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'suspicious_request',
      ipAddress: '203.0.113.5',
      actionTaken: 'spoofing_detected',
      reason: 'Potential IP spoof attempt: X-Forwarded-For header 1.2.3.4,[REDACTED]',
    }));
  });
});

describe('forwarded chain warnings are logged once', () => {
  it.each([
    ['chain too short', '9.9.9.9', { trustedProxies: [LOOPBACK], trustedProxyDepth: 2 }, 'fewer than the configured'],
    ['selected entry is a trusted proxy', '1.2.3.4, 10.0.0.2', { trustedProxies: [LOOPBACK, '10.0.0.2'], trustedProxyDepth: 1 }, 'itself listed in trustedProxies'],
    ['depth over-counts hops', '9.9.9.9, 1.2.3.4', { trustedProxies: [LOOPBACK], trustedProxyDepth: 2 }, 'over-counts'],
    ['connecting ip inside its own chain', `${LOOPBACK}, 1.2.3.4`, {}, 'already appears inside its own'],
  ])('%s', async (_name, xff, config, text) => {
    const warn = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 2; i += 1) {
        await extractClientIp(req(LOOPBACK, { 'x-forwarded-for': xff }), cfg(config));
      }
      expect(warn.mock.calls.filter(([m]) => String(m).includes(text))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('logs a spoof attempt from a public untrusted peer at warn and from loopback at debug', async () => {
    const warn = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
    const debug = vi.spyOn(defaultLogger, 'debug').mockImplementation(() => {});
    try {
      await extractClientIp(req('203.0.113.5', { 'x-forwarded-for': '1.2.3.4' }), cfg({ trustedProxies: ['10.0.0.1'] }));
      await extractClientIp(req(LOOPBACK, { 'x-forwarded-for': '1.2.3.4' }), cfg({ trustedProxies: ['10.0.0.1'] }));
      expect(warn.mock.calls.some(([m]) => String(m).includes('Potential IP spoof attempt'))).toBe(true);
      expect(debug.mock.calls.some(([m]) => String(m).includes('Potential IP spoof attempt'))).toBe(true);
    } finally {
      warn.mockRestore();
      debug.mockRestore();
    }
  });
});

describe('list matching uses the canonical identity', () => {
  const mapped = '::ffff:10.1.1.1';

  it('an IPv4 entry, an IPv4 CIDR and an IPv4-mapped entry all match either spelling of the client', async () => {
    for (const entry of ['10.1.1.1', '10.0.0.0/8', '::ffff:10.1.1.1']) {
      for (const ip of ['10.1.1.1', mapped]) {
        expect(await isIpAllowed(ip, cfg({ blacklist: [entry] })), `${entry} vs ${ip}`).toBe(false);
        expect(await isIpAllowed(ip, cfg({ whitelist: [entry] })), `${entry} vs ${ip}`).toBe(true);
        expect((await checkIpAccess(ip, cfg({ blacklist: [entry] }))).allowed, `${entry} vs ${ip}`).toBe(false);
      }
    }
  });

  it('a different address is not matched', async () => {
    expect(await isIpAllowed('10.1.1.2', cfg({ blacklist: ['10.1.1.1', '192.168.0.0/16'] }))).toBe(true);
    expect(await isIpAllowed('10.1.1.2', cfg({ whitelist: ['10.1.1.1'] }))).toBe(false);
  });

  it('IPv6 spellings compare in canonical form', async () => {
    expect(await isIpAllowed('2001:db8::1', cfg({ blacklist: ['2001:0DB8:0:0:0:0:0:1'] }))).toBe(false);
    expect(await isIpAllowed('2001:db8::1', cfg({ blacklist: ['2001:db8::/32'] }))).toBe(false);
  });

  it('a malformed CIDR entry blocks like the reference ValueError arm', async () => {
    const config = { ...cfg(), blacklist: ['10.0.0.0/99'] };
    expect(await isIpAllowed('10.1.1.1', config)).toBe(false);
    expect((await checkIpAccess('10.1.1.1', config)).allowed).toBe(false);
    expect(() => ipInList('not-an-ip', ['10.0.0.0/8'])).toThrow('invalid IP address');
    expect(ipInList('10.1.1.1', null)).toBe(false);
  });

  it('an unparseable client is never allowed by isIpAllowed', async () => {
    expect(await isIpAllowed('not-an-ip', cfg())).toBe(false);
  });

});

describe('the pipeline reads the resolved identity', () => {
  it('blacklist: an IPv4 entry and an IPv4 CIDR block an IPv4-mapped client', async () => {
    for (const entry of ['127.0.0.1', '127.0.0.0/8']) {
      const components = await build({ blacklist: [entry] });
      expect(await status(components, req('::ffff:127.0.0.1')), entry).toBe(403);
    }
  });

  it('whitelist: an IPv4 CIDR admits an IPv4-mapped client and denies the others', async () => {
    const components = await build({ whitelist: ['10.0.0.0/8'] });
    expect(await status(components, req('::ffff:10.1.1.1'))).toBe(200);
    expect(await status(components, req('::ffff:203.0.113.9'))).toBe(403);
  });

  it('bans stored for the IPv4 form block the IPv4-mapped form', async () => {
    const components = await build({ enableIpBanning: true });
    await components.registry.ipBanHandler.banIp('198.51.100.7', 300, 'test');
    expect(await status(components, req('::ffff:198.51.100.7'))).toBe(403);
    expect(await status(components, req('198.51.100.7'))).toBe(403);
  });

  it('rate-limit keys: both spellings of one client share a counter', async () => {
    const components = await build({ enableRateLimiting: true, rateLimit: 2, rateLimitWindow: 60 });
    expect(await status(components, req('::ffff:198.51.100.8'))).toBe(200);
    expect(await status(components, req('198.51.100.8'))).toBe(200);
    expect(await status(components, req('::ffff:198.51.100.8'))).toBe(429);
  });

  it('emergency mode: an IPv4 whitelist entry admits an IPv4-mapped client', async () => {
    const components = await build({ emergencyMode: true, emergencyWhitelist: ['198.51.100.9'] });
    expect(await status(components, req('::ffff:198.51.100.9'))).toBe(200);
    expect(await status(components, req('::ffff:198.51.100.10'))).toBe(503);
  });

  it('emergency mode: an unparseable identity is never whitelisted', async () => {
    const components = await build({ emergencyMode: true, emergencyWhitelist: ['10.0.0.0/8'] });
    const request = req(LOOPBACK);
    request.state['client_ip'] = 'garbage';
    expect(await status(components, request)).toBe(503);
  });

  it('stores the canonical identity on request.state.client_ip', async () => {
    const components = await build();
    const request = req('::ffff:203.0.113.9');
    await components.pipeline.execute(request);
    expect(request.state['client_ip']).toBe('203.0.113.9');
  });

  it('X-Forwarded-For from a trusted proxy is the identity every check sees', async () => {
    const components = await build({
      trustedProxies: [LOOPBACK], trustedProxyDepth: 1, blacklist: ['203.0.113.77'],
    });
    const request = req(LOOPBACK, { 'x-forwarded-for': '::ffff:203.0.113.77' });
    expect(await status(components, request)).toBe(403);
    expect(request.state['client_ip']).toBe('203.0.113.77');
  });

  it('spoofed X-Forwarded-For from an untrusted peer does not reach any check', async () => {
    const components = await build({
      trustedProxies: [LOOPBACK], whitelist: ['10.9.9.9'],
    });
    const spoofed = req('203.0.113.5', { 'x-forwarded-for': '10.9.9.9' });
    expect(await status(components, spoofed)).toBe(403);
    expect(spoofed.state['client_ip']).toBe('203.0.113.5');

    const blocked = await build({ trustedProxies: [LOOPBACK], blacklist: ['203.0.113.5'] });
    expect(await status(blocked, req('203.0.113.5', { 'x-forwarded-for': '10.9.9.9' }))).toBe(403);
  });

  it('no client address: resolves through the unix trusted-proxy chain, else stays unknown', async () => {
    const trusted = await build({ trustedProxies: ['unix'], trustedProxyDepth: 1 });
    const viaChain = req(null, { 'x-forwarded-for': '203.0.113.31' });
    expect(await trusted.bypassHandler.handlePassthrough(viaChain)).toBeNull();
    expect(viaChain.state['client_ip']).toBe('203.0.113.31');

    const plain = await build();
    const unknown = req(null, { 'x-forwarded-for': '203.0.113.31' });
    const rejected = await plain.bypassHandler.handlePassthrough(unknown);
    expect(rejected?.statusCode).toBe(403);
    expect(unknown.state['client_ip']).toBe('unknown');
  });
});
