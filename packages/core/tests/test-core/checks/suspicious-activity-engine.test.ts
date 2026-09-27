/**
 * Middleware-level parity tests for the live SuspiciousActivityCheck path.
 *
 * The check must run the FULL SusPatternsManager pattern table (157 rows,
 * multi-view, per-context gates) over the request surface, exactly like the
 * reference detect flow (guard_core/_utils/penetration_detection.py +
 * detection_scan.py), instead of the retired 7-pattern shortcut. Every
 * vector below goes through the real pipeline built by
 * initializeSecurityMiddleware, so the tests prove end-to-end blocking.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initializeSecurityMiddleware } from '../../../src/middleware-support.js';
import type { SecurityMiddlewareComponents } from '../../../src/middleware-support.js';
import { SecurityConfigSchema } from '../../../src/models/config.js';
import { defaultLogger } from '../../../src/models/logger.js';
import type { GuardRequest } from '../../../src/protocols/request.js';
import { createMockResponseFactory } from '../../helpers.js';

function makeRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
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
    state: {},
    scope: {},
    ...overrides,
  };
}

describe('SuspiciousActivityCheck runs the full pattern table (middleware level)', () => {
  let components: SecurityMiddlewareComponents;

  beforeAll(async () => {
    /* enableIpBanning off: this file pins pattern-table detection, and the
       autoban engine now (correctly, at the default threshold of 10) bans
       the shared attack IP partway through the vector list, which would
       turn every later vector into an ip-security ban response. */
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      enableRateLimiting: false,
      enableIpBanning: false,
    });
    components = await initializeSecurityMiddleware(config, defaultLogger, createMockResponseFactory());
  });

  const blocked = async (request: GuardRequest) => {
    const response = await components.pipeline.execute(request);
    expect(response, `expected block for ${request.urlPath} ${JSON.stringify(request.queryParams)}`).not.toBeNull();
    expect(response!.statusCode).toBe(400);
  };

  const allowed = async (request: GuardRequest) => {
    const response = await components.pipeline.execute(request);
    expect(response, `expected pass for ${request.urlPath} ${JSON.stringify(request.queryParams)}`).toBeNull();
  };

  it('scans with the initializer manager: a custom pattern registered on it blocks live requests', async () => {
    /* The custom pattern lives only in the registry's SusPatternsManager
       instance; the middleware picking it up proves the check shares that
       manager instead of constructing its own per request. */
    await components.registry.susPatternsHandler.addPattern('guardcorecanary789');
    await blocked(makeRequest({ queryParams: { token: 'guardcorecanary789' } }));
    await components.registry.susPatternsHandler.removePattern('guardcorecanary789');
  });

  /* Rows that exist only in the canonical table: each of these passed
     through the retired 7-pattern shortcut unnoticed. */
  it('blocks recon probe paths in query params (separator-prefixed whole-value row)', async () => {
    await blocked(makeRequest({ queryParams: { next: '/actuator/health' } }));
  });

  it('blocks SQLi tautology in query params', async () => {
    await blocked(makeRequest({ queryParams: { id: "1' OR '1'='1" } }));
  });

  it('blocks sensitive file paths in query params', async () => {
    await blocked(makeRequest({ queryParams: { path: '/etc/passwd' } }));
  });

  it('blocks XSS event-handler payloads in query params', async () => {
    await blocked(makeRequest({ queryParams: { q: '<img src=x onerror=alert(1)>' } }));
  });

  it('blocks case-variant script injection in the URL path', async () => {
    await blocked(makeRequest({ urlPath: '/search/<ScRiPt>alert(1)</sCrIpT>' }));
  });

  /* Recon bare-word innocence must survive the full table (upstream #115/#116
     gate), including through the middleware. */
  it('lets bare-word recon lookalikes pass', async () => {
    await allowed(makeRequest({ queryParams: { system: 'SAP' } }));
    await allowed(makeRequest({ queryParams: { file: 'README.md' } }));
    await allowed(makeRequest({ queryParams: { page: 'default' } }));
  });

  it('still blocks separator-prefixed probes that look like bare words', async () => {
    await blocked(makeRequest({ queryParams: { system: '/SAP' } }));
  });

  /* JSON body leaves scan as request_body (context matrix: JSON values scan
     as request_body) and operator-shaped keys are flagged. */
  it('blocks nosql operator keys in a JSON body', async () => {
    const body = new TextEncoder().encode(JSON.stringify({ username: { $ne: null } }));
    await blocked(makeRequest({
      method: 'POST',
      headers: { 'user-agent': 'TestAgent/1.0', 'content-type': 'application/json' },
      body: async () => body,
    }));
  });

  it('blocks attack payloads in JSON body leaves', async () => {
    const body = new TextEncoder().encode(JSON.stringify({ comment: '<img src=x onerror=alert(1)>' }));
    await blocked(makeRequest({
      method: 'POST',
      headers: { 'user-agent': 'TestAgent/1.0', 'content-type': 'application/json' },
      body: async () => body,
    }));
  });

  it('lets benign JSON bodies pass', async () => {
    const body = new TextEncoder().encode(JSON.stringify({ user: { name: 'Alice', age: 30 } }));
    await allowed(makeRequest({
      method: 'POST',
      headers: { 'user-agent': 'TestAgent/1.0', 'content-type': 'application/json' },
      body: async () => body,
    }));
  });

  /* JSON embedded inside a query param: leaves carry the :embedded_json
     context suffix, so the engine gates apply to them. */
  it('blocks attacks inside JSON embedded in a query param', async () => {
    await blocked(makeRequest({
      queryParams: { filter: '{"username":{"$ne":null}}' },
    }));
  });

  it('blocks attacks inside JSON embedded in a header value', async () => {
    await blocked(makeRequest({
      headers: {
        'user-agent': 'TestAgent/1.0',
        'x-payload': '{"cmd":"; cat /etc/passwd"}',
      },
    }));
  });

  it('applies the embedded_json gate: source-extension leaves in embedded JSON are not probes', async () => {
    /* The leaf "src/app.py" would be a recon probe as a plain value; as an
       embedded JSON leaf (context request-side :embedded_json suffix) the
       reference's source-extension validator treats it as ordinary data. */
    await allowed(makeRequest({
      queryParams: { config: '{"path":"src/app.py"}' },
    }));
  });

  it('blocks attacks in urlencoded form bodies', async () => {
    const body = new TextEncoder().encode('comment=<img src=x onerror=alert(1)>&ok=1');
    await blocked(makeRequest({
      method: 'POST',
      headers: {
        'user-agent': 'TestAgent/1.0',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: async () => body,
    }));
  });

  it('lets benign urlencoded form bodies pass', async () => {
    const body = new TextEncoder().encode('name=Alice&city=Berlin');
    await allowed(makeRequest({
      method: 'POST',
      headers: {
        'user-agent': 'TestAgent/1.0',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: async () => body,
    }));
  });

  it('lets benign array JSON bodies pass', async () => {
    const body = new TextEncoder().encode(JSON.stringify([{ name: 'Alice' }, { name: 'Bob' }]));
    await allowed(makeRequest({
      method: 'POST',
      headers: { 'user-agent': 'TestAgent/1.0', 'content-type': 'application/json' },
      body: async () => body,
    }));
  });

  it('keeps passive mode non-blocking while still counting', async () => {
    const passiveConfig = SecurityConfigSchema.parse({
      enableRedis: false,
      enableRateLimiting: false,
      passiveMode: true,
    });
    const passiveComponents = await initializeSecurityMiddleware(
      passiveConfig, defaultLogger, createMockResponseFactory(),
    );
    const response = await passiveComponents.pipeline.execute(
      makeRequest({ queryParams: { q: '<img src=x onerror=alert(1)>' } }),
    );
    expect(response).toBeNull();
    expect(passiveComponents.middlewareProtocol.suspiciousRequestCounts.get('1.2.3.4')?.get('xss')).toBe(1);
  });
});
