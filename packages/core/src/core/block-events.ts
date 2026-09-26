/* The TS port of guard_core/_utils/block_events.py and the invoke_error_hook half
   of guard_core/_utils/agent_events.py: the on_block hook (fired exactly once per
   blocked request with a redacted payload) and the on_error hook (best-effort
   callback for middleware/agent step failures). Both hooks are fail-safe: a hook
   that throws is caught and logged, never propagated. */

import type { GuardRequest } from '../protocols/request.js';
import type { Logger } from '../models/logger.js';

import { redactUrlForDisplay } from '../redaction.js';
import { UNKNOWN_CLIENT_IDENTITY } from './client-identity.js';

/* The twin of ON_BLOCK_EXCLUDED_CHECK_NAMES: application-authored checks the app
   already knows about, plus the HTTPS-enforcement redirect (a redirect is not a
   block). */
export const ON_BLOCK_EXCLUDED_CHECK_NAMES: ReadonlySet<string> = new Set([
  'custom_request', 'custom_validators', 'https_enforcement',
]);

export type OnBlockHook = (
  request: GuardRequest,
  payload: Record<string, unknown>,
) => unknown;

export type OnErrorHook = (
  stage: string,
  error: unknown,
  context: Record<string, unknown>,
) => void;

export async function invokeBlockHook(
  hook: OnBlockHook | null | undefined,
  request: GuardRequest,
  payload: Record<string, unknown>,
  logger: Logger,
): Promise<void> {
  if (!hook) return;
  try {
    const result = hook(request, payload);
    if (result instanceof Promise) await result;
  } catch (hookError) {
    logger.error(`on_block hook raised: ${hookError}`);
  }
}

/* The twin of build_block_payload: status_code is null on the passive-mode path
   (no response is ever sent); path is redacted with the configured sensitive sets. */
export function buildBlockPayload(
  request: GuardRequest,
  checkName: string,
  reason: string,
  triggerInfo: string,
  passiveMode: boolean,
  statusCode: number | null,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): Record<string, unknown> {
  const state = request.state as Record<string, unknown>;
  const cachedIp = state['client_ip'];
  const clientIp = typeof cachedIp === 'string' && cachedIp
    ? cachedIp
    : (request.clientHost ?? UNKNOWN_CLIENT_IDENTITY);

  return {
    check_name: checkName,
    reason,
    trigger_info: triggerInfo,
    passive_mode: passiveMode,
    client_ip: clientIp,
    path: redactUrlForDisplay(
      request.urlPath, sensitiveParams, sensitiveBodyFields, sensitiveHeaders,
    ),
    method: request.method,
    status_code: statusCode,
  };
}

export async function fireBlockHook(
  hook: OnBlockHook | null | undefined,
  request: GuardRequest,
  logger: Logger,
  checkName: string,
  reason: string,
  triggerInfo: string,
  passiveMode: boolean,
  statusCode: number | null,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): Promise<void> {
  if (!hook || ON_BLOCK_EXCLUDED_CHECK_NAMES.has(checkName)) return;
  const payload = buildBlockPayload(
    request, checkName, reason, triggerInfo, passiveMode, statusCode,
    sensitiveParams, sensitiveBodyFields, sensitiveHeaders,
  );
  await invokeBlockHook(hook, request, payload, logger);
}

/* The twin of invoke_error_hook: stages are 'agent_init', 'geoip',
   'transport_send', 'encryption'. */
export function invokeErrorHook(
  hook: OnErrorHook | null | undefined,
  stage: string,
  error: unknown,
  context: Record<string, unknown>,
  logger: Logger,
): void {
  if (!hook) return;
  try {
    hook(stage, error, context);
  } catch (hookError) {
    logger.error(`on_error hook raised while handling '${stage}': ${hookError}`);
  }
}
