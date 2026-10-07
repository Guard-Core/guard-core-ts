/* The TS twin of guard_core.exceptions.GuardRedisError: raised by the Redis
   handler when a live client operation fails, so the pipeline can apply the
   redis_fail_open policy (skip the failing check) instead of the generic
   fail_secure path. */

/* The TS twin of guard_core.exceptions.GuardCoreError: the base class for
   every engine-raised error, carrying the HTTP status the fail-secure and
   fail-open policies map to. */
export class GuardCoreError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GuardCoreError';
    this.status = status;
  }
}

export class GuardRedisError extends GuardCoreError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'GuardRedisError';
  }
}
