import { describe, it, expect, vi } from 'vitest';
import { resolveAgentHandler } from '../src/agent.js';
import { SecurityConfigSchema } from '@guardcore/core';
import { defaultLogger } from '@guardcore/core';
import type { AgentHandlerProtocol } from '@guardcore/core';

const injected = {
  async sendEvent() {},
  async sendMetric() {},
  async start() {},
  async stop() {},
  async flushBuffer() {},
  async getDynamicRules() { return null; },
  async healthCheck() { return true; },
  async initializeRedis() {},
} as unknown as AgentHandlerProtocol;

vi.mock('guardagent', () => {
  class GuardAgent {
    readonly config: unknown;
    constructor(config: unknown) {
      this.config = config;
      if ((config as { apiKey?: string }).apiKey === 'short') {
        throw new Error('Invalid agent configuration: apiKey must be at least 10 characters long');
      }
    }
  }
  return { GuardAgent };
});

describe('resolveAgentHandler (the agent enablement bridge)', () => {
  it('passes an injected handler through untouched', async () => {
    const config = SecurityConfigSchema.parse({ enableAgent: true, agentApiKey: 'test-api-key-123' });
    const result = await resolveAgentHandler(config, injected, defaultLogger);
    expect(result.agentHandler).toBe(injected);
    expect(result.degraded).toBe(false);
  });

  it('answers null without construction when the agent is disabled', async () => {
    const config = SecurityConfigSchema.parse({});
    const result = await resolveAgentHandler(config, null, defaultLogger);
    expect(result.agentHandler).toBeNull();
    expect(result.degraded).toBe(false);
  });

  it('builds the GuardAgent from the config surface when enabled', async () => {
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'test-api-key-123',
      agentProjectId: 'proj-1',
      agentStrict: true,
    });
    const result = await resolveAgentHandler(config, null, defaultLogger);
    expect(result.agentHandler).not.toBeNull();
    expect(result.degraded).toBe(false);
  });

  it('stays agent-off when the seam answers null', async () => {
    // The schema guarantees an api key when enableAgent is on; the defensive
    // seam arm still degrades instead of constructing without one.
    const unvalidated = { ...SecurityConfigSchema.parse({}), enableAgent: true, agentApiKey: null };
    const result = await resolveAgentHandler(unvalidated as unknown as Parameters<typeof resolveAgentHandler>[0], null, defaultLogger);
    expect(result.agentHandler).toBeNull();
    expect(result.degraded).toBe(false);
  });

  it('degrades to agent-off on a construction failure', async () => {
    const config = SecurityConfigSchema.parse({ enableAgent: true, agentApiKey: 'short' });
    const result = await resolveAgentHandler(config, null, defaultLogger);
    expect(result.agentHandler).toBeNull();
    expect(result.degraded).toBe(true);
  });

  it('raises on a construction failure under agentStrict', async () => {
    const config = SecurityConfigSchema.parse({
      enableAgent: true,
      agentApiKey: 'short',
      agentStrict: true,
    });
    await expect(resolveAgentHandler(config, null, defaultLogger)).rejects.toThrow('apiKey must be at least 10 characters long');
  });
});
