import { describe, it, expect, vi } from 'vitest';
import { BypassHandler } from '../../src/core/bypass/handler.js';
import { RouteConfigResolver } from '../../src/core/routing/resolver.js';
import { SecurityEventBus } from '../../src/core/events/event-bus.js';
import { RequestValidator } from '../../src/core/validation/validator.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { createTestConfig, createMockRequest, createMockResponse } from '../helpers.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { GuardResponse } from '../../src/protocols/response.js';

function createBypassHandler(configOverrides: Record<string, unknown> = {}) {
  const config = createTestConfig(configOverrides);
  const eventBus = new SecurityEventBus(null, config, defaultLogger);
  const routeResolver = new RouteConfigResolver(config);
  const validator = new RequestValidator(config, defaultLogger, eventBus);
  const errorResponseFactory = {
    async applyModifier(response: GuardResponse) { return response; },
    async createErrorResponse(statusCode: number, message: string) {
      return createMockResponse(statusCode, message);
    },
  };

  return new BypassHandler(
    config, eventBus, routeResolver,
    errorResponseFactory as never, validator,
  );
}

describe('BypassHandler', () => {
  describe('handlePassthrough', () => {
    it('rejects a request with no client address with 403 under failSecure and fires on_block', async () => {
      const onBlock = vi.fn();
      const handler = createBypassHandler({ onBlock });
      const req = createMockRequest({ clientHost: null });

      const result = await handler.handlePassthrough(req);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(403);
      expect(onBlock).toHaveBeenCalledTimes(1);
      expect(onBlock.mock.calls[0][1]).toMatchObject({
        check_name: 'client_address_unresolved', client_ip: 'unknown', status_code: 403,
      });
    });

    it('warns about the missing client address only once', async () => {
      const warn = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
      const handler = createBypassHandler();
      await handler.handlePassthrough(createMockRequest({ clientHost: null }));
      await handler.handlePassthrough(createMockRequest({ clientHost: null }));
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('no client address'))).toHaveLength(1);
      warn.mockRestore();
    });

    it('continues with the unknown identity when failSecure is false', async () => {
      const warn = vi.spyOn(defaultLogger, 'warn').mockImplementation(() => {});
      const handler = createBypassHandler({ failSecure: false });
      const req = createMockRequest({ clientHost: null });

      expect(await handler.handlePassthrough(req)).toBeNull();
      expect(req.state['client_ip']).toBe('unknown');
      expect(warn.mock.calls.some((c) => String(c[0]).includes('failSecure=false'))).toBe(true);
      warn.mockRestore();
    });

    it('marks an excluded path exclusion-scoped and continues (null)', async () => {
      const handler = createBypassHandler({ excludePaths: ['/health'] });
      const req = createMockRequest({ urlPath: '/health' });

      expect(await handler.handlePassthrough(req)).toBeNull();
      expect(req.state.guardExclusionScoped).toBe(true);
    });

    it('answers an excluded path before the client address is considered', async () => {
      const handler = createBypassHandler({ excludePaths: ['/health'] });
      const req = createMockRequest({ urlPath: '/health', clientHost: null });

      expect(await handler.handlePassthrough(req)).toBeNull();
      expect(req.state.guardExclusionScoped).toBe(true);
    });

    it('returns null for normal request', async () => {
      const handler = createBypassHandler();
      const req = createMockRequest();
      const callNext = vi.fn();

      const result = await handler.handlePassthrough(req, callNext);
      expect(result).toBeNull();
      expect(req.state.guardExclusionScoped).toBeUndefined();
      expect(callNext).not.toHaveBeenCalled();
    });
  });

  describe('beginSecurityBypass', () => {
    it('is false with no route config or without an all bypass', async () => {
      const handler = createBypassHandler();
      expect(await handler.beginSecurityBypass(createMockRequest(), null)).toBe(false);
      expect(await handler.beginSecurityBypass(createMockRequest(), new RouteConfig())).toBe(false);
    });

    it('is true for an all-checks bypass and false in passive mode', async () => {
      const rc = new RouteConfig();
      rc.bypassedChecks.add('all');
      expect(await createBypassHandler().beginSecurityBypass(createMockRequest(), rc)).toBe(true);
      expect(await createBypassHandler({ passiveMode: true }).beginSecurityBypass(createMockRequest(), rc)).toBe(false);
    });
  });

  describe('handleSecurityBypass', () => {
    it('returns null with no route config', async () => {
      const handler = createBypassHandler();
      const callNext = vi.fn();
      const result = await handler.handleSecurityBypass(createMockRequest(), callNext, null);
      expect(result).toBeNull();
    });

    it('returns null when checks not bypassed', async () => {
      const handler = createBypassHandler();
      const rc = new RouteConfig();
      const result = await handler.handleSecurityBypass(createMockRequest(), vi.fn(), rc);
      expect(result).toBeNull();
    });

    it('bypasses when all checks bypassed (non-passive)', async () => {
      const handler = createBypassHandler();
      const rc = new RouteConfig();
      rc.bypassedChecks.add('all');
      const callNext = vi.fn().mockResolvedValue(createMockResponse(200, 'ok'));

      const result = await handler.handleSecurityBypass(createMockRequest(), callNext, rc);
      expect(result).not.toBeNull();
    });

    it('returns null in passive mode even with bypass', async () => {
      const handler = createBypassHandler({ passiveMode: true });
      const rc = new RouteConfig();
      rc.bypassedChecks.add('all');

      const result = await handler.handleSecurityBypass(createMockRequest(), vi.fn(), rc);
      expect(result).toBeNull();
    });
  });
});
