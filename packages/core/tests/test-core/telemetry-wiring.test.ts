import { describe, it, expect, vi } from 'vitest';
import { initializeSecurityMiddleware } from '../../src/middleware-support.js';
import { CompositeAgentHandler } from '../../src/core/events/composite-handler.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { createMockRequest, createMockResponseFactory } from '../helpers.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';

function capturingAgent(): { agent: AgentHandlerProtocol; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const agent = {
    async sendEvent(event: unknown) { events.push(event as Record<string, unknown>); },
    async sendMetric() {},
    async start() {},
    async stop() {},
    async flushBuffer() {},
    async getDynamicRules() { return null; },
    async healthCheck() { return true; },
    async initializeRedis() {},
  };
  return { agent: agent as unknown as AgentHandlerProtocol, events };
}

describe('telemetry sink wiring (composite handler from config)', () => {
  it('wraps the injected agent in the composite with the OTEL and Logfire sinks', async () => {
    const { agent } = capturingAgent();
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'test-api-key-123',
      enableOtel: true,
      otelExporterEndpoint: 'https://otel.example.com',
      otelResourceAttributes: { 'deployment.environment': 'test' },
      enableLogfire: true,
      logfireServiceName: 'svc',
    });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), agent,
    );
    const telemetry = components.registry.telemetryHandler;
    expect(telemetry).toBeInstanceOf(CompositeAgentHandler);
    const composite = telemetry as CompositeAgentHandler;
    /* The initializer already started the fan-out: the two exporter sinks
       start in their disabled state (no SDK/logfire client injection), the
       agent sink starts, nothing failed. */
    expect(composite.isStarted).toBe(true);
    expect(composite.getFailedHandlers()).toEqual([]);
    await components.registry.redisHandler?.close().catch(() => {});
  });

  it('wraps an agent-only setup in the composite with no enricher (reference flow)', async () => {
    /* The reference initialize_agent_integrations always builds the
       composite when any telemetry is on, so an agent-only setup still
       routes through the muting filter seam. */
    const { agent } = capturingAgent();
    const config = SecurityConfigSchema.parse({ enableAgent: true, agentApiKey: 'test-api-key-123' });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), agent,
    );
    const composite = components.registry.telemetryHandler as CompositeAgentHandler;
    expect(components.registry.telemetryHandler).toBeInstanceOf(CompositeAgentHandler);
    expect(components.registry.enricher).toBeNull();
    expect(components.registry.eventFilter.isEventAllowed('ip_blocked')).toBe(true);
    await composite.start();
    expect(composite.isStarted).toBe(true);
  });

  it('reports a failing telemetry start through the agent_init hook', async () => {
    const onError = vi.fn();
    const failing = {
      async sendEvent() {},
      async sendMetric() {},
      async start() {},
      async stop() {},
      async flushBuffer() {},
      async getDynamicRules() { return null; },
      async healthCheck() { return true; },
      async initializeRedis() {},
    } as unknown as AgentHandlerProtocol;
    const explodingGeo = {
      isInitialized: true,
      initialize: async () => {},
      initializeRedis: async () => {},
      initializeAgent: async () => { throw new Error('geo agent wiring exploded'); },
      getCountry: () => null,
    };
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'test-api-key-123',
      onError,
    });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), failing, explodingGeo as never,
    );
    expect(onError).toHaveBeenCalledWith('agent_init', expect.any(Error), {});
    await (components.registry.telemetryHandler as CompositeAgentHandler).stop();
  });

  it('answers null telemetry with no agent and no sink tier', async () => {
    const config = SecurityConfigSchema.parse({});
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), null,
    );
    expect(components.registry.telemetryHandler).toBeNull();
    expect(components.registry.enricher).toBeNull();
  });

  it('builds the composite without an agent when a sink tier alone is on', async () => {
    const config = SecurityConfigSchema.parse({ enableOtel: true });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), null,
    );
    expect(components.registry.telemetryHandler).toBeInstanceOf(CompositeAgentHandler);
    // The bus holds the composite and stays inert when the sink is disabled.
    await components.eventBus.sendMiddlewareEvent('test', createMockRequest(), 'a', 'r');
  });

  it('mutes muted event types and passes others through', async () => {
    const { agent, events } = capturingAgent();
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'test-api-key-123',
      mutedEventTypes: ['security_headers_applied'],
      mutedMetricTypes: ['response_time'],
    });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), agent,
    );
    const telemetry = components.registry.telemetryHandler as CompositeAgentHandler;
    await telemetry.sendEvent({ timestamp: new Date(), eventType: 'security_headers_applied' });
    await telemetry.sendEvent({ timestamp: new Date(), eventType: 'ip_blocked' });
    expect(events.map((e) => e['eventType'])).toEqual(['ip_blocked']);
    expect(components.registry.eventFilter.isMetricAllowed('response_time')).toBe(false);
    expect(components.registry.eventFilter.isMetricAllowed('error_rate')).toBe(true);
  });

  it('attaches the enricher under enableEnrichment', async () => {
    const { agent, events } = capturingAgent();
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'test-api-key-123',
      agentProjectId: 'proj-9',
      enableEnrichment: true,
    });
    const components = await initializeSecurityMiddleware(
      config, defaultLogger, createMockResponseFactory(), agent,
    );
    expect(components.registry.enricher).not.toBeNull();
    const telemetry = components.registry.telemetryHandler as CompositeAgentHandler;
    await telemetry.sendEvent({ timestamp: new Date(), eventType: 'ip_blocked', metadata: {} });
    const metadata = (events[0]?.['metadata'] ?? {}) as Record<string, unknown>;
    expect(metadata['guard.project_id']).toBe('proj-9');
  });

  it('suppresses a muted check log name in the log_activity on_block dispatch', async () => {
    const { logActivity } = await import('../../src/utils.js');
    const { fireBlockHook } = await import('../../src/core/block-events.js');
    const mod = await import('../../src/core/block-events.js');
    const spy = vi.spyOn(mod, 'fireBlockHook');
    const config = SecurityConfigSchema.parse({ mutedCheckLogs: ['user_agent'] });
    const request = createMockRequest();
    logActivity(request, defaultLogger, 'suspicious', 'blocked', true, 'trigger', 'WARNING', {
      checkName: 'user_agent',
      onBlock: () => {},
      mutedCheckLogs: new Set(config.mutedCheckLogs),
    });
    expect(spy).not.toHaveBeenCalled();
    logActivity(request, defaultLogger, 'suspicious', 'blocked', true, 'trigger', 'WARNING', {
      checkName: 'ip_security',
      onBlock: () => {},
      mutedCheckLogs: new Set(config.mutedCheckLogs),
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    void fireBlockHook;
  });
});
