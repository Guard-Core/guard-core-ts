/**
 * Blocked-response content type trio, ported from fastapi-guard #144
 * (tests/test_middleware/test_block_response_content_type.py): block and
 * error responses are text/plain carrying the message itself, and a custom
 * response modifier can still set its own content type. These tests run the
 * real middleware (no module mocks) against a blacklisted client IP.
 */

import { describe, it, expect, vi } from 'vitest';
import type { GuardResponse, SecurityConfig } from '@guardcore/core';
import { createSecurityMiddleware } from '../src/index.js';

const BLOCKED_IP = '203.0.113.10';

function config(overrides: Record<string, unknown> = {}): SecurityConfig {
  return {
    blacklist: [BLOCKED_IP],
    enableRateLimiting: false,
    enableRedis: false,
    ...overrides,
  } as SecurityConfig;
}

function createReq() {
  return {
    path: '/ping',
    protocol: 'http',
    get: (name: string) => name === 'host' ? 'test' : undefined,
    originalUrl: '/ping',
    method: 'GET',
    socket: { remoteAddress: BLOCKED_IP },
    headers: { 'user-agent': 'Test/1.0', host: 'test' },
    query: {},
  };
}

function createRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn(),
    redirect: vi.fn(),
  };
}

async function blockedResponse(overrides: Record<string, unknown> = {}) {
  const middleware = createSecurityMiddleware({ config: config(overrides) });
  const res = createRes();
  const next = vi.fn();
  await middleware(createReq() as never, res as never, next);
  expect(next).not.toHaveBeenCalled();
  const bodyBuffer = res.send.mock.calls[0]?.[0] as Buffer | undefined;
  return { status: res.status.mock.calls[0]?.[0], headers: res.headers, body: bodyBuffer?.toString() };
}

/* Case-insensitive header lookup: the response factory sets lowercase
   content-type while the security headers manager emits canonical names. */
export function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

describe('blocked response content type (express)', () => {
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
