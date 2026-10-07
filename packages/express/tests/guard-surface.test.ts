import { describe, it, expect } from 'vitest';
import express from 'express';
import {
  createSecurityMiddleware,
  addStatusRoute,
  type GuardMiddlewareSurface,
} from '../src/index.js';
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


/* B4/B5/B6/B9/B16: the adapter guard surface. The middleware function
   carries reset(), mark_initialized / get_initialization_status, the public
   refresh_cloud_ip_ranges, agent_stats and create_error_response, and
   addStatusRoute mounts the status endpoint. */

const config = {
  enableRedis: false,
  enableAgent: false,
  enableRateLimiting: true,
  rateLimit: 1000,
  rateLimitWindow: 60,
};

describe('guard middleware surface (express)', () => {
  it('reports initialization status, marks initialized and answers the status route', async () => {
    const guard = createSecurityMiddleware({ config }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;

    const before = guard.getInitializationStatus();
    expect(before.initialized).toBe(false);
    expect(before.redis).toBe(false);
    expect(before.agent.enabled).toBe(false);

    guard.markInitialized();
    expect(guard.getInitializationStatus().initialized).toBe(true);

    const app = express();
    app.use(guard);
    addStatusRoute(app, guard);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/_guard/status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ initialized: true, redis: false, agent: { enabled: false, degraded: false } });
    server.close();
  });

  it('exposes agentStats with the disabled shape', () => {
    const guard = createSecurityMiddleware({ config }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    expect(guard.agentStats).toEqual({ enabled: false, degraded: false });
  });

  it('resets without raising and refreshes cloud ranges as a public method', async () => {
    const guard = createSecurityMiddleware({ config }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    await expect(guard.reset()).resolves.toBeUndefined();
    await expect(guard.refreshCloudIpRanges()).resolves.toBeUndefined();
  });

  it('reports agentStats with the handler stats when an agent rides the options', async () => {
    const guard = createSecurityMiddleware({ config, agentHandler: stubAgent }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    await guard.refreshCloudIpRanges();
    expect(guard.agentStats).toMatchObject({ enabled: true, degraded: false, events: 5 });
  });

  it('reports agentStats with the handler stats when an agent rides the options', async () => {
    const guard = createSecurityMiddleware({ config, agentHandler: stubAgent }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    await guard.refreshCloudIpRanges();
    expect(guard.agentStats).toMatchObject({ enabled: true, degraded: false, events: 5 });

    // A handler without getStats coalesces to the empty stats bag.
    const bareAgent = { ...stubAgent } as unknown as AgentHandlerProtocol;
    delete (bareAgent as { getStats?: unknown }).getStats;
    const bareGuard = createSecurityMiddleware({ config, agentHandler: bareAgent }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    await bareGuard.refreshCloudIpRanges();
    expect(bareGuard.agentStats).toEqual({ enabled: true, degraded: false });
  });

  it('createErrorResponse builds the family error contract', async () => {
    const guard = createSecurityMiddleware({ config }) as ReturnType<typeof createSecurityMiddleware> & GuardMiddlewareSurface;
    const response = await guard.createErrorResponse(403, 'Forbidden');
    expect(response.statusCode).toBe(403);
    expect(response.bodyText).toBe('Forbidden');
  });
});
