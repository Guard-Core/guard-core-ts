import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { RouteConfig } from '../../models/route-config.js';
import type { GuardRequest } from '../../protocols/request.js';

export class RouteConfigResolver {
  private guardDecorator: unknown = null;

  constructor(
    private readonly config: ResolvedSecurityConfig,
  ) {}

  setGuardDecorator(decorator: unknown): void {
    this.guardDecorator = decorator;
  }

  /* Marks request.state.guard_route_unresolved when a routed request's config
     lookup fails (missing getRouteConfig on the decorator, a thrown lookup, or
     a routeId the decorator does not know), the data behind
     route_resolution_strict in the reference's RouteConfigCheck. A request with
     no routeId at all is an unrouted request, not a resolution failure. */
  getRouteConfig(request: GuardRequest): RouteConfig | null {
    const decorator = this.guardDecorator ?? request.state.guardDecorator;
    if (!decorator) return null;

    const routeId = request.state.guardRouteId;
    if (!routeId) return null;

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
