export { createGuardMiddleware } from './middleware.js';
export type { GuardMiddlewareOptions } from './middleware.js';
export { configureCors } from './cors.js';
export { HonoGuardRequest, HonoGuardResponse, HonoResponseFactory } from './adapters.js';
export { resolveHonoRouteId, resolveHonoEndpointId } from './route-id.js';
export { attachWebSocketGuard, NodeUpgradeGuardRequest } from './websocket.js';
export type { WebSocketGuardOptions } from './websocket.js';

export {
  SecurityConfigSchema,
  BaseSecurityDecorator,
  SecurityDecorator,
  RouteConfig,
  BehaviorRule,
  defaultLogger,
} from '@guardcore/core';

export type {
  SecurityConfig,
  ResolvedSecurityConfig,
  GuardRequest,
  GuardResponse,
  Logger,
  PathRouteConfigEntry,
} from '@guardcore/core';
