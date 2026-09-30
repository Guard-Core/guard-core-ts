/**
 * Deadline and pool semantics for the JS-native regex scan path
 * (spec 04-detection: scan execution + consecutive-timeout pool replacement).
 *
 * The reference runs every timeout-guarded scan on a shared 4-worker thread
 * pool and waits up to the verdict deadline (detection_compiler_timeout,
 * deployment default 2.0 s); each timeout increments a counter, any
 * successful scan resets it, and 4 consecutive timeouts replace the whole
 * pool (compiler.py:report_scan_timeout) because a slow pattern can
 * permanently occupy every worker.
 *
 * A JS RegExp cannot be interrupted mid-execution, and worker-less targets
 * (edge runtimes) have no pool to replace. This module ports the state
 * machine to that context as a deadline-bounded synchronous fallback with
 * the documented detection limits:
 *
 * - `run()` measures the scan against the per-scan verdict deadline. A scan
 *   that overshoots the deadline completes (the engine cannot preempt it)
 *   but its verdict is discarded, the scan is reported as a timeout, and the
 *   overshoot itself is the documented detection limit: a pattern that
 *   massively exceeds the deadline still blocks its thread for the overshoot
 *   duration. Only a worker-based path (Node worker_threads, already used by
 *   PatternCompiler.safeMatch) can hard-interrupt.
 * - The pool-replacement state machine maps to pattern quarantine: a pattern
 *   whose scans time out SCAN_POOL_SIZE consecutive times (the reference pool
 *   size) is pulled from the active scan pool for a cooldown window and is
 *   re-admitted when it elapses. The reference instead swaps in a fresh
 *   worker pool and keeps scanning every pattern; the cooldown is the
 *   worker-less fallback's substitute for the fresh pool, so a transiently
 *   slow pattern recovers instead of staying disabled forever.
 */

export const SCAN_POOL_SIZE = 4;
export const DEFAULT_QUARANTINE_COOLDOWN_MS = 60_000;

export type ScanPoolClock = () => number;

export const performanceClock: ScanPoolClock = () => performance.now();

export type ScanOutcomeStatus = 'completed' | 'timeout' | 'quarantined' | 'error';

export interface ScanOutcome<T> {
  readonly status: ScanOutcomeStatus;
  readonly value: T | null;
  readonly elapsedMs: number;
}

export type ScanPoolEventType = 'pattern_quarantined' | 'pattern_released';

export interface ScanPoolEvent {
  readonly type: ScanPoolEventType;
  readonly pattern: string;
  readonly consecutiveTimeouts: number;
  readonly cooldownMs: number;
  readonly atMs: number;
}

export type ScanPoolListener = (event: ScanPoolEvent) => void;

export class ScanPoolSupervisor {
  private readonly deadlineMs: number;
  private readonly cooldownMs: number;
  private readonly clock: ScanPoolClock;
  private readonly consecutiveTimeouts = new Map<string, number>();
  private readonly quarantinedUntil = new Map<string, number>();
  private readonly listeners: ScanPoolListener[] = [];

  constructor(
    deadlineMs: number,
    cooldownMs: number = DEFAULT_QUARANTINE_COOLDOWN_MS,
    clock: ScanPoolClock = performanceClock,
  ) {
    this.deadlineMs = deadlineMs;
    this.cooldownMs = cooldownMs;
    this.clock = clock;
  }

  get deadline(): number {
    return this.deadlineMs;
  }

  get cooldown(): number {
    return this.cooldownMs;
  }

  /** False while the pattern sits out its quarantine cooldown window. */
  isActive(pattern: string): boolean {
    this.releaseExpired();
    return !this.quarantinedUntil.has(pattern);
  }

  quarantinedPatterns(): string[] {
    this.releaseExpired();
    return [...this.quarantinedUntil.keys()];
  }

  consecutiveTimeoutCount(pattern: string): number {
    return this.consecutiveTimeouts.get(pattern) ?? 0;
  }

  run<T>(pattern: string, scan: () => T): ScanOutcome<T> {
    if (!this.isActive(pattern)) {
      return { status: 'quarantined', value: null, elapsedMs: 0 };
    }
    const start = this.clock();
    let value: T;
    try {
      value = scan();
    } catch {
      return { status: 'error', value: null, elapsedMs: this.clock() - start };
    }
    const elapsedMs = this.clock() - start;
    if (elapsedMs > this.deadlineMs) {
      this.reportTimeout(pattern);
      return { status: 'timeout', value: null, elapsedMs };
    }
    this.reportSuccess(pattern);
    return { status: 'completed', value, elapsedMs };
  }

  /** Reference report_scan_success: any completed scan resets the counter. */
  reportSuccess(pattern: string): void {
    this.consecutiveTimeouts.delete(pattern);
  }

  /** Reference report_scan_timeout, per pattern: the SCAN_POOL_SIZE-th
   *  consecutive timeout pulls the pattern from the active pool for the
   *  cooldown window. Returns true when this timeout quarantined it. */
  reportTimeout(pattern: string): boolean {
    const count = (this.consecutiveTimeouts.get(pattern) ?? 0) + 1;
    if (count < SCAN_POOL_SIZE) {
      this.consecutiveTimeouts.set(pattern, count);
      return false;
    }
    this.consecutiveTimeouts.delete(pattern);
    const atMs = this.clock();
    this.quarantinedUntil.set(pattern, atMs + this.cooldownMs);
    this.emit({
      type: 'pattern_quarantined',
      pattern,
      consecutiveTimeouts: SCAN_POOL_SIZE,
      cooldownMs: this.cooldownMs,
      atMs,
    });
    return true;
  }

  onPoolEvent(listener: ScanPoolListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  reset(): void {
    this.consecutiveTimeouts.clear();
    this.quarantinedUntil.clear();
  }

  private releaseExpired(): void {
    const now = this.clock();
    for (const [pattern, until] of this.quarantinedUntil) {
      if (now >= until) {
        this.quarantinedUntil.delete(pattern);
        this.emit({
          type: 'pattern_released',
          pattern,
          consecutiveTimeouts: 0,
          cooldownMs: 0,
          atMs: now,
        });
      }
    }
  }

  private emit(event: ScanPoolEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // never throw from telemetry
      }
    }
  }
}
