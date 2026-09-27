import type { ResolvedSecurityConfig } from '../../models/config.js';
import type { Logger } from '../../models/logger.js';
import type { RouteConfig } from '../../models/route-config.js';
import type { AgentHandlerProtocol } from '../../protocols/agent.js';
import type { GuardRequest } from '../../protocols/request.js';
import type { GuardResponse, GuardResponseFactory } from '../../protocols/response.js';
import type { SecurityHeadersManager } from '../../handlers/security-headers.js';
import type { MetricsCollector } from '../events/metrics.js';
import type { BehavioralProcessor } from '../behavioral/processor.js';
import { configToRule } from '../behavioral/processor.js';
import type { BehaviorRule } from '../../models/behavior-rule.js';

export class ErrorResponseFactory {
  constructor(
    private readonly config: ResolvedSecurityConfig,
    private readonly logger: Logger,
    private readonly metricsCollector: MetricsCollector,
    private readonly guardResponseFactory: GuardResponseFactory,
    private readonly securityHeadersManager: SecurityHeadersManager,
    private readonly agentHandler: AgentHandlerProtocol | null = null,
  ) {}

  /* The behavioral processor, wired by initializeSecurityMiddleware so the
     ProcessResponse pass can drive the behavior rules without the adapter
     passing callbacks (the reference adapters pass process_behavioral_rules
     bound to their processor; the engine-owned wiring keeps the same
     semantics for engine-driven callers). */
  private behavioralProcessor: BehavioralProcessor | null = null;

  setBehavioralProcessor(processor: BehavioralProcessor): void {
    this.behavioralProcessor = processor;
  }

  async createErrorResponse(statusCode: number, defaultMessage: string): Promise<GuardResponse> {
    const message = this.config.customErrorResponses[statusCode] ?? defaultMessage;
    const response = this.guardResponseFactory.createResponse(message, statusCode);

    await this.applySecurityHeaders(response, undefined);
    return this.applyModifier(response);
  }

  async createHttpsRedirect(request: GuardRequest): Promise<GuardResponse> {
    const httpsUrl = request.urlReplaceScheme('https');
    const response = this.guardResponseFactory.createRedirectResponse(httpsUrl, 301);
    return this.applyModifier(response);
  }

  async applySecurityHeaders(response: GuardResponse, requestPath?: string): Promise<GuardResponse> {
    const headersConfig = this.config.securityHeaders;
    if (headersConfig && headersConfig.enabled) {
      const securityHeaders = await this.securityHeadersManager.getHeaders(requestPath ?? '/');
      for (const [name, value] of Object.entries(securityHeaders)) {
        response.setHeader(name, value);
      }
    }
    return response;
  }

  async applyCorsHeaders(response: GuardResponse, origin: string): Promise<GuardResponse> {
    const corsHeaders = this.securityHeadersManager.getCorsHeaders(origin);
    for (const [name, value] of Object.entries(corsHeaders)) {
      response.setHeader(name, value);
    }
    return response;
  }

  async applyModifier(response: GuardResponse): Promise<GuardResponse> {
    if (this.config.customResponseModifier) {
      return this.config.customResponseModifier(response);
    }
    return response;
  }

  async processResponse(
    request: GuardRequest,
    response: GuardResponse,
    responseTime: number,
    routeConfig: RouteConfig | null,
    processBehavioralRules?: (
      request: GuardRequest,
      response: GuardResponse,
      clientIp: string,
      routeConfig: RouteConfig,
    ) => Promise<void>,
  ): Promise<GuardResponse> {
    /* The behavioral phase of the reference process_response
       (guard_core/core/responses/factory.py): the route's return_pattern
       rules run first, then the global ones. Return rules never modify the
       response. With no explicit callback the engine-owned processor runs
       the route rules; the global rules always run through it when
       configured. */
    const clientIp = request.clientHost ?? 'unknown';
    if (routeConfig && routeConfig.behaviorRules.length > 0) {
      if (processBehavioralRules) {
        await processBehavioralRules(request, response, clientIp, routeConfig);
      } else if (this.behavioralProcessor) {
        await this.behavioralProcessor.processReturnRules(request, response, clientIp, routeConfig);
      }
    }

    if (this.config.globalBehaviorRules.length > 0 && this.behavioralProcessor) {
      const globalRules: BehaviorRule[] =
        this.config.globalBehaviorRules.map((cfg) => configToRule(cfg));
      await this.behavioralProcessor.processGlobalReturnRules(request, response, clientIp, globalRules);
    }

    await this.metricsCollector.collectRequestMetrics(request, responseTime, response.statusCode);

    await this.applySecurityHeaders(response, request.urlPath);

    const origin = request.headers['origin'];
    if (origin) {
      await this.applyCorsHeaders(response, origin);
    }

    return this.applyModifier(response);
  }
}
