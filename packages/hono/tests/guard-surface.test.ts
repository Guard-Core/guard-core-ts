import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createGuardMiddleware, type GuardSurface } from '../src/index.js';

/* B4/B5/B6/B9: the adapter guard surface attached to the middleware handler. */

describe('guard surface (hono)', () => {
  it('exposes the surface members on the middleware handler', async () => {
    const guard = createGuardMiddleware({
      config: { enableRedis: false, enableRateLimiting: true, rateLimit: 1000, rateLimitWindow: 60 },
    }) as unknown as GuardSurface & { (c: unknown, n: () => Promise<void>): Promise<unknown> };

    const before = guard.getInitializationStatus();
    expect(before.initialized).toBe(false);
    expect(before.agent.enabled).toBe(false);

    guard.markInitialized();
    expect(guard.getInitializationStatus().initialized).toBe(true);

    await expect(guard.reset()).resolves.toBeUndefined();
    await expect(guard.refreshCloudIpRanges()).resolves.toBeUndefined();
    const errorResponse = await guard.createErrorResponse(403, 'Forbidden');
    expect(errorResponse.statusCode).toBe(403);
    expect(guard.agentStats).toEqual({ enabled: false, degraded: false });

    // The middleware still serves requests through a real hono app.
    const app = new Hono();
    app.use('*', guard as never);
    app.get('/ping', (c) => c.json({ ok: true }));
    const res = await app.request('/ping');
    expect(res.status).toBe(200);
  });
});
