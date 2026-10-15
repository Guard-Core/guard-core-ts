import { canonicalizeIp } from '../src/handlers/ip-ban.js';
import { SecurityConfigSchema } from '../src/models/config.js';
import type { ResolvedSecurityConfig } from '../src/models/config.js';
import { defaultLogger } from '../src/models/logger.js';
import type { Logger } from '../src/models/logger.js';
import type { GuardMiddlewareProtocol } from '../src/protocols/middleware.js';
import type { GuardRequest, GuardRequestState } from '../src/protocols/request.js';
import type { GuardResponse, GuardResponseFactory } from '../src/protocols/response.js';

export function createTestConfig(overrides: Record<string, unknown> = {}): ResolvedSecurityConfig {
  return SecurityConfigSchema.parse(overrides);
}

/* The mock models a request after RouteConfigCheck ran: state.client_ip holds
   the resolved identity (the canonical connecting address). Pass an explicit
   state to model a request the check has not seen yet. */
export function createMockRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
  const clientHost = overrides.clientHost === undefined ? '1.2.3.4' : overrides.clientHost;
  return {
    urlPath: '/api/test',
    urlScheme: 'https',
    urlFull: 'https://example.com/api/test',
    urlReplaceScheme: (s: string) => `${s}://example.com/api/test`,
    method: 'GET',
    clientHost,
    headers: { 'user-agent': 'TestAgent/1.0' },
    queryParams: {},
    body: async () => new Uint8Array(0),
    state: (clientHost ? { client_ip: canonicalizeIp(clientHost) } : {}) as GuardRequestState,
    scope: {},
    ...overrides,
  };
}

export function createMockResponse(statusCode: number, body = ''): GuardResponse {
  const encoder = new TextEncoder();
  const encoded = body ? encoder.encode(body) : null;
  const headers: Record<string, string> = {};
  return {
    statusCode,
    headers,
    setHeader(name: string, value: string) { headers[name] = value; },
    body: encoded,
    bodyText: body || null,
  };
}

export function createMockResponseFactory(): GuardResponseFactory {
  return {
    createResponse(content: string, statusCode: number): GuardResponse {
      return createMockResponse(statusCode, content);
    },
    createRedirectResponse(url: string, statusCode: number): GuardResponse {
      const resp = createMockResponse(statusCode, '');
      resp.setHeader('location', url);
      return resp;
    },
  };
}

export function createMockMiddleware(
  configOverrides: Record<string, unknown> = {},
): GuardMiddlewareProtocol {
  const config = createTestConfig(configOverrides);
  const eventBus = {
    async sendMiddlewareEvent() {},
    async sendHttpsViolationEvent() {},
    async sendCloudDetectionEvents() {},
  };
  const routeResolver = {
    getRouteConfig: () => null,
    shouldBypassCheck: () => false,
    getCloudProvidersToCheck: () => null,
    setGuardDecorator() {},
  };
  const responseFactory = createMockResponseFactory();
  const errorResponseFactory = {
    async createErrorResponse(statusCode: number, message: string) {
      return createMockResponse(statusCode, message);
    },
    async createHttpsRedirect(request: GuardRequest) {
      const resp = createMockResponse(301, '');
      resp.setHeader('location', request.urlReplaceScheme('https'));
      return resp;
    },
    async applySecurityHeaders(response: GuardResponse) { return response; },
    async applyCorsHeaders(response: GuardResponse) { return response; },
    async applyModifier(response: GuardResponse) { return response; },
    async processResponse(_req: GuardRequest, response: GuardResponse) { return response; },
  };

  return {
    config,
    logger: defaultLogger,
    lastCloudIpRefresh: 0,
    suspiciousRequestCounts: new Map(),
    eventBus,
    routeResolver,
    responseFactory: errorResponseFactory,
    rateLimitHandler: {},
    agentHandler: null,
    geoIpHandler: null,
    guardResponseFactory: responseFactory,
    async createErrorResponse(statusCode: number, message: string) {
      return createMockResponse(statusCode, message);
    },
    async refreshCloudIpRanges() {},
  } as unknown as GuardMiddlewareProtocol;
}
