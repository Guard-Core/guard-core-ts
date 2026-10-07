/* W3 wiring: copy the decorated handler's `_guardRouteId` onto the guard
   request state so the core RouteConfigResolver can resolve decorator route
   configs at request time (mirrors fastapi-guard's _populate_guard_state,
   which stamps guard_route_id from the matched Starlette endpoint).

   The NestJS adapter runs on Express under the hood: Nest registers its
   routes through the host express router, so the same lazy stack scan
   applies. When the guard middleware runs, Nest routing has not happened
   (`req.route` is undefined), so the app router stack is scanned for the
   first matching route layer whose terminal handler carries the decorator
   stamp. Routes without a decorator stamp fall through to the module's
   path-keyed `routeConfigs` surface. */

import type { Request } from 'express';

interface RouteStackEntry {
  handle: unknown;
}

interface ExpressRouteLike {
  stack?: RouteStackEntry[];
  methods?: Record<string, boolean | undefined>;
}

interface ExpressLayerLike {
  route?: ExpressRouteLike;
  handle?: unknown;
  /* router@2 (express 5) exposes prebuilt non-mutating matchers; express 4
     layers only have the stateful match() (its params/path writes are
     overwritten by the real dispatch that follows, so a probe is safe). */
  matchers?: Array<(path: string) => unknown>;
  match?(path: string): boolean;
}

interface ExpressRouterLike {
  stack?: ExpressLayerLike[];
}

function routeIdOf(handle: unknown): string | null {
  const id = (handle as Record<string, unknown> | null | undefined)?.['_guardRouteId'];
  return typeof id === 'string' ? id : null;
}

/* The terminal handler of a matched route: scan the route stack from the end
   so the endpoint handler wins over guard middleware in the same stack. */
function routeIdFromRoute(route: ExpressRouteLike, method: string): string | null {
  const stack = route.stack;
  if (!stack || stack.length === 0) return null;
  if (route.methods && !route.methods['_all'] && !route.methods[method]) return null;
  for (let i = stack.length - 1; i >= 0; i--) {
    const id = routeIdOf(stack[i]?.handle);
    if (id !== null) return id;
  }
  return null;
}

function appRouterOf(req: Request): (ExpressRouterLike & { stack: ExpressLayerLike[] }) | null {
  const app = req.app as unknown as Record<string, unknown> | undefined;
  if (!app) return null;
  /* express 4 stores the router as _router; express 5 exposes `router`. */
  const candidate = (app['_router'] ?? app['router']) as ExpressRouterLike | undefined;
  if (!candidate || !Array.isArray(candidate.stack)) return null;
  /* The Array.isArray check above is the validation; the intersection type
     records it so the scan below needs no second fallback. */
  return candidate as ExpressRouterLike & { stack: ExpressLayerLike[] };
}

function layerMatches(layer: ExpressLayerLike, path: string): boolean {
  if (Array.isArray(layer.matchers)) {
    try {
      return layer.matchers.some((matcher) => matcher(path) !== false);
    } catch {
      return false;
    }
  }
  if (typeof layer.match === 'function') {
    try {
      return layer.match(path) === true;
    } catch {
      return false;
    }
  }
  return false;
}

export function resolveNestRouteId(req: Request): string | null {
  const method = req.method.toLowerCase();

  /* Route-level mounting: Express matched the route before running us. */
  const directRoute = (req as unknown as { route?: ExpressRouteLike }).route;
  if (directRoute) {
    const id = routeIdFromRoute(directRoute, method);
    if (id !== null) return id;
  }

  /* App-level mounting: scan the router stack in registration order and take
     the FIRST matching route layer, like Express dispatch does. */
  const router = appRouterOf(req);
  if (router === null) return null;

  const path = req.path ?? req.url.split('?')[0];
  for (const layer of router.stack) {
    const route = layer.route;
    if (!route) continue;
    if (!layerMatches(layer, path)) continue;
    const id = routeIdFromRoute(route, method);
    if (id !== null) return id;
  }
  return null;
}

/** Endpoint display id for behavioral processing (the guard_endpoint_id
 *  twin): the matched handler's function name when available. */
export function resolveNestEndpointId(req: Request): string | null {
  let route = (req as unknown as { route?: ExpressRouteLike }).route;
  if (!route) {
    const path = req.path ?? req.url.split('?')[0];
    route = appRouterOf(req)?.stack?.find((layer) => layer.route && layerMatches(layer, path))?.route;
  }
  if (!route?.stack) return null;
  for (let i = route.stack.length - 1; i >= 0; i--) {
    const name = (route.stack[i]?.handle as { name?: string } | null | undefined)?.name;
    if (name) return name;
  }
  return null;
}
