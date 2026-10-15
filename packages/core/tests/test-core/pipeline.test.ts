import { describe, it, expect } from 'vitest';
import { SecurityCheckPipeline } from '../../src/core/checks/pipeline.js';
import { SecurityCheck } from '../../src/core/checks/base.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { GuardMiddlewareProtocol } from '../../src/protocols/middleware.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import type { GuardResponse } from '../../src/protocols/response.js';

function createMockResponse(statusCode: number, message: string): GuardResponse {
  return {
    statusCode,
    headers: {},
    setHeader() {},
    body: new TextEncoder().encode(message),
    bodyText: message,
  };
}

class PassCheck extends SecurityCheck {
  get checkName() { return 'pass'; }
  async check(_request: GuardRequest): Promise<GuardResponse | null> { return null; }
}

class BlockCheck extends SecurityCheck {
  get checkName() { return 'block'; }
  async check(_request: GuardRequest): Promise<GuardResponse | null> {
    return createMockResponse(403, 'Blocked');
  }
}

class ErrorCheck extends SecurityCheck {
  get checkName() { return 'error'; }
  async check(_request: GuardRequest): Promise<GuardResponse | null> {
    throw new Error('Check failed');
  }
}

const mockMiddleware = { config: {}, logger: defaultLogger } as unknown as GuardMiddlewareProtocol;

describe('SecurityCheckPipeline', () => {
  it('returns null when all checks pass', async () => {
    const pipeline = new SecurityCheckPipeline([
      new PassCheck(mockMiddleware),
      new PassCheck(mockMiddleware),
    ], defaultLogger);

    const result = await pipeline.execute({} as GuardRequest);
    expect(result).toBeNull();
  });

  it('returns first blocking response', async () => {
    const pipeline = new SecurityCheckPipeline([
      new PassCheck(mockMiddleware),
      new BlockCheck(mockMiddleware),
      new PassCheck(mockMiddleware),
    ], defaultLogger);

    const result = await pipeline.execute({} as GuardRequest);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it('continues after check errors', async () => {
    const pipeline = new SecurityCheckPipeline([
      new ErrorCheck(mockMiddleware),
      new PassCheck(mockMiddleware),
    ], defaultLogger);

    const result = await pipeline.execute({} as GuardRequest);
    expect(result).toBeNull();
  });

  it('returns check names', () => {
    const pipeline = new SecurityCheckPipeline([
      new PassCheck(mockMiddleware),
      new BlockCheck(mockMiddleware),
    ], defaultLogger);

    expect(pipeline.getCheckNames()).toEqual(['pass', 'block']);
  });

  it('adds checks', () => {
    const pipeline = new SecurityCheckPipeline([], defaultLogger);
    pipeline.add(new PassCheck(mockMiddleware));
    expect(pipeline.length).toBe(1);
  });

  it('inserts checks at position', () => {
    const pipeline = new SecurityCheckPipeline([
      new PassCheck(mockMiddleware),
      new BlockCheck(mockMiddleware),
    ], defaultLogger);
    pipeline.insert(1, new ErrorCheck(mockMiddleware));
    expect(pipeline.getCheckNames()).toEqual(['pass', 'error', 'block']);
  });

  it('removes checks by name', () => {
    const pipeline = new SecurityCheckPipeline([
      new PassCheck(mockMiddleware),
      new BlockCheck(mockMiddleware),
    ], defaultLogger);
    const removed = pipeline.remove('block');
    expect(removed).toBe(true);
    expect(pipeline.getCheckNames()).toEqual(['pass']);
  });

  it('returns false when removing non-existent check', () => {
    const pipeline = new SecurityCheckPipeline([], defaultLogger);
    expect(pipeline.remove('nonexistent')).toBe(false);
  });

  it('skips checks not enforced on excluded paths for an exclusion-scoped request', async () => {
    class EnforcedBlock extends BlockCheck {
      override readonly enforcedOnExcludedPaths = true;
      override get checkName() { return 'enforced_block'; }
    }
    const scoped = { state: { guardExclusionScoped: true } } as unknown as GuardRequest;
    const unscoped = { state: {} } as unknown as GuardRequest;

    const onlyUnenforced = new SecurityCheckPipeline([new BlockCheck(mockMiddleware)], defaultLogger);
    expect(await onlyUnenforced.execute(scoped)).toBeNull();
    expect((await onlyUnenforced.execute(unscoped))!.statusCode).toBe(403);

    const withEnforced = new SecurityCheckPipeline(
      [new BlockCheck(mockMiddleware), new EnforcedBlock(mockMiddleware)], defaultLogger,
    );
    expect((await withEnforced.execute(scoped))!.statusCode).toBe(403);
  });
});
