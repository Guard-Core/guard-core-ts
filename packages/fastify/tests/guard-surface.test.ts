import { describe, it, expect } from 'vitest';
import fastify from 'fastify';
import { guardPlugin, type GuardSurface } from '../src/index.js';
import type { AgentHandlerProtocol } from '@guardcore/core';

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

    // An injected agent flips the enabled arm with its own stats.
    const agentApp = fastify();
    await agentApp.register(guardPlugin, {
      config: { enableRedis: false, enableAgent: true, agentApiKey: 'test-api-key-123' },
      agentHandler: stubAgent,
    });
    const agentGuard = (agentApp as unknown as { guard: GuardSurface }).guard;
    expect(agentGuard.agentStats).toMatchObject({ enabled: true, degraded: false, events: 5 });

    // A handler without getStats coalesces to the empty stats bag.
    const bareAgent = { ...stubAgent } as unknown as AgentHandlerProtocol;
    delete (bareAgent as { getStats?: unknown }).getStats;
    const bareApp = fastify();
    await bareApp.register(guardPlugin, {
      config: { enableRedis: false, enableAgent: true, agentApiKey: 'test-api-key-123' },
      agentHandler: bareAgent,
    });
    const bareGuard = (bareApp as unknown as { guard: GuardSurface }).guard;
    expect(bareGuard.agentStats).toEqual({ enabled: true, degraded: false });

    const res = await app.inject({ method: 'GET', url: '/_guard/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ initialized: true });
  });
});
