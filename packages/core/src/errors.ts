/* The TS twin of guard_core.exceptions.GuardRedisError: raised by the Redis
   handler when a live client operation fails, so the pipeline can apply the
   redis_fail_open policy (skip the failing check) instead of the generic
   fail_secure path. */

export class GuardRedisError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GuardRedisError';
    this.status = status;
  }
}
