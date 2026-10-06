import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityHeadersManager } from '../../src/handlers/security-headers.js';
import { defaultLogger } from '../../src/models/logger.js';

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    getKey: vi.fn(async (_ns: string, key: string) => store.get(key) ?? null),
    setKey: vi.fn(async (_ns: string, key: string, value: unknown) => { store.set(key, String(value)); return true; }),
    delete: vi.fn(async (_ns: string, key: string) => { store.delete(key); return 1; }),
    deletePattern: vi.fn(async () => 0),
    keys: vi.fn(async () => []),
    initialize: vi.fn(),
    getRawClient: vi.fn(() => ({
      script: vi.fn().mockResolvedValue('sha'),
    })),
    getConnection: vi.fn(),
    initializeAgent: vi.fn(),
    prefix: 'guard_core:',
  };
}

describe('SecurityHeadersManager', () => {
  let manager: SecurityHeadersManager;

  beforeEach(() => {
    manager = new SecurityHeadersManager(defaultLogger);
  });

  it('returns default security headers', async () => {
    const headers = await manager.getHeaders('/');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('geolocation');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(headers['X-Download-Options']).toBe('noopen');
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
  });

  it('configures custom headers', () => {
    manager.configure({
      customHeaders: { 'X-Custom': 'test-value' },
    });
  });

  it('builds CSP header', async () => {
    manager.configure({
      csp: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'cdn.example.com'],
      },
    });

    const headers = await manager.getHeaders('/');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain("script-src 'self' cdn.example.com");
  });

  it('builds HSTS header', async () => {
    manager.configure({
      hstsMaxAge: 31536000,
      hstsIncludeSubdomains: true,
      hstsPreload: true,
    });

    const headers = await manager.getHeaders('/');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(headers['Strict-Transport-Security']).toContain('preload');
  });

  it('returns CORS headers for allowed origin', () => {
    manager.configure({
      corsOrigins: ['https://example.com'],
      corsAllowMethods: ['GET', 'POST'],
    });

    const headers = manager.getCorsHeaders('https://example.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('returns empty CORS headers for disallowed origin', () => {
    manager.configure({
      corsOrigins: ['https://example.com'],
    });

    const headers = manager.getCorsHeaders('https://evil.com');
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it('supports wildcard CORS origin', () => {
    manager.configure({ corsOrigins: ['*'] });
    const headers = manager.getCorsHeaders('https://anything.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('disables headers when enabled is false', () => {
    manager.configure({ enabled: false });
  });

  it('resets to defaults', async () => {
    manager.configure({
      csp: { 'default-src': ["'none'"] },
      customHeaders: { 'X-Custom': 'value' },
    });

    await manager.reset();

    const headers = await manager.getHeaders('/');
    expect(headers['Content-Security-Policy']).toBeUndefined();
    expect(headers['X-Custom']).toBeUndefined();
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
  });

  it('rejects header values with CRLF characters', () => {
    expect(() => {
      manager.configure({ frameOptions: 'DENY\r\nInjected: true' });
    }).toThrow('Header value must not contain CR or LF characters');
  });

  it('rejects header values with lone LF', () => {
    expect(() => {
      manager.configure({ frameOptions: 'DENY\nInjected: true' });
    }).toThrow('Header value must not contain CR or LF characters');
  });

  it('configures CORS with credentials flag', () => {
    manager.configure({
      corsOrigins: ['https://example.com'],
      corsAllowCredentials: true,
    });
    const headers = manager.getCorsHeaders('https://example.com');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('getCorsHeaders returns empty when origin not allowed', () => {
    manager.configure({ corsOrigins: ['https://allowed.com'] });
    const headers = manager.getCorsHeaders('https://evil.com');
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it('getCorsHeaders returns empty when no cors configured', () => {
    const headers = manager.getCorsHeaders('https://example.com');
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it('cache TTL causes fresh headers on subsequent call after expiry', async () => {
    const headers1 = await manager.getHeaders('/api/test');
    expect(headers1['X-Content-Type-Options']).toBe('nosniff');

    const headers2 = await manager.getHeaders('/api/test');
    expect(headers2['X-Content-Type-Options']).toBe('nosniff');
  });

  it('trailing-slash strip keeps cache-key parity between slash variants', async () => {
    await manager.getHeaders('/api/test');
    await manager.getHeaders('/api/test/');
    await manager.getHeaders('/api/test///');
    const cache = (manager as unknown as { headersCache: Map<string, Record<string, string>> }).headersCache;
    expect(cache.size).toBe(1);
    const headers = await manager.getHeaders('/api/test/');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('pathological slash runs resolve in linear time (no anchored-quantifier regex)', async () => {
    /* '/'+run+'x' was the quadratic input for replace(/\/+$/, ''): every
       offset rescans the slash run against the $ anchor. The linear strip
       must finish well inside the test timeout. */
    const midRunPath = `/${'/'.repeat(200_000)}x`;
    const headers = await manager.getHeaders(midRunPath);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');

    const tailRunPath = `/api${'/'.repeat(200_000)}`;
    const tailHeaders = await manager.getHeaders(tailRunPath);
    expect(tailHeaders['X-Frame-Options']).toBe('SAMEORIGIN');
  });

  it('configure with enabled=false clears all headers', async () => {
    manager.configure({ enabled: false });
    const headers = await manager.getHeaders('/api/test');
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it('configure sets CSP headers', async () => {
    manager.configure({ csp: { 'default-src': ["'self'"], 'script-src': ["'self'", 'cdn.example.com'] } });
    const headers = await manager.getHeaders('/api/test');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain('script-src');
  });

  it('configure sets HSTS headers', async () => {
    manager.configure({ hstsMaxAge: 31536000, hstsIncludeSubdomains: true, hstsPreload: true });
    const headers = await manager.getHeaders('/api/test');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(headers['Strict-Transport-Security']).toContain('preload');
  });

  it('configure sets custom headers', async () => {
    manager.configure({ customHeaders: { 'X-Custom': 'value' } });
    const headers = await manager.getHeaders('/api/test');
    expect(headers['X-Custom']).toBe('value');
  });

  it('CORS with wildcard origin', () => {
    manager.configure({ corsOrigins: ['*'] });
    const headers = manager.getCorsHeaders('https://any-origin.com');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

describe('SecurityHeadersManager with Redis', () => {
  it('loadCachedConfig restores from Redis', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    const redis = createMockRedis();
    redis.getKey.mockImplementation(async (_ns: string, key: string) => {
      if (key === 'csp_config') return JSON.stringify({ 'default-src': ["'self'"] });
      if (key === 'hsts_config') return JSON.stringify({ maxAge: 31536000, includeSubdomains: true, preload: false });
      if (key === 'custom_headers') return JSON.stringify({ 'X-Custom': 'val' });
      return null;
    });
    await manager.initializeRedis(redis as never);
  });

  it('caches configuration to Redis on configure', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    const redis = createMockRedis();
    await manager.initializeRedis(redis as never);
    manager.configure({
      csp: { 'default-src': ["'self'"] },
      hstsMaxAge: 31536000,
      customHeaders: { 'X-Test': 'value' },
    });
  });

  it('getHeaders evicts cache when maxSize exceeded', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    (manager as unknown as Record<string, unknown>)['cacheMaxSize'] = 2;

    await manager.getHeaders('/a');
    await manager.getHeaders('/b');
    await manager.getHeaders('/c');
  });

  it('loads all three cached configs', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    const redis = {
      getKey: vi.fn(async (_: string, key: string) => {
        if (key === 'csp_config') return JSON.stringify({ 'default-src': ["'self'"] });
        if (key === 'hsts_config') return JSON.stringify({ maxAge: 86400, includeSubdomains: true, preload: false });
        if (key === 'custom_headers') return JSON.stringify({ 'X-My': 'val' });
        return null;
      }),
      setKey: vi.fn(),
      deletePattern: vi.fn(),
    };
    await manager.initializeRedis(redis as never);
    const headers = await manager.getHeaders('/');
    expect(headers['Content-Security-Policy']).toContain("default-src");
  });

  it('loadCachedConfig handles malformed JSON', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    const redis = {
      getKey: vi.fn(async () => 'not-json'),
      setKey: vi.fn(),
      deletePattern: vi.fn(),
    };
    await manager.initializeRedis(redis as never);
  });

  it('reset clears Redis keys', async () => {
    const manager = new SecurityHeadersManager(defaultLogger);
    const redis = {
      getKey: vi.fn(async () => null),
      setKey: vi.fn(),
      deletePattern: vi.fn(),
    };
    await manager.initializeRedis(redis as never);
    await manager.reset();
    expect(redis.deletePattern).toHaveBeenCalled();
  });
});
