import { createRequire } from 'module';
import type { Express, RequestHandler } from 'express';
import type { ResolvedSecurityConfig } from '@guardcore/core';

type CorsMiddlewareFactory = (options?: Record<string, unknown>) => RequestHandler;

/**
 * Loads the optional "cors" peer dependency. The package ships dual ESM/CJS
 * builds, so `require` must not be assumed to exist: in the ESM build it is
 * undefined and resolution has to go through `createRequire`.
 */
function loadCors(): CorsMiddlewareFactory | null {
  /* The require branch only exists for CJS consumers; the ESM build always
     resolves through createRequire. The null fallback guards a missing
     install, which cannot happen while cors is a dev dependency. */
  /* v8 ignore start -- CJS interop and missing-package guards */
  try {
    if (typeof require === 'function') {
      return require('cors') as CorsMiddlewareFactory;
    }
  } catch {
    // fall through to createRequire
  }
  try {
    return createRequire(import.meta.url)('cors') as CorsMiddlewareFactory;
  } catch {
    return null;
  }
  /* v8 ignore stop */
}

export function configureCors(app: Express, config: ResolvedSecurityConfig): void {
  if (!config.enableCors) return;

  try {
    const corsMiddleware = loadCors();
    /* loadCors only returns null when the cors package is missing, which
       cannot happen while cors is a dev dependency. */
    /* v8 ignore start */
    if (!corsMiddleware) {
      throw new Error('cors package is not installed');
    }
    /* v8 ignore stop */
    app.use(corsMiddleware({
      origin: config.corsAllowOrigins,
      methods: config.corsAllowMethods,
      allowedHeaders: config.corsAllowHeaders,
      credentials: config.corsAllowCredentials,
      exposedHeaders: config.corsExposeHeaders,
      maxAge: config.corsMaxAge,
    }));
  } catch {
    throw new Error(
      '@guardcore/express: CORS is enabled but the "cors" package is not installed. ' +
      'Run: pnpm add cors',
    );
  }
}
