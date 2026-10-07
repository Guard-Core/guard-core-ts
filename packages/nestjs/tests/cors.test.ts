import { describe, it, expect, vi } from 'vitest';
import { SecurityConfigSchema } from '@guardcore/core';
import { configureCors, buildOriginAllowlist } from '../src/cors.js';

type CorsHandler = (req: { headers: Record<string, string> }, res: {
  statusCode: number;
  getHeader: (name: string) => string | undefined;
  setHeader: (name: string, value: string) => void;
  end: () => void;
}, next: () => void) => void;

function runCors(handler: CorsHandler, origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  handler(
    { headers: origin === undefined ? {} : { origin } },
    {
      statusCode: 200,
      getHeader: (name: string) => headers[name.toLowerCase()],
      setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
      end: () => {},
    },
    () => {},
  );
  return headers;
}

describe('configureCors (matrix gap 41, the B12 adapter-level helper)', () => {
  it('registers the cors middleware when enabled and installed', () => {
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: true,
    }) as unknown as Parameters<typeof configureCors>[1]);
    expect(app.use).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when cors is disabled', () => {
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: false,
    }) as unknown as Parameters<typeof configureCors>[1]);
    expect(app.use).not.toHaveBeenCalled();
  });

  it('admits a configured origin and reflects it on the response', () => {
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: true,
      corsAllowOrigins: ['https://example.com'],
      corsAllowMethods: ['GET', 'POST'],
      corsAllowHeaders: ['X-Custom'],
      corsAllowCredentials: true,
      corsExposeHeaders: ['X-Total'],
      corsMaxAge: 600,
    }) as unknown as Parameters<typeof configureCors>[1]);

    const middleware = (app.use as ReturnType<typeof vi.fn>).mock.calls[0][0] as CorsHandler;
    const allowed = runCors(middleware, 'https://example.com');
    expect(allowed['access-control-allow-origin']).toBe('https://example.com');
    expect(allowed['access-control-allow-credentials']).toBe('true');
    expect(allowed['access-control-expose-headers']).toContain('X-Total');

    // The method/header allows ride the preflight (OPTIONS) response.
    const preflight = { headers: { origin: 'https://example.com' }, method: 'OPTIONS' };
    const preflightHeaders: Record<string, string> = {};
    middleware(
      preflight,
      {
        statusCode: 204,
        getHeader: (name: string) => preflightHeaders[name.toLowerCase()],
        setHeader: (name, value) => { preflightHeaders[name.toLowerCase()] = value; },
        end: () => {},
      },
      () => {},
    );
    expect(preflightHeaders['access-control-allow-methods']).toContain('POST');
    expect(preflightHeaders['access-control-allow-headers']).toContain('X-Custom');
    expect(preflightHeaders['access-control-max-age']).toBe('600');
  });

  it('never admits an origin outside the configured allowlist', () => {
    const app = { use: vi.fn() };
    configureCors(app as never, SecurityConfigSchema.parse({
      enableCors: true,
      corsAllowOrigins: ['https://example.com'],
    }) as unknown as Parameters<typeof configureCors>[1]);

    const middleware = (app.use as ReturnType<typeof vi.fn>).mock.calls[0][0] as CorsHandler;
    const evil = runCors(middleware, 'https://example.com.evil');
    expect(evil['access-control-allow-origin']).toBeUndefined();

    const noOrigin = runCors(middleware, undefined);
    expect(noOrigin['access-control-allow-origin']).toBeUndefined();
  });

  it('buildOriginAllowlist only admits configured exact origins', () => {
    const predicate = buildOriginAllowlist(['https://a.example', 'https://b.example']);
    predicate('https://a.example', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
    predicate('https://a.example.evil', (_err, allow) => {
      expect(allow).toBe(false);
    });
    predicate(undefined, (_err, allow) => {
      expect(allow).toBe(false);
    });
  });

  it('throws the install hint when the middleware cannot mount', () => {
    const mockApp = {
      use: vi.fn(() => { throw new Error('Cannot find module'); }),
    } as never;
    const config = {
      enableCors: true,
      corsAllowOrigins: ['https://example.com'],
      corsAllowMethods: ['GET'],
      corsAllowHeaders: ['*'],
      corsAllowCredentials: false,
      corsExposeHeaders: [],
      corsMaxAge: 600,
    } as never;

    expect(() => configureCors(mockApp, config)).toThrow(
      'CORS is enabled but the "cors" package is not installed',
    );
  });
});
