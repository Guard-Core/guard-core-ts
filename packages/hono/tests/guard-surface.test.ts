import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { AgentHandlerProtocol } from '@guardcore/core';
import { createGuardMiddleware, type GuardSurface } from '../src/index.js';

const stubAgent = {
  async sendEvent() {},
  async sendMetric() {},
  async start() {},
  async stop() {},
  async flushBuffer() {},
  async getDynamicRules() { return null; },
  async healthCheck() { return true; },
  async initializeRedis() {},
  getStats() { return { events: 5 }; },
} as unknown as AgentHandlerProtocol;

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

  it('reports agentStats with the handler stats when an agent rides the options', async () => {
    const guard = createGuardMiddleware({
      config: { enableRedis: false, enableAgent: true, agentApiKey: 'test-api-key-123' },
      agentHandler: stubAgent,
    }) as unknown as GuardSurface;

    // The lazy engine wires the injected handler; agentStats reports enabled.
    await guard.refreshCloudIpRanges();
    expect(guard.agentStats).toMatchObject({ enabled: true, degraded: false, events: 5 });

    // A handler without getStats coalesces to the empty stats bag.
    const bareAgent = { ...stubAgent } as unknown as AgentHandlerProtocol;
    delete (bareAgent as { getStats?: unknown }).getStats;
    const bareGuard = createGuardMiddleware({
      config: { enableRedis: false, enableAgent: true, agentApiKey: 'test-api-key-123' },
      agentHandler: bareAgent,
    }) as unknown as GuardSurface;
    await bareGuard.refreshCloudIpRanges();
    expect(bareGuard.agentStats).toEqual({ enabled: true, degraded: false });

    // The initialized short-circuit answers in one read.
    const status = bareGuard.getInitializationStatus();
    expect(status.initialized).toBe(true);
  });
});
