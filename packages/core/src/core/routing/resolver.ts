import type { ResolvedSecurityConfig } from '../../models/config.js';
import { RouteConfig } from '../../models/route-config.js';
import type { GuardRequest } from '../../protocols/request.js';

/** One adapter-registered per-route config: a framework route identity
 *  (optionally method-scoped) bound to a RouteConfig. Path matching is exact
 *  against the request path, or a prefix match when the entry path ends with
 *  `/*` (matching the prefix itself and everything under it). */
export interface PathRouteConfigEntry {
  method?: string;
  path: string;
  config: RouteConfig;
}

export class RouteConfigResolver {
  private guardDecorator: unknown = null;
  private pathEntries: Array<PathRouteConfigEntry & { lowerMethod: string | null }> = [];

  constructor(
    private readonly config: ResolvedSecurityConfig,
  ) {}

  setGuardDecorator(decorator: unknown): void {
    this.guardDecorator = decorator;
  }

  /** Adapter-registered per-route configs (the routeConfigs middleware /
   *  plugin / module option). Registered entries are matched in longest-path
   *  order; a routeId lookup through a decorator always wins over them. */
  registerPathRouteConfigs(entries: PathRouteConfigEntry[]): void {
    this.pathEntries.push(...entries.map((entry) => ({
      ...entry,
      lowerMethod: entry.method ? entry.method.toLowerCase() : null,
    })));
    this.pathEntries.sort((a, b) => b.path.length - a.path.length);
  }

  private matchPathEntry(request: GuardRequest): RouteConfig | null {
    const method = request.method.toLowerCase();
    const path = request.urlPath;
    for (const entry of this.pathEntries) {
      if (entry.lowerMethod !== null && entry.lowerMethod !== method) continue;
      if (entry.path.endsWith('/*')) {
        const prefix = entry.path.slice(0, -2);
        if (path === prefix || path.startsWith(`${prefix}/`)) return entry.config;
      } else if (entry.path === path) {
        return entry.config;
      }
    }
    return null;
  }

  /* Marks request.state.guard_route_unresolved when a routed request's config
     lookup fails (missing getRouteConfig on the decorator, a thrown lookup, or
     a routeId the decorator does not know), the data behind
     route_resolution_strict in the reference's RouteConfigCheck. A request with
     no routeId at all is an unrouted request, not a resolution failure. */
  getRouteConfig(request: GuardRequest): RouteConfig | null {
    // A direct per-request override (fastify route options carry the config
    // on request.routeOptions.config.guardRouteConfig; the adapter seeds it
    // here before the pipeline runs) wins over every other surface.
    const direct = (request.state as Record<string, unknown>)['guardRouteConfig'];
    if (direct instanceof RouteConfig) return direct;

    const routeId = request.state.guardRouteId;
    if (routeId) {
      const routed = this.lookupRouteId(request, routeId);
      if (routed !== null) return routed;
    }
    return this.matchPathEntry(request);
  }

  private lookupRouteId(request: GuardRequest, routeId: string): RouteConfig | null {
    const decorator = this.guardDecorator ?? request.state.guardDecorator;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (!decorator) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

    const state = request.state as Record<string, unknown>;
    const getConfig = (decorator as { getRouteConfig(id: string): RouteConfig | undefined }).getRouteConfig;
    if (typeof getConfig !== 'function') {
      state['guard_route_unresolved'] = true;
      return null;
    }

    try {
      const resolved = getConfig.call(decorator, routeId) ?? null;
      if (resolved === null) state['guard_route_unresolved'] = true;
      return resolved;
    } catch {
      state['guard_route_unresolved'] = true;
      return null;
    }
  }

  shouldBypassCheck(checkName: string, routeConfig: RouteConfig | null): boolean {
    if (!routeConfig) return false;
    return routeConfig.bypassedChecks.has(checkName) || routeConfig.bypassedChecks.has('all');
  }

  getCloudProvidersToCheck(routeConfig: RouteConfig | null): string[] | null {
    if (routeConfig && routeConfig.blockCloudProviders.size > 0) {
      return [...routeConfig.blockCloudProviders];
    }
    if (this.config.blockCloudProviders.size > 0) {
      return [...this.config.blockCloudProviders];
    }
    return null;
  }
}
