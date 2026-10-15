import { describe, it, expect } from 'vitest';

import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { defaultLogger } from '../../src/models/logger.js';
import { scanRequestWithManager } from '../../src/utils.js';
import { createMockRequest, createTestConfig } from '../helpers.js';

/* The issue #161 repro shape: an ordinary logged-in Cookie header whose JWT
   session scored 0.71 semantically when the whole header was one value. */
function b64url(data: Buffer): string {
  return data.toString('base64url');
}

function sessionJwt(): string {
  const claims = {
    sub: '3f2c1b9e-8a47-4d2e-9c1f-5b6a7d8e9f01',
    name: 'Jane Doe (Acme)',
    email: 'jane.doe@example.com',
    roles: ['admin'],
    iat: 1792000000,
    exp: 1792000900,
  };
  return [
    b64url(Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))),
    b64url(Buffer.from(JSON.stringify(claims))),
    b64url(Buffer.from(Array.from({ length: 64 }, (_, i) => i))),
  ].join('.');
}

async function scan(cookie: string, overrides: Record<string, unknown> = {}) {
  const cfg = createTestConfig(overrides);
  const manager = new SusPatternsManager(cfg, defaultLogger);
  return scanRequestWithManager(manager, createMockRequest({ headers: { Cookie: cookie } }), cfg);
}

describe('Cookie header is scanned one name=value pair at a time', () => {
  const loggedIn = `session=${sessionJwt()}; theme=system; _ga=GA1.1.123456789.1792000000`;

  it('does not flag an ordinary logged-in cookie header', async () => {
    const [isThreat, info] = await scan(loggedIn);
    expect(info).toBe('');
    expect(isThreat).toBe(false);
  });

  it.each([
    ['xss', 'theme=dark; q=<script>alert(1)</script>'],
    ['sqli', "theme=dark; id=1' OR 1=1--"],
    ['crlf', 'theme=dark;\r\nSet-Cookie: admin=1'],
  ])('still detects %s inside one cookie', async (_id, cookie) => {
    expect((await scan(cookie))[0]).toBe(true);
  });

  it('skips empty pairs and trims spaces only', async () => {
    expect((await scan(' ;; a=1 ;  ; b=2;'))[0]).toBe(false);
  });

  it('counts each pair against the value budget', async () => {
    // 1 budget unit per name and per value: 600 harmless pairs exhaust the
    // 512 value cap, so a payload behind them is not scanned.
    const filler = Array.from({ length: 600 }, (_, i) => `k${i}=v`).join('; ');
    expect((await scan(`${filler}; q=<script>alert(1)</script>`))[0]).toBe(false);
  });

  it('applies the semantic-only header opt-out to each pair', async () => {
    const [flagged] = await scan(`session=${sessionJwt()}`, { detectionSemanticThreshold: 0.3 });
    expect(flagged).toBe(true);
    const [skipped] = await scan(`session=${sessionJwt()}; theme=system`, {
      detectionSemanticThreshold: 0.3,
      excludedSemanticDetectionHeaders: ['cookie'],
    });
    expect(skipped).toBe(false);
  });
});
