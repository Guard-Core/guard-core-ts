/**
 * Default client address resolution per Hono runtime: Node (@hono/node-server),
 * Deno, Bun and Cloudflare Workers, and the no-address fallbacks.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { resolveHonoClientAddress } from '../src/client-address.js';

function ctx(env: unknown, headers: Record<string, string> = {}) {
  return { env, req: { raw: { marker: 'req' }, header: (n: string) => headers[n] } } as never;
}

describe('resolveHonoClientAddress', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  afterEach(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  it('reads the Node server socket address', () => {
    expect(resolveHonoClientAddress(ctx({ incoming: { socket: { remoteAddress: '203.0.113.5' } } }))).toBe('203.0.113.5');
  });

  it('reads a string remoteAddr', () => {
    expect(resolveHonoClientAddress(ctx({ remoteAddr: '203.0.113.6' }))).toBe('203.0.113.6');
  });

  it('reads the Deno remoteAddr hostname', () => {
    expect(resolveHonoClientAddress(ctx({ remoteAddr: { transport: 'tcp', hostname: '203.0.113.7', port: 1 } }))).toBe('203.0.113.7');
  });

  it('reads the Bun server requestIP address', () => {
    const requestIP = (req: { marker: string }) => (req.marker === 'req' ? { address: '203.0.113.8' } : null);
    expect(resolveHonoClientAddress(ctx({ requestIP }))).toBe('203.0.113.8');
  });

  it('falls through when Bun requestIP has no address', () => {
    expect(resolveHonoClientAddress(ctx({ requestIP: () => null }))).toBeNull();
  });

  it('reads cf-connecting-ip only on Cloudflare Workers', () => {
    const headers = { 'cf-connecting-ip': '203.0.113.9' };
    expect(resolveHonoClientAddress(ctx({}, headers))).toBeNull();
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Cloudflare-Workers' }, configurable: true });
    expect(resolveHonoClientAddress(ctx({}, headers))).toBe('203.0.113.9');
    expect(resolveHonoClientAddress(ctx(undefined))).toBeNull();
  });

  it('returns null when the runtime exposes no address', () => {
    expect(resolveHonoClientAddress(ctx(undefined))).toBeNull();
    expect(resolveHonoClientAddress(ctx({ remoteAddr: {}, incoming: {} }))).toBeNull();
  });
});
