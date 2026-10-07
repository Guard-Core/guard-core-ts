import { describe, it, expect } from 'vitest';
import {
  SecurityConfigSchema,
  initializeSecurityMiddleware,
  resolveConfiguredLogger,
} from '@guardcore/core';
import { NestResponseFactory } from '../src/adapters.js';
import { SecurityMiddlewareNest } from '../src/index.js';
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

import type { SecurityMiddlewareComponents } from '@guardcore/core';

/* B4/B5/B6/B9: the adapter guard surface carried by SecurityMiddlewareNest. */

async function buildMiddleware(enableAgent = false, agentHandler?: AgentHandlerProtocol): Promise<SecurityMiddlewareNest> {
  const config = SecurityConfigSchema.parse({
    enableRedis: false,
    enableRateLimiting: true,
    rateLimit: 1000,
    rateLimitWindow: 60,
    enableAgent,
    agentApiKey: enableAgent ? 'test-api-key-123' : null,
  });
  const logger = await resolveConfiguredLogger(config);
  const components = (await initializeSecurityMiddleware(
    config, logger, new NestResponseFactory(), agentHandler ?? null, null,
  )) as unknown as SecurityMiddlewareComponents & { agentDegraded: boolean; agentEnabled: boolean };
  components.agentDegraded = false;
  components.agentEnabled = enableAgent;
  return new SecurityMiddlewareNest(components);
}

describe('guard surface (nestjs)', () => {
  it('reports the initialization status with the agent bridge answer', async () => {
    const middleware = await buildMiddleware(false);
    const status = middleware.getInitializationStatus();
    expect(status).toMatchObject({ initialized: true, redis: false, agent: { enabled: false, degraded: false } });
  });

  it('exposes agentStats with the disabled shape and resets cleanly', async () => {
    const middleware = await buildMiddleware(false);
    expect(middleware.agentStats).toEqual({ enabled: false, degraded: false });
    middleware.markInitialized();
    await expect(middleware.reset()).resolves.toBeUndefined();
    await expect(middleware.refreshCloudIpRanges()).resolves.toBeUndefined();
    const response = await middleware.createErrorResponse(403, 'Forbidden');
    expect(response.statusCode).toBe(403);
  });

  it('reports agentStats with the handler stats when an agent is enabled', async () => {
    const middleware = await buildMiddleware(true, stubAgent);
    // The telemetry seam holds the composite; its stats answer rides through.
    const telemetry = (middleware as unknown as {
      components: { middlewareProtocol: { agentHandler: { getStats?: () => Record<string, unknown> } } };
    }).components.middlewareProtocol.agentHandler;
    telemetry!.getStats = () => ({ events: 5 });
    expect(middleware.agentStats).toMatchObject({ enabled: true, degraded: false, events: 5 });
  });
});
