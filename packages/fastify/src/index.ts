export { guardPlugin } from './plugin.js';
export type { GuardPluginOptions, GuardSurface } from './plugin.js';
export { configureCors } from './cors.js';
export { FastifyGuardRequest, FastifyGuardResponse, FastifyResponseFactory } from './adapters.js';
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

export { resolveAgentHandler } from './agent.js';
export type { ResolvedAgentHandler } from './agent.js';