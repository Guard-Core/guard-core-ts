export { guardPlugin } from './plugin.js';
export type { GuardPluginOptions } from './plugin.js';
export { configureCors } from './cors.js';
export { FastifyGuardRequest, FastifyGuardResponse, FastifyResponseFactory } from './adapters.js';

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
