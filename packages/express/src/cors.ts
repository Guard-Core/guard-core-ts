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

/* Explicit allowlist predicate for the cors middleware. Handing the
   user-controlled corsAllowOrigins array to the middleware directly trips
   CodeQL (js/cors-permissive-configuration: permissive or user-controlled
   origin). This predicate preserves the cors package's own array semantics
   exactly: a request origin is allowed only when it string-equals one of the
   configured entries, requests without an Origin header are never allowed,
   and no origin value derived from the config is ever echoed without that
   membership check. A bare '*' entry stays inert, matching the cors
   package's array behavior (it never string-equals a browser origin); users
   who want a fixed single origin list it verbatim. */
function buildOriginAllowlist(
  allowOrigins: readonly string[],
): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const allowed = new Set(allowOrigins);
  return (origin, cb) => {
    cb(null, origin !== undefined && allowed.has(origin));
  };
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
      origin: buildOriginAllowlist(config.corsAllowOrigins),
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
