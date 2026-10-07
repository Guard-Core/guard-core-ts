import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { HandlerInitializer } from '../../src/core/initialization/handler-initializer.js';
import { CompositeAgentHandler } from '../../src/core/events/composite-handler.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';

const mockFetch = vi.fn().mockResolvedValue({
  json: async () => ({ prefixes: [{ ip_prefix: '52.0.0.0/8', service: 'AMAZON' }] }),
  text: async () => '',
});
vi.stubGlobal('fetch', mockFetch);

function createMockAgent() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    initializeRedis: vi.fn(),
    sendEvent: vi.fn(),
    sendMetric: vi.fn(),
    flushBuffer: vi.fn(),
    getDynamicRules: vi.fn().mockResolvedValue(null),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

describe('HandlerInitializer', () => {
  it('creates all handlers without Redis', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();

    expect(registry.redisHandler).toBeNull();
    expect(registry.ipBanHandler).toBeDefined();
    expect(registry.rateLimitHandler).toBeDefined();
    expect(registry.cloudHandler).toBeDefined();
    expect(registry.susPatternsHandler).toBeDefined();
    expect(registry.securityHeadersHandler).toBeDefined();
    expect(registry.behaviorTracker).toBeDefined();
    expect(registry.dynamicRuleHandler).toBeDefined();
    expect(registry.geoIpHandler).toBeNull();
  });

  it('configures security headers from config', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      securityHeaders: {
        enabled: true,
        csp: { 'default-src': ["'self'"] },
        frameOptions: 'DENY',
      },
    });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();

    const headers = await registry.securityHeadersHandler.getHeaders('/');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('creates with GeoIP handler', async () => {
    const geoIp = {
      isInitialized: true,
      initialize: async () => {},
      initializeRedis: async () => {},
      initializeAgent: async () => {},
      getCountry: () => 'US',
    };
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const initializer = new HandlerInitializer(config, defaultLogger, null, geoIp);
    const registry = await initializer.initialize();

    expect(registry.geoIpHandler).toBe(geoIp);
  });

  it('initializes GeoIP when not yet initialized', async () => {
    let initialized = false;
    const geoIp = {
      isInitialized: false,
      initialize: async () => { initialized = true; },
      initializeRedis: async () => {},
      initializeAgent: async () => {},
      getCountry: () => null,
    };
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const initializer = new HandlerInitializer(config, defaultLogger, null, geoIp);
    await initializer.initialize();

    expect(initialized).toBe(true);
  });

  it('handles Redis disabled config', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();

    expect(registry.redisHandler).toBeNull();
  });
});

describe('HandlerInitializer with agent', () => {
  it('initializes agent integrations when agent provided', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const agent = createMockAgent();
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never);
    const registry = await initializer.initialize();

    expect(agent.start).toHaveBeenCalledTimes(1);
    expect(registry.ipBanHandler).toBeDefined();
  });

  it('initializes cloud agent when cloud providers configured', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      blockCloudProviders: ['AWS'],
    });
    const agent = createMockAgent();
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never);
    await initializer.initialize();
    expect(agent.start).toHaveBeenCalled();
  });

  it('initializes geoIp agent when geoIpHandler provided', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const agent = createMockAgent();
    const geoIp = {
      isInitialized: true,
      initialize: vi.fn(),
      initializeRedis: vi.fn(),
      initializeAgent: vi.fn(),
      getCountry: () => 'US',
    };
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never, geoIp);
    const registry = await initializer.initialize();

    /* The composite is the telemetry seam; the geo handler receives it. */
    expect(registry.telemetryHandler).toBeInstanceOf(CompositeAgentHandler);
    expect(geoIp.initializeAgent).toHaveBeenCalledWith(registry.telemetryHandler);
  });

  it('initializes dynamic rules when enabled', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      enableDynamicRules: true,
      enableAgent: true,
      agentApiKey: 'key',
    });
    const agent = createMockAgent();
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never);
    await initializer.initialize();
    expect(agent.start).toHaveBeenCalled();
  });

  it('initializes guard decorator agent when provided', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const agent = createMockAgent();
    const decorator = { initializeAgent: vi.fn() };
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never, null, decorator);
    await initializer.initialize();

    const registry = initializer['buildRegistryPlaceholder'];
  });

  it('skips decorator agent when decorator has no initializeAgent', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false });
    const agent = createMockAgent();
    const decorator = { someOtherMethod: vi.fn() };
    const initializer = new HandlerInitializer(config, defaultLogger, agent as never, null, decorator);
    await initializer.initialize();
  });

  it('configures CORS when enabled', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: false,
      enableCors: true,
      corsAllowOrigins: ['https://example.com'],
    });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();

    const corsHeaders = registry.securityHeadersHandler.getCorsHeaders('https://example.com');
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  it('configures null securityHeaders gracefully', async () => {
    const config = SecurityConfigSchema.parse({ enableRedis: false, securityHeaders: null });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();
    expect(registry.securityHeadersHandler).toBeDefined();
  });
});

vi.mock('ioredis', () => {
  function MockRedis() { return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    script: vi.fn().mockResolvedValue('sha'),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    on: vi.fn(),
    disconnect: vi.fn(),
  }; }
  return { default: MockRedis };
});

describe('HandlerInitializer with Redis enabled', () => {
  it('initializes Redis and all handler Redis connections', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379',
    });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();

    expect(registry.redisHandler).not.toBeNull();
    expect(registry.ipBanHandler).toBeDefined();
    expect(registry.rateLimitHandler).toBeDefined();
  });

  it('initializes cloud handler Redis when providers configured', async () => {
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379',
      blockCloudProviders: ['AWS'],
    });
    const initializer = new HandlerInitializer(config, defaultLogger);
    const registry = await initializer.initialize();
    expect(registry.cloudHandler).toBeDefined();
  });

  it('initializes geoIp Redis when handler provided', async () => {
    const geoIp = {
      isInitialized: true,
      initialize: vi.fn(),
      initializeRedis: vi.fn(),
      initializeAgent: vi.fn(),
      getCountry: () => null,
    };
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379',
    });
    const initializer = new HandlerInitializer(config, defaultLogger, null, geoIp);
    await initializer.initialize();
    expect(geoIp.initializeRedis).toHaveBeenCalled();
  });

  it('full agent + Redis integration', async () => {
    const agent = {
      start: vi.fn(),
      stop: vi.fn(),
      initializeRedis: vi.fn(),
      sendEvent: vi.fn(),
      sendMetric: vi.fn(),
      flushBuffer: vi.fn(),
      getDynamicRules: vi.fn().mockResolvedValue(null),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    const config = SecurityConfigSchema.parse({
      enableRedis: true,
      redisUrl: 'redis://localhost:6379',
      blockCloudProviders: ['AWS'],
      enableDynamicRules: true,
      enableAgent: true,
      agentApiKey: 'test-key',
    });
    const geoIp = {
      isInitialized: true,
      initialize: vi.fn(),
      initializeRedis: vi.fn(),
      initializeAgent: vi.fn(),
      getCountry: () => 'US',
    };
    const decorator = { initializeAgent: vi.fn() };

    const initializer = new HandlerInitializer(
      config, defaultLogger, agent as never, geoIp, decorator,
    );
    const registry = await initializer.initialize();

    expect(agent.start).toHaveBeenCalled();
    expect(agent.initializeRedis).toHaveBeenCalled();
    expect(geoIp.initializeAgent).toHaveBeenCalled();
    expect(geoIp.initializeRedis).toHaveBeenCalled();
    expect(decorator.initializeAgent).toHaveBeenCalled();
    expect(registry.redisHandler).not.toBeNull();
  });
});
