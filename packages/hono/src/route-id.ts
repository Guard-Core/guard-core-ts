/* W3 wiring: copy the decorated handler's `_guardRouteId` onto the guard
   request state so the core RouteConfigResolver can resolve decorator route
   configs at request time (mirrors fastapi-guard's _populate_guard_state).

   Hono composes [middleware..., handler] per request before dispatch and
   exposes the composed routes on `c.req.matchedRoutes` (each entry carries
   `{ handler, method, path }`). The terminal entry is the endpoint handler;
   scanning from the end finds the decorated handler even when guard
   middleware sits in the same chain. */

import type { Context } from 'hono';

interface MatchedRouteLike {
  handler?: unknown;
  method?: string;
  path?: string;
}

export function resolveHonoRouteId(c: Context): string | null {
  const matched = resolveMatchedRoutes(c);
  if (matched === null) return null;
  for (let i = matched.length - 1; i >= 0; i--) {
    const id = routeIdOf(matched[i]);
    if (id !== null) return id;
  }
  return null;
}

/** Endpoint display id for behavioral processing (the guard_endpoint_id
 *  twin): the matched handler's function name when available. */
export function resolveHonoEndpointId(c: Context): string | null {
  const matched = resolveMatchedRoutes(c);
  if (matched === null || matched.length === 0) return null;
  for (let i = matched.length - 1; i >= 0; i--) {
    const name = (matched[i]?.handler as { name?: string } | null | undefined)?.name;
    if (name) return name;
  }
  return null;
}

function routeIdOf(route: MatchedRouteLike | undefined): string | null {
  const id = (route?.handler as Record<string, unknown> | null | undefined)?.['_guardRouteId'];
  return typeof id === 'string' ? id : null;
}

function resolveMatchedRoutes(c: Context): MatchedRouteLike[] | null {
  /* Feature-detected: real HonoRequest instances expose the matched routes;
     plain mocks (tests, non-Hono dispatch) do not. */
  const req = c?.req as unknown as { matchedRoutes?: unknown } | undefined;
  if (req === undefined || req === null || !Array.isArray(req.matchedRoutes)) return null;
  return req.matchedRoutes as MatchedRouteLike[];
}
