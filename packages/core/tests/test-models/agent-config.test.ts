import { describe, it, expect } from 'vitest';
import { toAgentConfig } from '../../src/models/agent-config.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import type { ResolvedSecurityConfig } from '../../src/models/config.js';

function config(overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
  return SecurityConfigSchema.parse({ enableAgent: true, agentApiKey: 'test-api-key-123', ...overrides });
}

describe('toAgentConfig (the reference to_agent_config seam)', () => {
  it('answers null when the agent is disabled or has no api key', () => {
    expect(toAgentConfig(SecurityConfigSchema.parse({}))).toBeNull();
    expect(toAgentConfig(SecurityConfigSchema.parse({ agentApiKey: 'test-api-key-123' }))).toBeNull();
    // The defensive guard also covers an enabled config whose key was unset
    // after validation (the reference's own `not self.agent_api_key` arm).
    const unvalidated = { ...SecurityConfigSchema.parse({}), enableAgent: true, agentApiKey: null };
    expect(toAgentConfig(unvalidated as unknown as ResolvedSecurityConfig)).toBeNull();
  });

  it('maps the always-set surface with the reference defaults', () => {
    const result = toAgentConfig(config());
    expect(result).toMatchObject({
      apiKey: 'test-api-key-123',
      endpoint: 'https://api.guard-core.com',
      bufferSize: 100,
      flushInterval: 30,
      dynamicRuleInterval: 300,
      statusInterval: 300,
      enableEvents: true,
      enableMetrics: true,
      timeout: 30,
      retryAttempts: 3,
    });
  });

  it('strips unset tuning fields so the agent defaults apply (the None filter)', () => {
    const result = toAgentConfig(config()) as Record<string, unknown>;
    for (const key of [
      'highWatermarkRatio', 'maxConcurrentFlushes', 'bufferOverflowPolicy',
      'backoffFactor', 'sensitiveHeaders', 'maxPayloadSize',
      'compressionEnabled', 'compressionThreshold',
    ]) {
      expect(key in result).toBe(false);
    }
  });

  it('drops null-able identity fields when unset (the agent defaults them)', () => {
    const result = toAgentConfig(config()) as Record<string, unknown>;
    for (const key of ['projectId', 'guardVersion', 'guardCoreVersion', 'installId', 'payloadSigningSecret', 'projectEncryptionKey']) {
      expect(key in result).toBe(false);
    }
  });

  it('carries set tuning fields through', () => {
    const result = toAgentConfig(config({
      agentProjectId: 'proj-1',
      agentHighWatermarkRatio: 0.9,
      agentMaxConcurrentFlushes: 4,
      agentBufferOverflowPolicy: 'block',
      agentBackoffFactor: 2.5,
      agentSensitiveHeaders: ['x-secret'],
      agentMaxPayloadSize: 2048,
      agentCompressionEnabled: false,
      agentCompressionThreshold: 512,
      agentInstallId: 'install-7',
      agentPayloadSigningSecret: 'hmac-secret',
      agentProjectEncryptionKey: 'enc-key',
      agentGuardVersion: '1.2.3',
      agentStatusInterval: 120,
    }), { guardCoreVersion: '4.3.1' });
    expect(result).toMatchObject({
      projectId: 'proj-1',
      highWatermarkRatio: 0.9,
      maxConcurrentFlushes: 4,
      bufferOverflowPolicy: 'block',
      backoffFactor: 2.5,
      sensitiveHeaders: ['x-secret'],
      maxPayloadSize: 2048,
      compressionEnabled: false,
      compressionThreshold: 512,
      installId: 'install-7',
      payloadSigningSecret: 'hmac-secret',
      projectEncryptionKey: 'enc-key',
      guardVersion: '1.2.3',
      statusInterval: 120,
      guardCoreVersion: '4.3.1',
    });
  });

  it('passes the on_error hook through and stamps the engine version', () => {
    const onError = (): void => {};
    const result = toAgentConfig(config({ onError }), { guardCoreVersion: '9.9.9' });
    expect(result?.onError).toBe(onError);
    expect(result?.guardCoreVersion).toBe('9.9.9');
  });

  it('rejects an out-of-range status interval and overflow policy at the schema', () => {
    expect(() => SecurityConfigSchema.parse({ agentStatusInterval: 30 })).toThrow();
    expect(() => SecurityConfigSchema.parse({ agentStatusInterval: 90000 })).toThrow();
    expect(() => SecurityConfigSchema.parse({ agentBufferOverflowPolicy: 'explode' })).toThrow();
    expect(() => SecurityConfigSchema.parse({ agentHighWatermarkRatio: 1.5 })).toThrow();
  });

  it('keeps the reference dynamic-rule interval floor', () => {
    expect(() => SecurityConfigSchema.parse({ dynamicRuleInterval: 30 })).toThrow();
    expect(SecurityConfigSchema.parse({ dynamicRuleInterval: 60 }).dynamicRuleInterval).toBe(60);
  });
});
