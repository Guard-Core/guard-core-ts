/**
 * The adapter-side agent construction seam (fastapi-guard/guard/middleware.py
 * initialize block): when the config enables the agent and no handler was
 * injected, the GuardAgent builds from the SecurityConfig agent_* surface
 * through core's toAgentConfig. A construction failure degrades to
 * agent-off with the reference logging, or raises when agentStrict is set
 * (the reference agent_strict fail-closed switch).
 */

import type {
  AgentHandlerProtocol,
  Logger,
  ResolvedSecurityConfig,
} from '@guardcore/core';
import { toAgentConfig } from '@guardcore/core';
import { invokeErrorHook } from '@guardcore/core';

export interface ResolvedAgentHandler {
  agentHandler: AgentHandlerProtocol | null;
  /** True when the agent was enabled but construction failed and the
     middleware degraded to agent-off (the reference agent_degraded). */
  degraded: boolean;
}

export async function resolveAgentHandler(
  config: ResolvedSecurityConfig,
  injected: AgentHandlerProtocol | null | undefined,
  logger: Logger,
): Promise<ResolvedAgentHandler> {
  if (injected) return { agentHandler: injected, degraded: false };
  if (!config.enableAgent) return { agentHandler: null, degraded: false };

  try {
    const agentConfig = toAgentConfig(config);
    if (!agentConfig) return { agentHandler: null, degraded: false };

    const { GuardAgent } = await import('guardagent');
    const agent = new GuardAgent(agentConfig);
    logger.info('Guard Agent initialized successfully');
    return { agentHandler: agent as unknown as AgentHandlerProtocol, degraded: false };
  } catch (e) {
    invokeErrorHook(config.onError, 'agent_init', e, {}, logger);
    if (config.agentStrict) {
      throw e;
    }
    logger.error(`Failed to initialize Guard Agent: ${e}`);
    logger.warn('Continuing without agent functionality');
    return { agentHandler: null, degraded: true };
  }
}
