import { describe, it, expect, vi } from 'vitest';
import {
  ON_BLOCK_EXCLUDED_CHECK_NAMES,
  buildBlockPayload,
  fireBlockHook,
  invokeBlockHook,
  invokeErrorHook,
} from '../../src/core/block-events.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { GuardRequest } from '../../src/protocols/request.js';

function makeRequest(overrides: Partial<GuardRequest> = {}): GuardRequest {
  return {
    state: {},
    clientHost: '10.0.0.1',
    urlPath: '/data?token=abc',
    method: 'POST',
    headers: {},
    ...overrides,
  } as unknown as GuardRequest;
}

describe('ON_BLOCK_EXCLUDED_CHECK_NAMES', () => {
  it('matches the reference excluded set', () => {
    expect([...ON_BLOCK_EXCLUDED_CHECK_NAMES].sort()).toEqual(
      ['custom_request', 'custom_validators', 'https_enforcement'],
    );
  });
});

describe('buildBlockPayload', () => {
  it('carries the reference payload keys with a redacted path', () => {
    const payload = buildBlockPayload(
      makeRequest(), 'required_headers', 'Missing header', 'trigger', false, 400, [], [], [],
    );
    expect(payload).toMatchObject({
      check_name: 'required_headers',
      reason: 'Missing header',
      trigger_info: 'trigger',
      passive_mode: false,
      client_ip: '10.0.0.1',
      method: 'POST',
      status_code: 400,
    });
    expect(payload.path).toBe('/data?token=[REDACTED]');
  });

  it('uses the cached state client_ip and null status on the passive path', () => {
    const request = makeRequest({
      state: { client_ip: '192.168.1.1' },
      clientHost: null,
    } as Partial<GuardRequest>);
    const payload = buildBlockPayload(request, 'ip', 'r', '', true, null, [], [], []);
    expect(payload.client_ip).toBe('192.168.1.1');
    expect(payload.status_code).toBeNull();
  });

  it('falls back to the unknown identity when no client host exists', () => {
    const payload = buildBlockPayload(
      makeRequest({ clientHost: null }), 'ip', 'r', '', false, 403, [], [], [],
    );
    expect(payload.client_ip).toBe('unknown');
  });
});

describe('fireBlockHook', () => {
  it('invokes the hook with the built payload', async () => {
    const hook = vi.fn();
    await fireBlockHook(hook, makeRequest(), defaultLogger,
      'rate_limit', 'over limit', 'trigger', false, 429, [], [], []);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][1]).toMatchObject({ check_name: 'rate_limit', status_code: 429 });
  });

  it('never fires for excluded check names', async () => {
    for (const name of ON_BLOCK_EXCLUDED_CHECK_NAMES) {
      const hook = vi.fn();
      await fireBlockHook(hook, makeRequest(), defaultLogger,
        name, 'r', '', false, 400, [], [], []);
      expect(hook).not.toHaveBeenCalled();
    }
  });

  it('does nothing without a hook', async () => {
    await expect(fireBlockHook(null, makeRequest(), defaultLogger,
      'rate_limit', 'r', '', false, 429, [], [], [])).resolves.toBeUndefined();
  });

  it('awaits async hooks', async () => {
    const seen: string[] = [];
    await fireBlockHook(
      async (_req, payload) => { seen.push(String(payload['check_name'])); },
      makeRequest(), defaultLogger, 'user_agent', 'r', '', false, 403, [], [], [],
    );
    expect(seen).toEqual(['user_agent']);
  });

  it('swallows and logs a raising hook', async () => {
    const hook = () => { throw new Error('hook boom'); };
    await expect(fireBlockHook(hook, makeRequest(), defaultLogger,
      'rate_limit', 'r', '', false, 429, [], [], [])).resolves.toBeUndefined();
  });
});

describe('invokeBlockHook / invokeErrorHook', () => {
  it('invokeBlockHook no-ops without a hook', async () => {
    await expect(invokeBlockHook(null, makeRequest(), {}, defaultLogger))
      .resolves.toBeUndefined();
  });

  it('invokeErrorHook passes stage, error and context', () => {
    const hook = vi.fn();
    const err = new Error('send failed');
    invokeErrorHook(hook, 'transport_send', err, { eventType: 'x' }, defaultLogger);
    expect(hook).toHaveBeenCalledWith('transport_send', err, { eventType: 'x' });
  });

  it('invokeErrorHook swallows a raising hook', () => {
    const hook = () => { throw new Error('on_error boom'); };
    expect(() => invokeErrorHook(hook, 'agent_init', new Error('e'), {}, defaultLogger))
      .not.toThrow();
  });

  it('invokeErrorHook no-ops without a hook', () => {
    expect(() => invokeErrorHook(undefined, 'geoip', new Error('e'), {}, defaultLogger))
      .not.toThrow();
  });
});
