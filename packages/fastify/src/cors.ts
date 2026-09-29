import type { FastifyInstance } from 'fastify';
import type { ResolvedSecurityConfig } from '@guardcore/core';

export async function configureCors(fastify: FastifyInstance, config: ResolvedSecurityConfig): Promise<void> {
  if (!config.enableCors) return;

  try {
    const fastifyCors = await import('@fastify/cors');
    /* The dynamic import of an ESM build always carries a default export, so
       the fallback arm is a CJS-interop guard. */
    const resolvedCors = /* v8 ignore next */ fastifyCors.default ?? fastifyCors;
    await fastify.register(resolvedCors, {
      origin: config.corsAllowOrigins,
      methods: config.corsAllowMethods,
      allowedHeaders: config.corsAllowHeaders,
      credentials: config.corsAllowCredentials,
      exposedHeaders: config.corsExposeHeaders,
      maxAge: config.corsMaxAge,
    });
  } catch {
    throw new Error(
      '@guardcore/fastify: CORS is enabled but "@fastify/cors" is not installed. ' +
      'Run: pnpm add @fastify/cors',
    );
  }
}
