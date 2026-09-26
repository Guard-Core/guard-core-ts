import { describe, it, expect, vi } from 'vitest';
import { SecurityCheckPipeline } from '../../src/core/checks/pipeline.js';
import { SecurityCheck } from '../../src/core/checks/base.js';
import { GuardRedisError } from '../../src/errors.js';
import { createMockMiddleware, createMockRequest } from '../helpers.js';
import type { GuardMiddlewareProtocol } from '../../src/protocols/middleware.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import type { GuardResponse } from '../../src/protocols/response.js';

class PassCheck extends SecurityCheck {
  get checkName() { return 'pass'; }
  async check(): Promise<GuardResponse | null> { return null; }
}

class BlockCheck extends SecurityCheck {
  get checkName() { return 'rate_limit'; }
  async check(): Promise<GuardResponse | null> {
    return this.createErrorResponse(429, 'Rate limit exceeded');
  }
}

class ErrorCheck extends SecurityCheck {
  get checkName() { return 'error'; }
  async check(): Promise<GuardResponse | null> { throw new Error('secret_key=abcd leaked'); }
}

class RedisErrorCheck extends SecurityCheck {
  get checkName() { return 'time_window'; }
  async check(): Promise<GuardResponse | null> {
    throw new GuardRedisError(503, 'Redis operation failed');
  }
}

describe('SecurityCheckPipeline failure policy', () => {
  it('blocks with 500 Security check failed by default (failSecure=true)', async () => {
    const middleware = createMockMiddleware({});
    const pipeline = new SecurityCheckPipeline(
      [new ErrorCheck(middleware)], middleware.logger,
    );
    const result = await pipeline.execute(createMockRequest());
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(500);
    expect(result!.bodyText).toBe('Security check failed');
  });

  it('continues past the error when failSecure=false (fail-open)', async () => {
    const middleware = createMockMiddleware({ failSecure: false });
    const pipeline = new SecurityCheckPipeline([
      new ErrorCheck(middleware), new PassCheck(middleware),
    ], middleware.logger);
    const result = await pipeline.execute(createMockRequest());
    expect(result).toBeNull();
  });

  it('skips the failing check on GuardRedisError when redisFailOpen=true', async () => {    const middleware = createMockMiddleware({ redisFailOpen: true });
    const after = new PassCheck(middleware);
    const afterSpy = vi.spyOn(after, 'check');
    const pipeline = new SecurityCheckPipeline([
      new RedisErrorCheck(middleware), after,
    ], middleware.logger);
    const result = await pipeline.execute(createMockRequest());
    expect(result).toBeNull();
    expect(afterSpy).toHaveBeenCalled();
  });

  it('blocks with 500 on GuardRedisError when redisFailOpen=false (default)', async () => {
    const middleware = createMockMiddleware({});
    const pipeline = new SecurityCheckPipeline([
      new RedisErrorCheck(middleware),
    ], middleware.logger);
    const result = await pipeline.execute(createMockRequest());
    expect(result!.statusCode).toBe(500);
  });

  it('redacts configured sensitive names from the error log line', async () => {
    const middleware = createMockMiddleware({ failSecure: false });
    const lines: string[] = [];
    const logger = {
      ...middleware.logger,
      error: (msg: string) => { lines.push(msg); },
    };
    const pipeline = new SecurityCheckPipeline(
      [new ErrorCheck(middleware)], logger,
    );
    middleware.config.logSensitiveBodyFields = ['secret_key'];
    await pipeline.execute(createMockRequest());
    expect(lines.join('\n')).toContain('[REDACTED]');
    expect(lines.join('\n')).not.toContain('abcd');
  });

  it('fires on_block once for a blocking check with the stashed reason', async () => {
    const onBlock = vi.fn();
    const middleware = createMockMiddleware({ onBlock });
    const request = createMockRequest();
    (request.state as Record<string, unknown>)['_guardBlockStash'] = {
      reason: 'over the limit',
      triggerInfo: 'GET /api/test',
    };
    const pipeline = new SecurityCheckPipeline(
      [new PassCheck(middleware), new BlockCheck(middleware)], middleware.logger,
    );
    const result = await pipeline.execute(request);
    expect(result!.statusCode).toBe(429);
    expect(onBlock).toHaveBeenCalledTimes(1);
    const [req, payload] = onBlock.mock.calls[0];
    expect(req).toBe(request);
    expect(payload).toMatchObject({
      check_name: 'rate_limit',
      reason: 'over the limit',
      trigger_info: 'GET /api/test',
      passive_mode: false,
      status_code: 429,
    });
  });

  it('does not fire on_block for excluded check names', async () => {
    const onBlock = vi.fn();
    const middleware = createMockMiddleware({ onBlock });
    class HttpsBlock extends SecurityCheck {
      get checkName() { return 'https_enforcement'; }
      async check(): Promise<GuardResponse | null> {
        return this.createErrorResponse(301, 'redirect');
      }
    }
    const pipeline = new SecurityCheckPipeline([new HttpsBlock(middleware)], middleware.logger);
    await pipeline.execute(createMockRequest());
    expect(onBlock).not.toHaveBeenCalled();
  });

  it('keeps a raising on_block from breaking the pipeline', async () => {
    const middleware = createMockMiddleware({
      onBlock: () => { throw new Error('hook boom'); },
    });
    const pipeline = new SecurityCheckPipeline([new BlockCheck(middleware)], middleware.logger);
    await expect(pipeline.execute(createMockRequest())).resolves.toBeTruthy();
  });
});
