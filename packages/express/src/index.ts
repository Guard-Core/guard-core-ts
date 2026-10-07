export { createSecurityMiddleware } from './middleware.js';
export { resolveAgentHandler } from './agent.js';
export type { ResolvedAgentHandler } from './agent.js';
export type { SecurityMiddlewareOptions } from './middleware.js';
export { configureCors } from './cors.js';
export { guardBodyParser, guardUrlEncodedParser } from './body-parser.js';
export { ExpressGuardRequest, ExpressGuardResponse, ExpressResponseFactory, sendGuardResponse } from './adapters.js';
export { resolveExpressRouteId, resolveExpressEndpointId } from './route-id.js';
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
  SecurityMiddlewareComponents,
  HandlerRegistry,
  PathRouteConfigEntry,
} from '@guardcore/core';
