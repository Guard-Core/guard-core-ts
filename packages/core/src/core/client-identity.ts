/* The TS twin of UNKNOWN_CLIENT_IDENTITY in guard_core/_utils/ip_extraction.py:
   the identity recorded for a request whose client IP cannot be determined. */
export const UNKNOWN_CLIENT_IDENTITY = 'unknown';

/* The TS twin of _canonicalize_ip for block-payload purposes: the reference
   canonicalizes IPv4-mapped and scoped addresses; the TS pipeline caches the
   resolved client IP on request.state.client_ip during route resolution, so this
   falls back to the raw host and the unknown identity. */
export function canonicalizeIpForPayload(clientHost: string | null | undefined): string {
  return clientHost ?? UNKNOWN_CLIENT_IDENTITY;
}
