/* WebSocket upgrade guard, the TS port of the reference behavior in
   fastapi-guard/guard/websocket.py (_run_websocket_checks + WS_CLOSE_*).

   The same guard checks the HTTP pipeline applies run on a WebSocket
   upgrade request, before the handshake completes:

   1. client IP extraction (trusted-proxy aware); an unknown identity in
      fail-secure mode rejects (close 1008 "Client address could not be
      determined")
   2. IP ban check (Redis failures honor redisFailOpen / failSecure like the
      reference's _guarded_redis_call)
   3. IP allow check (blacklist / whitelist / country)
   4. IP rate limit on the "ws" endpoint path (skipped for whitelisted
      clients, like the reference)
   5. penetration detection via a SuspiciousActivityCheck pipeline sharing
      the middleware's suspicious-request counts; a check that fails with an
      internal error rejects with close 1013 "Security check failed", a
      detected threat with close 1008 "Suspicious activity detected"

   A rejected upgrade maps to an HTTP 403 handshake rejection (the ASGI
   behavior of a Starlette WebSocketException raised pre-accept); the close
   code/reason ride the verdict for adapters that can close with WS codes. */

import type { GuardRequest } from '../protocols/request.js';
import type { ResolvedSecurityConfig } from '../models/config.js';
import type { Logger } from '../models/logger.js';
import type { SecurityMiddlewareComponents } from '../middleware-support.js';
import type { RateLimitManager } from '../handlers/rate-limit.js';
import { UNKNOWN_CLIENT_IDENTITY } from './client-identity.js';
import { extractClientIp, isIpAllowed } from '../utils.js';
import { SecurityCheckPipeline } from './checks/pipeline.js';
import { SuspiciousActivityCheck } from './checks/implementations/suspicious-activity.js';
import { GuardRedisError } from '../errors.js';

export const WS_CLOSE_POLICY_VIOLATION = 1008;
export const WS_CLOSE_TRY_AGAIN_LATER = 1013;

export interface WebSocketCloseReason {
  code: number;
  reason: string;
}

export const WS_CLOSE_IP_BANNED: WebSocketCloseReason = { code: WS_CLOSE_POLICY_VIOLATION, reason: 'IP banned' };
export const WS_CLOSE_IP_NOT_ALLOWED: WebSocketCloseReason = { code: WS_CLOSE_POLICY_VIOLATION, reason: 'IP not allowed' };
export const WS_CLOSE_RATE_LIMIT_EXCEEDED: WebSocketCloseReason = { code: WS_CLOSE_POLICY_VIOLATION, reason: 'Rate limit exceeded' };
export const WS_CLOSE_CLIENT_ADDRESS_UNKNOWN: WebSocketCloseReason = { code: WS_CLOSE_POLICY_VIOLATION, reason: 'Client address could not be determined' };
export const WS_CLOSE_SECURITY_CHECK_FAILED: WebSocketCloseReason = { code: WS_CLOSE_TRY_AGAIN_LATER, reason: 'Security check failed' };
export const WS_CLOSE_SUSPICIOUS_ACTIVITY: WebSocketCloseReason = { code: WS_CLOSE_POLICY_VIOLATION, reason: 'Suspicious activity detected' };

export type WebSocketGuardVerdict =
  | { allowed: true; clientIp: string }
  | { allowed: false; close: WebSocketCloseReason; httpStatus: 403; httpReason: string };

export async function guardWebSocketUpgrade(
  request: GuardRequest,
  components: SecurityMiddlewareComponents,
): Promise<WebSocketGuardVerdict> {
  const config = components.middlewareProtocol.config;
  const logger = components.middlewareProtocol.logger;

  const clientIp = await extractClientIp(
    request, config, components.middlewareProtocol.agentHandler,
  );
  (request.state as Record<string, unknown>)['clientIp'] = clientIp;

  if (clientIp === UNKNOWN_CLIENT_IDENTITY && config.failSecure) {
    return reject(WS_CLOSE_CLIENT_ADDRESS_UNKNOWN);
  }

  /* Ban check under the reference's _guarded_redis_call semantics. */
  let isBanned = false;
  if (components.registry.ipBanHandler) {
    try {
      isBanned = await components.registry.ipBanHandler.isIpBanned(clientIp);
    } catch (e) {
      if (e instanceof GuardRedisError && config.redisFailOpen) {
        logger.warn('Skipping ip_ban check: Redis unavailable, failing open (redisFailOpen=true)');
        isBanned = false;
      } else if (config.failSecure) {
        logger.warn('Blocking websocket handshake due to redis error in fail-secure mode');
        return reject(WS_CLOSE_SECURITY_CHECK_FAILED);
      } else {
        logger.error(`Error in ip ban check: ${e}`);
        isBanned = false;
      }
    }
  }
  if (isBanned) return reject(WS_CLOSE_IP_BANNED);

  if (!(await isIpAllowed(clientIp, config, components.registry.geoIpHandler))) {
    return reject(WS_CLOSE_IP_NOT_ALLOWED);
  }

  const isWhitelisted = clientIp !== UNKNOWN_CLIENT_IDENTITY && (config.whitelist?.length ?? 0) > 0;
  request.state.isWhitelisted = isWhitelisted;

  if (clientIp !== UNKNOWN_CLIENT_IDENTITY && (config.whitelist?.length ?? 0) === 0) {
    const rateLimitHandler = components.middlewareProtocol.rateLimitHandler as RateLimitManager;
    const limited = await rateLimitHandler.checkRateLimit(
      request, clientIp,
      components.middlewareProtocol.createErrorResponse.bind(components.middlewareProtocol),
      'ws', config.rateLimit, config.rateLimitWindow,
    );
    if (limited !== null) return reject(WS_CLOSE_RATE_LIMIT_EXCEEDED);
  }

  return runPenetrationDetection(request, components, config);
}

async function runPenetrationDetection(
  request: GuardRequest,
  components: SecurityMiddlewareComponents,
  config: ResolvedSecurityConfig,
): Promise<WebSocketGuardVerdict> {
  if (!config.enablePenetrationDetection) return { allowed: true, clientIp: request.clientHost ?? '' };

  /* Path exclusions skip detection entirely, mirroring the HTTP pipeline
     where excluded paths pass through the bypass handler unchecked (the
     reference WS path sets guard_exclusion_scoped for the same effect). */
  if (await components.validator.isPathExcluded(request)) {
    (request.state as Record<string, unknown>)['guardExclusionScoped'] = true;
    return { allowed: true, clientIp: request.clientHost ?? '' };
  }

  const pipeline = new SecurityCheckPipeline(
    [new SuspiciousActivityCheck(
      components.middlewareProtocol,
      components.registry.susPatternsHandler,
      components.registry.ipBanHandler,
    )],
    components.middlewareProtocol.logger,
  );

  /* Check errors are handled inside the pipeline (fail-secure returns the
     500 sentinel; redisFailOpen skips the check); anything that still throws
     propagates to the adapter's fail-closed rejection. */
  const response = await pipeline.execute(request);
  if (response === null) return { allowed: true, clientIp: request.clientHost ?? '' };

  if (response.statusCode === 500) return reject(WS_CLOSE_SECURITY_CHECK_FAILED);
  return reject(WS_CLOSE_SUSPICIOUS_ACTIVITY);
}

function reject(close: WebSocketCloseReason): WebSocketGuardVerdict {
  return {
    allowed: false,
    close,
    httpStatus: 403,
    httpReason: `WebSocket upgrade rejected: ${close.reason} (ws close ${close.code})`,
  };
}
