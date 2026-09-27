export { GuardModule, SecurityMiddlewareNest, GUARD_MIDDLEWARE_TOKEN } from './guard-module.js';
export type { GuardModuleOptions } from './guard-module.js';
export { NestGuardRequest, NestGuardResponse, NestResponseFactory } from './adapters.js';

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
