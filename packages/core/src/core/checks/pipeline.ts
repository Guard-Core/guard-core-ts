import type { GuardRequest } from '../../protocols/request.js';
import type { GuardResponse } from '../../protocols/response.js';
import type { Logger } from '../../models/logger.js';
import type { ResolvedSecurityConfig } from '../../models/config.js';
import { GuardRedisError } from '../../errors.js';
import { redactHeaderValueForDisplay } from '../../redaction.js';
import { fireBlockHook } from '../block-events.js';
import type { SecurityCheck } from './base.js';

export class SecurityCheckPipeline {
  constructor(
    private checks: SecurityCheck[],
    private readonly logger: Logger,
  ) {}

  /* The twin of SecurityCheckPipeline._handle_check_error
     (guard_core/core/checks/pipeline.py): a GuardRedisError under
     redis_fail_open skips the check; otherwise the error is logged with the
     message redacted through the configured sensitive sets, and fail_secure
     (the default) blocks with 500 while fail_secure=False falls through. */
  private async handleCheckError(
    check: SecurityCheck,
    request: GuardRequest,
    error: unknown,
    config: ResolvedSecurityConfig,
  ): Promise<GuardResponse | null> {
    if (error instanceof GuardRedisError && config.redisFailOpen) {
      this.logger.warn(
        `Skipping check ${check.checkName}: Redis unavailable, `
        + `failing open (redis_fail_open=True)`,
      );
      return null;
    }

    this.logger.error(
      `Error in security check ${check.checkName} `
      + `(${error instanceof Error ? error.name : typeof error}): `
      + redactHeaderValueForDisplay(
        String(error),
        config.logSensitiveParams,
        config.logSensitiveBodyFields,
        config.logSensitiveHeaders,
      ),
    );

    if (config.failSecure) {
      this.logger.warn(
        `Blocking request due to check error in fail-secure mode: ${check.checkName}`,
      );
      return check.createErrorResponse(500, 'Security check failed');
    }

    return null;
  }

  private async fireBlockHookFor(
    check: SecurityCheck,
    request: GuardRequest,
    response: GuardResponse,
    config: ResolvedSecurityConfig,
  ): Promise<void> {
    const state = (request.state ?? {}) as Record<string, unknown>;
    const stash = (state['_guardBlockStash'] ?? {}) as {
      reason?: string;
      triggerInfo?: string;
    };
    await fireBlockHook(
      config.onBlock,
      request,
      this.logger,
      check.checkName,
      stash.reason ?? '',
      stash.triggerInfo ?? '',
      false,
      response.statusCode,
      config.logSensitiveParams,
      config.logSensitiveBodyFields,
      config.logSensitiveHeaders,
    );
  }

  async execute(request: GuardRequest): Promise<GuardResponse | null> {
    for (const check of this.checks) {
      const config = check.middlewareRef.config as ResolvedSecurityConfig;
      let response: GuardResponse | null = null;
      try {
        response = await check.check(request);
      } catch (e) {
        const blocked = await this.handleCheckError(check, request, e, config);
        if (blocked !== null) return blocked;
        continue;
      }
      if (response !== null) {
        await this.fireBlockHookFor(check, request, response, config);
        return response;
      }
    }
    return null;
  }

  add(check: SecurityCheck): void {
    this.checks.push(check);
  }

  insert(index: number, check: SecurityCheck): void {
    this.checks.splice(index, 0, check);
  }

  remove(name: string): boolean {
    const idx = this.checks.findIndex((c) => c.checkName === name);
    if (idx === -1) return false;
    this.checks.splice(idx, 1);
    return true;
  }

  getCheckNames(): string[] {
    return this.checks.map((c) => c.checkName);
  }

  get length(): number {
    return this.checks.length;
  }
}
