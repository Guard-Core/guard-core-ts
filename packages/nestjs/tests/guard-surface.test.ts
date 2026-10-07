import { describe, it, expect } from 'vitest';
import {
  SecurityConfigSchema,
  initializeSecurityMiddleware,
  resolveConfiguredLogger,
} from '@guardcore/core';
import { NestResponseFactory } from '../src/adapters.js';
import { SecurityMiddlewareNest } from '../src/index.js';
import type { SecurityMiddlewareComponents } from '@guardcore/core';

/* B4/B5/B6/B9: the adapter guard surface carried by SecurityMiddlewareNest. */

async function buildMiddleware(enableAgent = false): Promise<SecurityMiddlewareNest> {
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
    config, logger, new NestResponseFactory(), null, null,
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
});
