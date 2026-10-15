import { canonicalizeIp } from '../ip-identity.js';

/* The TS twin of UNKNOWN_CLIENT_IDENTITY in guard_core/_utils/ip_extraction.py:
   the identity recorded for a request whose client IP cannot be determined. */
export const UNKNOWN_CLIENT_IDENTITY = 'unknown';

/* The canonical form of a raw connecting address (the reference
   _canonicalize_ip applied to client_host). */
export function canonicalizeIpForPayload(clientHost: string | null | undefined): string {
  return clientHost ? canonicalizeIp(clientHost) : UNKNOWN_CLIENT_IDENTITY;
}

/* The client IP the route-config check resolved and cached on
   request.state.client_ip (extractClientIp: canonical, trusted-proxy aware),
   or null before that check has run. The checks read this and never the raw
   connecting address, like the reference `getattr(request.state, "client_ip")`. */
export function resolvedClientIp(request: { readonly state: Record<string, unknown> }): string | null {
  const cached = request.state['client_ip'];
  return typeof cached === 'string' && cached ? cached : null;
}

/* The identity for logs, payloads and telemetry: the resolved client IP when
   cached, else the canonical connecting address, else "unknown" (the
   reference _extract_request_context fallback chain). */
export function requestClientIp(
  request: { readonly clientHost: string | null; readonly state: Record<string, unknown> },
): string {
  return resolvedClientIp(request) ?? canonicalizeIpForPayload(request.clientHost);
}
