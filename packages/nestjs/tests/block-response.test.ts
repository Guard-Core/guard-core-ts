/**
 * Blocked-response content type trio, ported from fastapi-guard #144
 * (tests/test_middleware/test_block_response_content_type.py): block and
 * error responses are text/plain carrying the message itself, and a custom
 * response modifier can still set its own content type. These tests run the
 * real middleware with real components (no module mocks) against a
 * blacklisted client IP. Direct construction mirrors GuardModule.forRoot's
 * wiring without the Nest DI container.
 */

import { describe, it, expect, vi } from 'vitest';
import type { GuardResponse, SecurityConfig, SecurityMiddlewareComponents } from '@guardcore/core';
import { SecurityConfigSchema, defaultLogger, initializeSecurityMiddleware } from '@guardcore/core';
import { SecurityMiddlewareNest } from '../src/guard-module.js';
import { NestResponseFactory } from '../src/adapters.js';

const BLOCKED_IP = '203.0.113.10';

function config(overrides: Record<string, unknown> = {}): SecurityConfig {
  return SecurityConfigSchema.parse({
    blacklist: [BLOCKED_IP],
    enableRateLimiting: false,
    enableRedis: false,
    ...overrides,
  }) as SecurityConfig;
}

async function blockedResponse(overrides: Record<string, unknown> = {}) {
  const components: SecurityMiddlewareComponents = await initializeSecurityMiddleware(
    config(overrides), defaultLogger, new NestResponseFactory(),
  );
  const middleware = new SecurityMiddlewareNest(components);

  const req = {
    path: '/ping',
    protocol: 'http',
    get: (name: string) => name === 'host' ? 'test' : undefined,
    originalUrl: '/ping',
    method: 'GET',
    socket: { remoteAddress: BLOCKED_IP },
    headers: { 'user-agent': 'Test/1.0', host: 'test' },
    query: {},
  };
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn(),
    redirect: vi.fn(),
  };
  const next = vi.fn();
  await middleware.use(req as never, res as never, next);
  expect(next).not.toHaveBeenCalled();

  const bodyBuffer = res.send.mock.calls[0]?.[0] as Buffer | undefined;
  return { status: res.status.mock.calls[0]?.[0], headers, body: bodyBuffer?.toString() };
}

/* Case-insensitive header lookup: the response factory sets lowercase
   content-type while the security headers manager emits canonical names. */
function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

describe('blocked response content type (nestjs)', () => {
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
