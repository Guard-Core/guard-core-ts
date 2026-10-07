import { describe, it, expect } from 'vitest';
import fastify from 'fastify';
import { guardPlugin, type GuardSurface } from '../src/index.js';

/* B4/B5/B6/B9/B16: the adapter guard surface, decorated as fastify.guard. */

describe('guard surface (fastify)', () => {
  it('decorates the instance with the surface and registers the status route', async () => {
    const app = fastify();
    const options = {
      config: { enableRedis: false, enableRateLimiting: true, rateLimit: 1000, rateLimitWindow: 60 },
    };
    // Guard surface is reachable right after register, before boot; the
    // status route registers pre-boot like every fastify route.
    await app.register(guardPlugin, options);
    const guard = (app as unknown as { guard: GuardSurface }).guard;
    expect(guard).toBeDefined();
    guard.addStatusRoute();
    await app.ready();

    const status = guard.getInitializationStatus();
    expect(status).toMatchObject({ initialized: true, redis: false, agent: { enabled: false, degraded: false } });

    guard.markInitialized();
    expect(guard.getInitializationStatus().initialized).toBe(true);
    expect(guard.agentStats).toEqual({ enabled: false, degraded: false });

    await expect(guard.reset()).resolves.toBeUndefined();
    await expect(guard.refreshCloudIpRanges()).resolves.toBeUndefined();
    const errorResponse = await guard.createErrorResponse(403, 'Forbidden');
    expect(errorResponse.statusCode).toBe(403);

    const res = await app.inject({ method: 'GET', url: '/_guard/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ initialized: true });
  });
});
