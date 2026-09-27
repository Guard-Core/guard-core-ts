/**
 * Blocked-response content type trio, ported from fastapi-guard #144
 * (tests/test_middleware/test_block_response_content_type.py): block and
 * error responses are text/plain carrying the message itself, and a custom
 * response modifier can still set its own content type. These tests run the
 * real middleware (no module mocks) against a blacklisted client IP.
 */

import { describe, it, expect, vi } from 'vitest';
import type { GuardResponse, SecurityConfig } from '@guardcore/core';
import { createGuardMiddleware } from '../src/middleware.js';

const BLOCKED_IP = '203.0.113.10';

function config(overrides: Record<string, unknown> = {}): SecurityConfig {
  return {
    blacklist: [BLOCKED_IP],
    enableRateLimiting: false,
    enableRedis: false,
    ...overrides,
  } as SecurityConfig;
}

function createCtx() {
  const responseHeaders: Record<string, string> = {};
  return {
    responseHeaders,
    header: vi.fn((name: string, value: string) => { responseHeaders[name] = value; }),
    body: vi.fn((_data: string | null, status: number) => new Response(_data ?? '', { status })),
    redirect: vi.fn(() => new Response(null, { status: 302 })),
    env: {},
    req: {
      url: 'http://test/ping',
      method: 'GET',
      raw: new Request('http://test/ping', { headers: { 'user-agent': 'Test/1.0' } }),
      header: () => null,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    },
  };
}

async function blockedResponse(overrides: Record<string, unknown> = {}) {
  const middleware = createGuardMiddleware({
    config: config(overrides),
    connectingIpResolver: () => BLOCKED_IP,
  });
  const ctx = createCtx();
  await middleware(ctx as never, vi.fn().mockResolvedValue(undefined));
  return { status: ctx.body.mock.calls[0]?.[1], headers: ctx.responseHeaders, body: ctx.body.mock.calls[0]?.[0] };
}

/* Case-insensitive header lookup: the response factory sets lowercase
   content-type while the security headers manager emits canonical names. */
function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

describe('blocked response content type (hono)', () => {
  it('block response is plain text with nosniff', async () => {
    const { status, headers, body } = await blockedResponse();
    expect(status).toBe(403);
    expect(headerValue(headers, 'content-type')).toBe('text/plain; charset=utf-8');
    expect(headerValue(headers, 'x-content-type-options')).toBe('nosniff');
    expect(body).toBe('Forbidden');
  });

  it('custom error message stays plain text', async () => {
    const { status, headers, body } = await blockedResponse({
      customErrorResponses: { 403: 'Blocked by policy' },
    });
    expect(status).toBe(403);
    expect(headerValue(headers, 'content-type')).toBe('text/plain; charset=utf-8');
    expect(body).toBe('Blocked by policy');
  });

  it('response modifier can still set its own content type', async () => {
    const modifier = async (response: GuardResponse) => {
      response.setHeader('content-type', 'application/problem+json');
      return response;
    };
    const { status, headers } = await blockedResponse({ customResponseModifier: modifier });
    expect(status).toBe(403);
    expect(headerValue(headers, 'content-type')).toBe('application/problem+json');
  });
});
