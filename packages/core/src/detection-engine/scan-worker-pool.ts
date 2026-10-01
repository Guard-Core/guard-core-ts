/**
 * Bounded worker-thread execution pool for the native regex scan deadline
 * (spec 04-detection: scan execution + consecutive-timeout pool replacement).
 *
 * The ScanPoolSupervisor's deadline handling runs every scan on the calling
 * thread: a synchronous native RegExp cannot be interrupted, so a scan that
 * massively overshoots the verdict deadline still blocks the event loop for
 * the overshoot duration. This module is the opt-in fix (config knob
 * `detectionScanWorkerPool`, default false): the unbounded regex work runs
 * on a bounded pool of worker threads (the reference's shared 4-worker pool,
 * compiler.py shared_regex_executor / _SHARED_EXECUTOR_MAX_WORKERS) and the
 * deadline is enforced by TERMINATING the worker instead of waiting:
 *
 * - Every dispatch picks an idle worker (FIFO queue when all are busy) and
 *   races the worker's answer against the verdict deadline
 *   (detectionCompilerTimeout). A completed scan returns its candidates.
 * - A deadline overshoot terminates the worker (hard interrupt: the worker
 *   dies mid-RegExp), spawns a fresh replacement so the pool stays at its
 *   bounded size, counts one consecutive timeout, and reports a timeout
 *   verdict without the calling thread ever having blocked.
 * - Replacement semantics mirror report_scan_timeout: any completed scan
 *   resets the consecutive-timeout counter, and SCAN_POOL_SIZE consecutive
 *   timeouts replace the WHOLE pool (every worker terminated and respawned),
 *   because a slow pattern may have poisoned every worker. The reference
 *   swaps in a fresh ThreadPoolExecutor and keeps scanning every pattern;
 *   this pool does the same and logs the same warning.
 *
 * The worker answers with candidate matches (text, index, capture groups);
 * candidate validation (per-pattern rejection validators, binary-density
 * gates) stays on the calling thread, so a scan's verdict is byte-identical
 * to the inline path - only the preemption changes.
 */

import type { Logger } from '../models/logger.js';
import type { ScanOutcome } from './scan-pool.js';
import { SCAN_POOL_SIZE } from './scan-pool.js';

/** The reference shared-pool size, also the consecutive-timeout replacement
 *  threshold (compiler.py _SHARED_EXECUTOR_MAX_WORKERS). */
export const WORKER_POOL_SIZE = SCAN_POOL_SIZE;

/** Upper bound on candidates collected per scan; the inline loop validates
 *  candidates lazily and can stop at the first accepted one, the worker
 *  cannot, so the batch is capped (64 is far above any validator's
 *  acceptance horizon in the canonical table). */
export const MAX_CANDIDATES_PER_SCAN = 64;

export interface RegexCandidate {
  /** Full match text (match[0]). */
  text: string;
  index: number;
  /** Capture groups (match[0..n]); element 0 repeats the full text. */
  groups: string[];
}

export interface WorkerScanTask {
  patternSource: string;
  flags: string;
  content: string;
}

export interface WorkerScanPoolEvent {
  readonly type: 'worker_replaced' | 'pool_replaced';
  readonly consecutiveTimeouts: number;
  readonly atMs: number;
}

export type WorkerScanPoolListener = (event: WorkerScanPoolEvent) => void;

export type WorkerScanClock = () => number;

export const workerPoolClock: WorkerScanClock = () => performance.now();

/** Deadline scheduling, injectable so tests trigger the deadline
 *  synchronously instead of racing a real timer. */
export type DeadlineScheduler = (deadlineMs: number, fire: () => void) => () => void;

export const setTimeoutScheduler: DeadlineScheduler = (deadlineMs, fire) => {
  const timer = setTimeout(fire, deadlineMs);
  return () => clearTimeout(timer);
};

/* The minimal worker surface the pool needs (node:worker_threads.Worker).
 * Kept structural so tests can inject deterministic fakes. */
export interface PoolWorker {
  postMessage(message: unknown): void;
  terminate(): Promise<unknown>;
  onMessage(listener: (message: unknown) => void): void;
  onError(listener: (error: unknown) => void): void;
}

export type WorkerFactory = () => PoolWorker;

export interface WorkerScanPoolOptions {
  size?: number;
  clock?: WorkerScanClock;
  schedule?: DeadlineScheduler;
  spawn: WorkerFactory;
  logger?: Logger | null;
}

interface PoolSlot {
  worker: PoolWorker;
  busy: boolean;
  /* The current dispatch's answer resolver; the worker's message and error
     listeners are registered once per worker (at slot creation) and hand
     their message to whoever is waiting. */
  waiter: ((message: unknown) => void) | null;
}

interface PendingDispatch {
  task: WorkerScanTask;
  resolve: (value: ScanOutcome<RegexCandidate[]>) => void;
}

export class WorkerScanPool {
  private readonly deadlineMs: number;
  private readonly size: number;
  private readonly clock: WorkerScanClock;
  private readonly schedule: DeadlineScheduler;
  private readonly spawn: WorkerFactory;
  private readonly logger: Logger | null;
  private readonly listeners: WorkerScanPoolListener[] = [];
  private readonly slots: PoolSlot[] = [];
  private readonly queue: PendingDispatch[] = [];
  private consecutiveTimeouts = 0;
  private drained = false;

  constructor(deadlineMs: number, options: WorkerScanPoolOptions) {
    this.deadlineMs = deadlineMs;
    this.size = options.size ?? WORKER_POOL_SIZE;
    this.clock = options.clock ?? workerPoolClock;
    this.schedule = options.schedule ?? setTimeoutScheduler;
    this.spawn = options.spawn;
    this.logger = options.logger ?? null;
    for (let i = 0; i < this.size; i++) {
      this.slots.push(this.newSlot());
    }
  }

  private newSlot(): PoolSlot {
    const slot: PoolSlot = { worker: this.spawn(), busy: false, waiter: null };
    slot.worker.onMessage((message) => {
      const waiter = slot.waiter;
      slot.waiter = null;
      waiter?.(message);
    });
    slot.worker.onError((error) => {
      const waiter = slot.waiter;
      slot.waiter = null;
      waiter?.({ workerError: String(error) });
    });
    return slot;
  }

  get deadline(): number {
    return this.deadlineMs;
  }

  get poolSize(): number {
    return this.size;
  }

  get consecutiveTimeoutCount(): number {
    return this.consecutiveTimeouts;
  }

  /** Live worker count (bounded by construction), for tests and health. */
  aliveWorkers(): number {
    return this.slots.length;
  }

  onPoolEvent(listener: WorkerScanPoolListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /* Reference report_scan_success: any completed scan resets the counter. */
  reportSuccess(): void {
    this.consecutiveTimeouts = 0;
  }

  /** Reference report_scan_timeout, pool-wide: the size-th consecutive
   *  timeout replaces the whole pool. Returns true when this timeout
   *  triggered the replacement. */
  reportTimeout(): boolean {
    this.consecutiveTimeouts += 1;
    if (this.consecutiveTimeouts < this.size) return false;
    this.consecutiveTimeouts = 0;
    this.replaceWholePool();
    return true;
  }

  /** Dispatch one scan task. The map callback runs on the calling thread
   *  only for a scan that finished inside the deadline; a timed-out scan's
   *  worker is terminated and its result abandoned. */
  async run<T>(
    _pattern: string,
    task: WorkerScanTask,
    map: (candidates: RegexCandidate[]) => T,
  ): Promise<ScanOutcome<T>> {
    const start = this.clock();
    const outcome = await this.dispatch(task);
    const elapsedMs = this.clock() - start;
    if (outcome.status !== 'completed') {
      return { status: outcome.status, value: null, elapsedMs };
    }
    try {
      return { status: 'completed', value: map(outcome.value as RegexCandidate[]), elapsedMs };
    } catch {
      return { status: 'error', value: null, elapsedMs };
    }
  }

  /** Terminate every worker and stop the pool (handler shutdown). In-flight
   *  dispatches resolve as errors: their waiters are released so nothing
   *  hangs on a terminated worker, and queued dispatches never start. */
  async close(): Promise<void> {
    if (this.drained) return;
    this.drained = true;
    const slots = this.slots.splice(0, this.slots.length);
    for (const slot of slots) {
      const waiter = slot.waiter;
      slot.waiter = null;
      waiter?.({ workerError: 'pool_closed' });
    }
    await Promise.allSettled(slots.map((slot) => this.terminateQuietly(slot.worker)));
    for (const pending of this.queue.splice(0, this.queue.length)) {
      pending.resolve({ status: 'error', value: null, elapsedMs: 0 });
    }
  }

  private async dispatch(task: WorkerScanTask): Promise<ScanOutcome<RegexCandidate[]>> {
    if (this.drained) {
      return { status: 'error', value: null, elapsedMs: 0 };
    }
    return new Promise<ScanOutcome<RegexCandidate[]>>((resolve) => {
      this.queue.push({ task, resolve });
      this.pump();
    });
  }

  private pump(): void {
    /* An idle slot is taken only with a queued task next to it: every
       dispatch enqueues before pumping, and execute marks its slot busy
       synchronously, so the loop invariant holds by construction. */
    let slot = this.slots.find((entry) => !entry.busy);
    while (slot !== undefined && this.queue.length > 0) {
      const pending = this.queue.shift() as PendingDispatch;
      void this.execute(slot, pending.task, pending.resolve);
      slot = this.slots.find((entry) => !entry.busy);
    }
  }

  private async execute(
    slot: PoolSlot,
    task: WorkerScanTask,
    resolve: (value: ScanOutcome<RegexCandidate[]>) => void,
  ): Promise<void> {
    /* Exactly one side of the race resolves the dispatch: the worker answer
       (answerPromise) or the deadline (deadlinePromise) - the winner is
       known by the deadlineHit flag after the race, so resolve is called on
       one path only. */
    slot.busy = true;
    let answer: RegexCandidate[] | null = null;
    const answerPromise = new Promise<void>((resolveAnswer) => {
      slot.waiter = (message: unknown) => {
        const workerError = (message as Record<string, unknown> | null)?.['workerError'];
        answer = workerError !== undefined ? null : extractCandidates(message);
        resolveAnswer();
      };
    });

    let deadlineHit = false;
    const deadlinePromise = new Promise<void>((resolveDeadline) => {
      const cancelDeadline = this.schedule(this.deadlineMs, () => {
        deadlineHit = true;
        resolveDeadline();
      });
      void cancelDeadline;
    });

    slot.worker.postMessage({ ...task });

    /* The race lives on the event loop: the worker answer and the deadline
       fire both resolve from callbacks, so awaiting here keeps the calling
       thread responsive - exactly the property the inline fallback lacks.
       A test-injected scheduler fires the deadline synchronously. */
    await Promise.race([answerPromise, deadlinePromise]);

    if (deadlineHit) {
      /* Deadline path: the worker dies mid-RegExp and its result is
         abandoned; the calling thread was never blocked. The bookkeeping
         (termination, replacement, consecutive-timeout counting) completes
         before the dispatch resolves so a caller awaiting the run sees the
         pool already in its post-timeout state. */
      await this.terminateQuietly(slot.worker);
      this.replaceSlot(slot);
      const replaced = this.reportTimeout();
      if (this.logger) {
        this.logger.warn(
          `pattern scan deadline hit on the worker pool: worker terminated and replaced${replaced ? '; pool replaced after consecutive timeouts' : ''}`,
        );
      }
      this.pump();
      resolve({ status: 'timeout', value: null, elapsedMs: 0 });
      return;
    }

    slot.busy = false;
    if (answer === null) {
      resolve({ status: 'error', value: null, elapsedMs: 0 });
    } else {
      this.reportSuccess();
      resolve({ status: 'completed', value: answer, elapsedMs: 0 });
    }
    this.pump();
  }

  private replaceSlot(stale: PoolSlot): void {
    /* The stale slot always belongs to the pool: execute is the only caller
       and holds the slot it was dispatched on. */
    this.slots[this.slots.indexOf(stale)] = this.newSlot();
    this.emit({ type: 'worker_replaced', consecutiveTimeouts: this.consecutiveTimeouts, atMs: this.clock() });
  }

  private replaceWholePool(): void {
    const stale = this.slots.splice(0, this.slots.length);
    for (const slot of stale) {
      void this.terminateQuietly(slot.worker);
    }
    for (let i = 0; i < this.size; i++) {
      this.slots.push(this.newSlot());
    }
    this.emit({ type: 'pool_replaced', consecutiveTimeouts: this.size, atMs: this.clock() });
    if (this.logger) {
      this.logger.warn(
        `guard_core worker scan pool replaced after ${this.size} consecutive timeouts; a slow pattern may have permanently occupied all workers`,
      );
    }
  }

  private async terminateQuietly(worker: PoolWorker): Promise<void> {
    try {
      await worker.terminate();
    } catch {
      /* pool teardown never throws */
    }
  }

  private emit(event: WorkerScanPoolEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* never throw from telemetry */
      }
    }
  }
}

function extractCandidates(message: unknown): RegexCandidate[] | null {
  if (typeof message !== 'object' || message === null) return null;
  const candidates = (message as Record<string, unknown>)['candidates'];
  if (!Array.isArray(candidates)) return null;
  const out: RegexCandidate[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const record = candidate as Record<string, unknown>;
    if (typeof record['text'] !== 'string' || typeof record['index'] !== 'number' || !Array.isArray(record['groups'])) {
      continue;
    }
    out.push({
      text: record['text'],
      index: record['index'],
      groups: record['groups'].filter((g): g is string => typeof g === 'string'),
    });
  }
  return out;
}

/** The real node:worker_threads spawn; null when worker threads are not
 *  available (edge runtimes). The worker body compiles the pattern and
 *  collects up to MAX_CANDIDATES_PER_SCAN candidates with the same
 *  zero-length guard as the inline loop. */
async function loadNodeWorkerFactory(): Promise<WorkerFactory | null> {
  try {
    const { Worker } = await import('node:worker_threads');
    /* v8 ignore start -- real worker spawn; worker-thread callbacks live outside V8 coverage instrumentation (see PatternCompiler.fallbackMatch) */
    return () => {
      const worker = new Worker(workerScript(), { eval: true });
      return {
        postMessage: (message: unknown) => worker.postMessage(message),
        terminate: () => worker.terminate(),
        onMessage: (listener: (message: unknown) => void) => {
          worker.on('message', listener);
        },
        onError: (listener: (error: unknown) => void) => {
          worker.on('error', listener);
        },
      };
    };
    /* v8 ignore stop */
  } catch {
    return null;
  }
}

function workerScript(): string {
  return `
    const { parentPort } = require('node:worker_threads');
    parentPort.on('message', (task) => {
      try {
        const re = new RegExp(task.patternSource, task.flags);
        const candidates = [];
        let match;
        while ((match = re.exec(task.content)) !== null) {
          const groups = [];
          for (let i = 0; i < match.length; i++) groups.push(typeof match[i] === 'string' ? match[i] : '');
          candidates.push({ text: match[0], index: match.index, groups });
          if (candidates.length >= ${MAX_CANDIDATES_PER_SCAN}) break;
          if (match[0].length === 0) re.lastIndex++;
        }
        parentPort.postMessage({ candidates });
      } catch (e) {
        parentPort.postMessage({ candidates: [] });
      }
    });
  `;
}

/** Build the opt-in pool; null when worker threads are unavailable, so the
 *  caller can fall back to the inline supervisor with a single warning. */
export async function createWorkerScanPool(
  deadlineMs: number,
  options?: Omit<WorkerScanPoolOptions, 'spawn'> & { spawn?: WorkerFactory },
): Promise<WorkerScanPool | null> {
  const spawn = options?.spawn ?? (await loadNodeWorkerFactory());
  if (spawn === null) return null;
  return new WorkerScanPool(deadlineMs, { ...(options ?? {}), spawn });
}
