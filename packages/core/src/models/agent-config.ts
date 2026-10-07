/**
 * The to_agent_config seam (guard_core/models.py SecurityConfig.
 * to_agent_config): builds the GuardAgent constructor input from the
 * SecurityConfig agent_* surface. Core never imports the guardagent package
 * (it is injected as a peer), so the shape is declared structurally and is
 * assignable to the agent's AgentConfigInput.
 *
 * Reference semantics (models.py:317-370): null when the agent is disabled
 * or has no API key; every None kwarg is filtered so the agent's own
 * defaults apply; on_error rides through; guard_core_version carries the
 * engine version.
 */

import type { ResolvedSecurityConfig } from './config.js';

/** Overflow behavior when the agent's in-memory buffer is full. */
export type SecurityBufferOverflowPolicy = 'drop' | 'block' | 'raise';

/** The (stage, error, context) failure callback shared with the agent. */
export type SecurityErrorHook = (
  stage: string,
  error: unknown,
  context: Record<string, unknown>,
) => void;

/**
 * Structural GuardAgent constructor input. Field docs live on the agent's
 * AgentConfig; only apiKey is required, every other field is optional so the
 * agent defaults apply where the SecurityConfig left them unset.
 */
export interface SecurityAgentConfigInput {
  apiKey: string;
  endpoint?: string;
  projectId?: string | null;
  bufferSize?: number;
  flushInterval?: number;
  dynamicRuleInterval?: number;
  statusInterval?: number;
  highWatermarkRatio?: number;
  maxConcurrentFlushes?: number;
  bufferOverflowPolicy?: SecurityBufferOverflowPolicy;
  enableMetrics?: boolean;
  enableEvents?: boolean;
  retryAttempts?: number;
  timeout?: number;
  backoffFactor?: number;
  sensitiveHeaders?: string[];
  maxPayloadSize?: number;
  guardVersion?: string | null;
  guardCoreVersion?: string | null;
  compressionEnabled?: boolean;
  compressionThreshold?: number;
  installId?: string | null;
  payloadSigningSecret?: string | null;
  projectEncryptionKey?: string | null;
  onError?: SecurityErrorHook;
}

export interface ToAgentConfigOptions {
  /** The guard-core engine version (the reference passes __version__). */
  guardCoreVersion?: string | null;
}

/**
 * The twin of SecurityConfig.to_agent_config: null when enableAgent is off
 * or agentApiKey is unset; otherwise the agent constructor input with every
 * unset tuning field omitted (the reference's None kwarg filter), so the
 * agent's own defaults apply.
 */
export function toAgentConfig(
  config: ResolvedSecurityConfig,
  options: ToAgentConfigOptions = {},
): SecurityAgentConfigInput | null {
  if (!config.enableAgent || !config.agentApiKey) {
    return null;
  }

  const kwargs: Record<string, unknown> = {
    apiKey: config.agentApiKey,
    endpoint: config.agentEndpoint,
    projectId: config.agentProjectId,
    bufferSize: config.agentBufferSize,
    flushInterval: config.agentFlushInterval,
    dynamicRuleInterval: config.dynamicRuleInterval,
    statusInterval: config.agentStatusInterval,
    highWatermarkRatio: config.agentHighWatermarkRatio,
    maxConcurrentFlushes: config.agentMaxConcurrentFlushes,
    bufferOverflowPolicy: config.agentBufferOverflowPolicy,
    enableEvents: config.agentEnableEvents,
    enableMetrics: config.agentEnableMetrics,
    timeout: config.agentTimeout,
    retryAttempts: config.agentRetryAttempts,
    backoffFactor: config.agentBackoffFactor,
    sensitiveHeaders: config.agentSensitiveHeaders,
    maxPayloadSize: config.agentMaxPayloadSize,
    guardVersion: config.agentGuardVersion,
    guardCoreVersion: options.guardCoreVersion ?? null,
    compressionEnabled: config.agentCompressionEnabled,
    compressionThreshold: config.agentCompressionThreshold,
    installId: config.agentInstallId,
    payloadSigningSecret: config.agentPayloadSigningSecret,
    projectEncryptionKey: config.agentProjectEncryptionKey,
    onError: config.onError,
  };

  /* The reference None-kwarg filter, verbatim: every unset (null or
     undefined) entry is dropped so the agent's own defaults apply. The
     agent resolves project id, guard version, install id and the signing
     secret to null on their own, so dropping them here lands on the same
     resolved configuration. */
  const filtered: Record<string, unknown> = { apiKey: kwargs['apiKey'] };
  for (const [key, value] of Object.entries(kwargs)) {
    if (key === 'apiKey' || value === undefined || value === null) continue;
    filtered[key] = value;
  }
  return filtered as unknown as SecurityAgentConfigInput;
}
