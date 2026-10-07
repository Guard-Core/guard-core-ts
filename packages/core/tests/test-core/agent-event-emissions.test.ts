import { describe, it, expect, vi } from 'vitest';
import { ContentPreprocessor } from '../../src/detection-engine/preprocessor.js';
import { PerformanceMonitor } from '../../src/detection-engine/monitor.js';
import { defaultLogger } from '../../src/models/logger.js';
import {
  createTestConfig,
  createMockRequest,
  createMockMiddleware,
} from '../helpers.js';
import type { AgentHandlerProtocol } from '../../src/protocols/agent.js';
import type { GuardRequest } from '../../src/protocols/request.js';

/* Decode-backend fault injection for the decoding_error tests: the mocked
   decoders consult this state so each test arms its own failure. */
const decodeFaults = { urlDecode: false, htmlDecode: false };

vi.mock('../../src/detection-engine/encoding-decoders.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/detection-engine/encoding-decoders.js')>();
  return {
    ...actual,
    pyUnquote: (value: string) => {
      if (decodeFaults.urlDecode) throw new Error('url decode exploded');
      return actual.pyUnquote(value);
    },
    htmlUnescape: (value: string) => {
      if (decodeFaults.htmlDecode) throw new Error('html decode exploded');
      return actual.htmlUnescape(value);
    },
  };
});

function capturingAgent(): { agent: AgentHandlerProtocol; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const agent = {
    async sendEvent(event: unknown) { events.push(event as Record<string, unknown>); },
    async sendMetric() {},
    async start() {},
    async stop() {},
    async flushBuffer() {},
    async getDynamicRules() { return null; },
    async healthCheck() { return true; },
    async initializeRedis() {},
  };
  return { agent: agent as unknown as AgentHandlerProtocol, events };
}

describe('decoding_error emission (preprocessor)', () => {
  it('emits decoding_error when the URL decode step throws', async () => {
    const { ContentPreprocessor } = await import('../../src/detection-engine/preprocessor.js');
    const { agent, events } = capturingAgent();
    const pre = new ContentPreprocessor();
    pre.setAgentHandler(agent, 'corr-1');
    decodeFaults.urlDecode = true;
    try {
      await pre.decodeCommonEncodings('select 1');
    } finally {
      decodeFaults.urlDecode = false;
    }
    const event = events.find((e) => e['eventType'] === 'decoding_error');
    expect(event).toBeDefined();
    expect(event?.['ipAddress']).toBe('system');
    expect(event?.['actionTaken']).toBe('decode_failed');
    expect(event?.['reason']).toBe('Failed to URL decode content');
    expect(event?.['metadata']).toMatchObject({
      component: 'ContentPreprocessor',
      correlationId: 'corr-1',
      errorType: 'url_decode',
    });
  });

  it('emits decoding_error when the HTML decode step throws', async () => {
    const { ContentPreprocessor } = await import('../../src/detection-engine/preprocessor.js');
    const { agent, events } = capturingAgent();
    const pre = new ContentPreprocessor();
    pre.setAgentHandler(agent);
    decodeFaults.htmlDecode = true;
    try {
      await pre.decodeCommonEncodings('select 1');
    } finally {
      decodeFaults.htmlDecode = false;
    }
    const event = events.find((e) => e['eventType'] === 'decoding_error');
    expect(event).toBeDefined();
    expect(event?.['metadata']).toMatchObject({ errorType: 'html_decode', correlationId: null });
  });

  it('stays silent without an agent handler and swallows dispatch failures', async () => {
    const pre = new ContentPreprocessor();
    // No agent handler: the decode-error path resolves without dispatching.
    decodeFaults.urlDecode = true;
    try {
      await pre.decodeCommonEncodings('select 1');
    } finally {
      decodeFaults.urlDecode = false;
    }

    const throwingAgent = {
      async sendEvent() { throw new Error('dispatch down'); },
    } as unknown as AgentHandlerProtocol;
    pre.setAgentHandler(throwingAgent);
    await expect(pre.decodeCommonEncodings('select 1')).resolves.toBeDefined();
  });
});

describe('detection_engine_callback_error emission (monitor)', () => {
  it('reports a failing anomaly callback through the agent', async () => {
    const { agent, events } = capturingAgent();
    const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000);
    monitor.registerAnomalyCallback(() => { throw new Error('callback boom'); });
    await monitor.recordMetric('p1', 0.5, 128, false, false, agent);
    const event = events.find((e) => e['eventType'] === 'detection_engine_callback_error');
    expect(event).toBeDefined();
    expect(event?.['actionTaken']).toBe('logged');
    expect(event?.['reason']).toBe('Anomaly callback failed: callback boom');
    expect(event?.['handlerName']).toBe('performance_monitor');
    expect(event?.['metadata']).toMatchObject({
      component: 'PerformanceMonitor',
      correlationId: null,
      callbackError: 'callback boom',
      anomalyType: 'slow_execution',
    });
  });

  it('keeps scanning when no agent handler is attached', async () => {
    const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000);
    monitor.registerAnomalyCallback(() => { throw new Error('callback boom'); });
    const result = monitor.recordMetric('p1', 0.5, 128, false, false, null);
    if (result instanceof Promise) await result;
  });

  it('swallows agent dispatch failures on the callback-error path', async () => {
    const agent = {
      async sendEvent(event: Record<string, unknown>) {
        if (event['eventType'] === 'detection_engine_callback_error') {
          throw new Error('transport down');
        }
      },
    } as unknown as AgentHandlerProtocol;
    const monitor = new PerformanceMonitor(3.0, 0.1, 1000, 1000);
    monitor.registerAnomalyCallback(() => { throw new Error('callback boom'); });
    const result = monitor.recordMetric('p1', 0.5, 128, false, false, agent);
    if (result instanceof Promise) await result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});

describe('event bus envelope promotion', () => {
  it('promotes string decoratorType and ruleType to top-level fields', async () => {
    const { SecurityEventBus } = await import('../../src/core/events/event-bus.js');
    const { agent, events } = capturingAgent();
    const config = createTestConfig({ agentEnableEvents: true });
    const bus = new SecurityEventBus(agent, config, defaultLogger);
    await bus.sendMiddlewareEvent('decorator_violation', createMockRequest(), 'request_blocked', 'blocked', {
      decoratorType: 'rate_limiting',
      ruleType: 'endpoint_rate_limit',
      other: 1,
    });
    const event = events[0];
    expect(event?.['decoratorType']).toBe('rate_limiting');
    expect(event?.['ruleType']).toBe('endpoint_rate_limit');
    expect(event?.['handlerName']).toBe('middleware');
  });

  it('coalesces non-string decoratorType and ruleType to null', async () => {
    const { SecurityEventBus } = await import('../../src/core/events/event-bus.js');
    const { agent, events } = capturingAgent();
    const config = createTestConfig({ agentEnableEvents: true });
    const bus = new SecurityEventBus(agent, config, defaultLogger);
    await bus.sendMiddlewareEvent('test', createMockRequest(), 'action', 'reason', {
      decoratorType: 42,
      ruleType: true,
    });
    expect(events[0]?.['decoratorType']).toBeNull();
    expect(events[0]?.['ruleType']).toBeNull();
  });
});

describe('escalateIdentityViolation + ip_ban_failed (helpers)', () => {
  it('reports ban_not_applied when the escalation raises', async () => {
    const { emitBanEscalationFailed } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const request = createMockRequest();
    await emitBanEscalationFailed(middleware, request, '1.2.3.4', new Error('redis down'));
    expect(sent[0]).toMatchObject({
      type: 'ip_ban_failed',
      action: 'ban_not_applied',
      reason: 'Escalation ban failed for 1.2.3.4: redis down',
      meta: { ipAddress: '1.2.3.4' },
    });
  });

  it('stringifies non-Error throwables', async () => {
    const { emitBanEscalationFailed } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (_type: string, _r: unknown, _action: string, reason: string) => { sent.push({ reason }); };
    await emitBanEscalationFailed(middleware, createMockRequest(), '1.2.3.4', 'plain string failure');
    expect(sent[0]?.['reason']).toBe('Escalation ban failed for 1.2.3.4: plain string failure');
  });

  it('escalates a threat into counts, ban and the penetration_attempt close-out', async () => {
    const { escalateIdentityViolation } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const ipBanManager = { banIp: vi.fn(async () => true) };
    const config = createTestConfig({ enableIpBanning: true, autoBanThreshold: 1 });
    const request = createMockRequest({
      queryParams: { q: "<script>alert(1)</script>" },
    });
    await escalateIdentityViolation(
      middleware, config, ipBanManager as never,
      request, '1.2.3.4', defaultLogger, 'ip_blocked', 'IP not allowed: 1.2.3.4',
    );
    expect(ipBanManager.banIp).toHaveBeenCalled();
    const closeOut = sent.find((e) => e['type'] === 'penetration_attempt');
    expect(closeOut).toMatchObject({ action: 'banned' });
  });

  it('skips without a client ip, for whitelisted requests, and for clean scans', async () => {
    const { escalateIdentityViolation } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string) => { sent.push({ type }); };
    const config = createTestConfig();
    const ipBanManager = { banIp: vi.fn() };

    await escalateIdentityViolation(middleware, config, ipBanManager as never,
      createMockRequest(), '', defaultLogger, 'ip_blocked', 'r');
    expect(sent).toEqual([]);

    const whitelisted = createMockRequest();
    whitelisted.state.isWhitelisted = true;
    await escalateIdentityViolation(middleware, config, ipBanManager as never,
      whitelisted, '1.2.3.4', defaultLogger, 'ip_blocked', 'r');
    expect(sent).toEqual([]);

    await escalateIdentityViolation(middleware, config, ipBanManager as never,
      createMockRequest(), '1.2.3.4', defaultLogger, 'ip_blocked', 'clean');
    expect(sent).toEqual([]);
  });

  it('reports ip_ban_failed and swallows when the escalation raises', async () => {
    const { escalateIdentityViolation } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string) => {
        sent.push({ type, action, reason });
      };
    const config = createTestConfig({ enableIpBanning: true, autoBanThreshold: 1 });
    const ipBanManager = { banIp: vi.fn(async () => { throw new Error('ban write failed'); }) };
    const request = createMockRequest({ queryParams: { q: "<script>alert(1)</script>" } });
    await escalateIdentityViolation(
      middleware, config, ipBanManager as never,
      request, '1.2.3.4', defaultLogger, 'ip_blocked', 'denied',
    );
    const failure = sent.find((e) => e['type'] === 'ip_ban_failed');
    expect(failure).toMatchObject({
      action: 'ban_not_applied',
      reason: 'Escalation ban failed for 1.2.3.4: ban write failed',
    });
  });

  it('survives a failing failure report', async () => {
    const { escalateIdentityViolation } = await import('../../src/core/checks/helpers.js');
    const middleware = createMockMiddleware();
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async () => { throw new Error('bus down'); };
    const config = createTestConfig({ enableIpBanning: true, autoBanThreshold: 1 });
    const ipBanManager = { banIp: vi.fn(async () => { throw new Error('ban write failed'); }) };
    const request = createMockRequest({ queryParams: { q: "<script>alert(1)</script>" } });
    await expect(escalateIdentityViolation(
      middleware, config, ipBanManager as never,
      request, '1.2.3.4', defaultLogger, 'ip_blocked', 'denied',
    )).resolves.toBeUndefined();
  });
});

describe('custom_request_check emission', () => {
  it('fires the event and returns the blocking response', async () => {
    const { CustomRequestCheck } = await import('../../src/core/checks/implementations/custom-request.js');
    const sent: Array<Record<string, unknown>> = [];
    const middleware = createMockMiddleware({
      customRequestCheck: async function reject() {
        const response = {
          statusCode: 418, headers: {}, body: null, bodyText: null, setHeader: () => {},
        };
        return response as never;
      },
    });
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const check = new CustomRequestCheck(middleware);
    const response = await check.check(createMockRequest());
    expect(response?.statusCode).toBe(418);
    expect(sent[0]).toMatchObject({
      type: 'custom_request_check',
      action: 'request_blocked',
      reason: 'Custom request check returned blocking response',
      meta: { responseStatus: 418, checkFunction: 'reject' },
    });
  });

  it('reports logged_only in passive mode and anonymous functions', async () => {
    const { CustomRequestCheck } = await import('../../src/core/checks/implementations/custom-request.js');
    const sent: Array<Record<string, unknown>> = [];
    const blockingCheck = async () => {
      const response = {
        statusCode: 403, headers: {}, body: null, bodyText: null, setHeader: () => {},
      };
      return response as never;
    };
    // A nameless callable exercises the reference's anonymous fallback.
    Object.defineProperty(blockingCheck, 'name', { value: '' });
    const middleware = createMockMiddleware({
      passiveMode: true,
      customRequestCheck: blockingCheck,
    });
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, _reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, meta });
      };
    const check = new CustomRequestCheck(middleware);
    const response = await check.check(createMockRequest());
    expect(response?.statusCode).toBe(403);
    expect(sent[0]).toMatchObject({ action: 'logged_only', meta: { checkFunction: 'anonymous' } });
  });

  it('passes clean verdicts through without an event', async () => {
    const { CustomRequestCheck } = await import('../../src/core/checks/implementations/custom-request.js');
    const middleware = createMockMiddleware({
      customRequestCheck: async () => null,
    });
    const check = new CustomRequestCheck(middleware);
    await expect(check.check(createMockRequest())).resolves.toBeNull();
  });
});

describe('emergency_mode_block envelope', () => {
  it('carries the reference reason and whitelist metadata', async () => {
    const { EmergencyModeCheck } = await import('../../src/core/checks/implementations/emergency-mode.js');
    const sent: Array<Record<string, unknown>> = [];
    const middleware = createMockMiddleware({ emergencyMode: true, emergencyWhitelist: ['10.0.0.1'] });
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const check = new EmergencyModeCheck(middleware);
    const response = await check.check(createMockRequest());
    expect(response?.statusCode).toBe(503);
    expect(sent[0]).toMatchObject({
      type: 'emergency_mode_block',
      action: 'request_blocked',
      reason: '[EMERGENCY MODE] IP 1.2.3.4 not in whitelist',
      meta: { emergencyWhitelistCount: 1, emergencyActive: true },
    });
  });

  it('reports logged_only and swallows the response in passive mode', async () => {
    const { EmergencyModeCheck } = await import('../../src/core/checks/implementations/emergency-mode.js');
    const sent: Array<Record<string, unknown>> = [];
    const middleware = createMockMiddleware({ emergencyMode: true, passiveMode: true });
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string) => { sent.push({ type, action }); };
    const check = new EmergencyModeCheck(middleware);
    await expect(check.check(createMockRequest())).resolves.toBeNull();
    expect(sent[0]?.['action']).toBe('logged_only');
  });
});

describe('user-agent + ip-security escalation wiring', () => {
  it('ip-security global deny escalates with a faulted ban manager and reports ip_ban_failed', async () => {
    const { IpSecurityCheck } = await import('../../src/core/checks/implementations/ip-security.js');
    const middleware = createMockMiddleware({
      enableIpBanning: true,
      autoBanThreshold: 1,
      blacklist: ['1.2.3.4'],
    });
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const ipBanManager = { isIpBanned: async () => false, banIp: vi.fn(async () => { throw new Error('ban write failed'); }) };
    const check = new IpSecurityCheck(middleware, ipBanManager as never);
    const request = createMockRequest({ queryParams: { q: "<script>alert(1)</script>" } });
    const response = await check.check(request);
    expect(response?.statusCode).toBe(403);
    const failure = sent.find((e) => e['type'] === 'ip_ban_failed');
    expect(failure).toBeDefined();
  });

  it('user-agent deny escalates when the identity is present', async () => {
    const { UserAgentCheck } = await import('../../src/core/checks/implementations/user-agent.js');
    const middleware = createMockMiddleware({
      enableIpBanning: true,
      autoBanThreshold: 1,
      blockedUserAgents: ['evilbot/1.0'],
    });
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string, _r: unknown, action: string, reason: string, meta?: Record<string, unknown>) => {
        sent.push({ type, action, reason, meta });
      };
    const ipBanManager = { banIp: vi.fn(async () => true) };
    const check = new UserAgentCheck(middleware, ipBanManager as never);
    /* The escalation re-runs the detection scan, so the request must carry a
       detected payload for the ban stage to fire (reference semantics). */
    const request = createMockRequest({
      headers: { 'user-agent': 'evilbot/1.0' },
      queryParams: { q: "<script>alert(1)</script>" },
    });
    const response = await check.check(request);
    expect(response?.statusCode).toBe(403);
    expect(ipBanManager.banIp).toHaveBeenCalled();
    const closeOut = sent.find((e) => e['type'] === 'penetration_attempt');
    expect(closeOut).toMatchObject({ action: 'banned' });
  });

  it('user-agent deny skips the escalation without an identity', async () => {
    const { UserAgentCheck } = await import('../../src/core/checks/implementations/user-agent.js');
    const middleware = createMockMiddleware({
      enableIpBanning: true,
      autoBanThreshold: 1,
      blockedUserAgents: ['evilbot/1.0'],
    });
    const sent: Array<Record<string, unknown>> = [];
    (middleware.eventBus as Record<string, unknown>)['sendMiddlewareEvent'] =
      async (type: string) => { sent.push({ type }); };
    const check = new UserAgentCheck(middleware);
    const request = createMockRequest({ headers: { 'user-agent': 'evilbot/1.0' } });
    (request.state as Record<string, unknown>).clientIp = undefined;
    (request as Partial<GuardRequest>).clientHost = undefined;
    await expect(check.check(request)).resolves.not.toBeNull();
    expect(sent.every((e) => e['type'] !== 'penetration_attempt')).toBe(true);
  });
});
