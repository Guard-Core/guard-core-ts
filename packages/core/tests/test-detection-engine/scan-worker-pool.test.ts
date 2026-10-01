import { describe, expect, test } from 'vitest';
import { SecurityConfigSchema } from '../../src/models/config.js';
import {
  MAX_CANDIDATES_PER_SCAN,
  WORKER_POOL_SIZE,
  WorkerScanPool,
  createWorkerScanPool,
} from '../../src/detection-engine/scan-worker-pool.js';
import type {
  DeadlineScheduler,
  PoolWorker,
  RegexCandidate,
  WorkerScanTask,
} from '../../src/detection-engine/scan-worker-pool.js';

/* Worker-thread execution mode for the native regex scan deadline
 * (detectionScanWorkerPool). The pool's main-thread machinery is exercised
 * with deterministic fakes (injected worker factory, injected deadline
 * scheduler), so no test races a real timer; the real-worker integration
 * lives in sus-patterns-worker-pool.test.ts and the worker-threads-
 * unavailable fallback in scan-worker-pool-unavailable.test.ts. */

class FakeWorker implements PoolWorker {
  readonly posted: unknown[] = [];
  terminated = false;
  private messageListener: ((message: unknown) => void) | null = null;
  private errorListener: ((error: unknown) => void) | null = null;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  async terminate(): Promise<unknown> {
    this.terminated = true;
    return null;
  }

  onMessage(listener: (message: unknown) => void): void {
    this.messageListener = listener;
  }

  onError(listener: (error: unknown) => void): void {
    this.errorListener = listener;
  }

  deliver(candidates: RegexCandidate[]): void {
    this.messageListener?.({ candidates });
  }

  fail(): void {
    this.errorListener?.(new Error('corpus worker error'));
  }
}

/* Deliver to every live worker in spawn order: only the worker holding the
   active dispatch's waiter consumes the answer, so tests never need to know
   which slot a replacement landed in. */
function deliverToAll(workers: FakeWorker[], candidates: RegexCandidate[]): void {
  for (const worker of workers) {
    if (!worker.terminated) worker.deliver(candidates);
  }
}

function manualScheduler(): { schedule: DeadlineScheduler; fireAll: () => void } {
  const pending: Array<() => void> = [];
  return {
    schedule: (_ms, fire) => {
      pending.push(fire);
      return () => {};
    },
    fireAll: () => {
      while (pending.length > 0) (pending.shift() as () => void)();
    },
  };
}

interface Harness {
  pool: WorkerScanPool;
  workers: FakeWorker[];
  fireAll: () => void;
}

function harness(size: number, deadlineMs = 2000): Harness {
  const workers: FakeWorker[] = [];
  const { schedule, fireAll } = manualScheduler();
  const pool = new WorkerScanPool(deadlineMs, {
    size,
    schedule,
    spawn: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { pool, workers, fireAll };
}

const XSS_TASK: WorkerScanTask = {
  patternSource: '<script[^>]*>[^<]*<\\/script\\s*>',
  flags: 'gi',
  content: 'x<script>alert(1)</script>y',
};

function scriptCandidate(index = 1): RegexCandidate {
  return { text: '<script>alert(1)</script>', index, groups: ['<script>alert(1)</script>'] };
}

async function dispatched(pending: Promise<unknown>): Promise<void> {
  await Promise.race([pending, new Promise<void>((resolve) => setImmediate(resolve))]);
}

describe('worker scan pool', () => {
  test('pool is bounded at the reference shared-pool size', () => {
    const { pool, workers } = harness(WORKER_POOL_SIZE);
    expect(pool.poolSize).toBe(WORKER_POOL_SIZE);
    expect(workers).toHaveLength(WORKER_POOL_SIZE);
    expect(pool.aliveWorkers()).toBe(WORKER_POOL_SIZE);
    expect(MAX_CANDIDATES_PER_SCAN).toBeGreaterThan(0);
  });

  test('a completed scan maps the candidates on the calling thread', async () => {
    const { pool, workers } = harness(1);
    const pending = pool.run('p', XSS_TASK, (candidates) => candidates[0]?.text ?? 'none');
    await dispatched(pending);
    (workers[0] as FakeWorker).deliver([scriptCandidate()]);
    const outcome = await pending;
    expect(outcome.status).toBe('completed');
    expect(outcome.value).toBe('<script>alert(1)</script>');
    expect(pool.consecutiveTimeoutCount).toBe(0);
  });

  test('a worker error yields an error outcome without counting a timeout', async () => {
    const { pool, workers } = harness(1);
    const pending = pool.run('p', XSS_TASK, () => null);
    await dispatched(pending);
    (workers[0] as FakeWorker).fail();
    const outcome = await pending;
    expect(outcome.status).toBe('error');
    expect(pool.consecutiveTimeoutCount).toBe(0);
  });

  test('a mapping failure surfaces as an error outcome', async () => {
    const { pool, workers } = harness(1);
    const pending = pool.run('p', XSS_TASK, () => {
      throw new Error('corpus map failure');
    });
    await dispatched(pending);
    (workers[0] as FakeWorker).deliver([scriptCandidate()]);
    const outcome = await pending;
    expect(outcome.status).toBe('error');
  });

  test('the deadline terminates the worker, replaces it and reports a timeout', async () => {
    const { pool, workers, fireAll } = harness(2);
    const stale = workers[0] as FakeWorker;
    const pending = pool.run('p', XSS_TASK, () => null);
    fireAll();
    const outcome = await pending;
    expect(outcome.status).toBe('timeout');
    expect(stale.terminated).toBe(true);
    expect(pool.aliveWorkers()).toBe(2);
    expect(pool.consecutiveTimeoutCount).toBe(1);
    expect(workers).toHaveLength(3);
    expect(workers.filter((worker) => !worker.terminated)).toHaveLength(2);
  });

  test('SCAN_POOL_SIZE consecutive timeouts replace the whole pool', async () => {
    const { pool, workers, fireAll } = harness(WORKER_POOL_SIZE);
    const events: string[] = [];
    pool.onPoolEvent((event) => events.push(event.type));
    const original = [...workers];

    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      const pending = pool.run(`p${i}`, XSS_TASK, () => null);
      fireAll();
      expect((await pending).status).toBe('timeout');
    }

    expect(events).toContain('pool_replaced');
    expect(pool.consecutiveTimeoutCount).toBe(0);
    expect(original.every((worker) => worker.terminated)).toBe(true);
    expect(pool.aliveWorkers()).toBe(WORKER_POOL_SIZE);
  });

  test('a scan never accumulates past the pool size without a replacement', async () => {
    /* At the reference size (4), the 4th consecutive timeout is the
       replacement trigger; three still leave the pool intact. */
    const { pool, workers, fireAll } = harness(WORKER_POOL_SIZE);
    for (let i = 0; i < WORKER_POOL_SIZE - 1; i++) {
      const pending = pool.run(`p${i}`, XSS_TASK, () => null);
      fireAll();
      await pending;
    }
    expect(pool.consecutiveTimeoutCount).toBe(WORKER_POOL_SIZE - 1);
    /* Every timed-out worker was individually replaced: the pool never
       shrank and never needed the whole-pool swap yet. */
    expect(pool.aliveWorkers()).toBe(WORKER_POOL_SIZE);
    expect(workers).toHaveLength(2 * WORKER_POOL_SIZE - 1);
  });

  test('one successful scan resets the consecutive-timeout counter', async () => {
    const { pool, workers, fireAll } = harness(2);
    const events: string[] = [];
    pool.onPoolEvent((event) => events.push(event.type));

    const timeoutPending = pool.run('p0', XSS_TASK, () => null);
    fireAll();
    await timeoutPending;
    expect(pool.consecutiveTimeoutCount).toBe(1);

    const successPending = pool.run('ok', XSS_TASK, () => 'ok');
    await dispatched(successPending);
    deliverToAll(workers, [scriptCandidate()]);
    expect((await successPending).status).toBe('completed');
    expect(pool.consecutiveTimeoutCount).toBe(0);

    const nextTimeout = pool.run('q0', XSS_TASK, () => null);
    fireAll();
    await nextTimeout;
    /* The two timeouts were isolated by the success in between: two worker
       replacements, never the whole-pool swap. */
    expect(events).toEqual(['worker_replaced', 'worker_replaced']);
    expect(events.filter((event) => event === 'pool_replaced')).toHaveLength(0);
  });

  test('dispatches beyond the pool size queue FIFO and drain in order', async () => {
    const { pool, workers } = harness(1);
    const first = pool.run('first', XSS_TASK, (candidates) => `first:${candidates.length}`);
    const second = pool.run('second', XSS_TASK, (candidates) => `second:${candidates[0]?.index ?? -1}`);
    await dispatched(first);
    (workers[0] as FakeWorker).deliver([scriptCandidate()]);
    expect((await first).value).toBe('first:1');
    await dispatched(second);
    (workers[0] as FakeWorker).deliver([scriptCandidate(2)]);
    expect((await second).value).toBe('second:2');
  });

  test('close() terminates every worker and errors queued dispatches', async () => {
    const { pool, workers } = harness(2);
    const queued = pool.run('queued', XSS_TASK, () => null);
    await pool.close();
    expect((await queued).status).toBe('error');
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    const afterClose = await pool.run('after', XSS_TASK, () => null);
    expect(afterClose.status).toBe('error');
  });

  test('the config knob is opt-in and defaults to false', () => {
    expect(SecurityConfigSchema.parse({}).detectionScanWorkerPool).toBe(false);
    expect(SecurityConfigSchema.parse({ detectionScanWorkerPool: true }).detectionScanWorkerPool).toBe(true);
  });
});

describe('real worker_threads spawn', () => {
  test('node worker_threads build a working pool on this runtime', async () => {
    const pool = await createWorkerScanPool(5000);
    expect(pool).not.toBeNull();
    const built = pool as WorkerScanPool;
    const outcome = await built.run('p', XSS_TASK, (candidates) => candidates.length);
    expect(outcome.status).toBe('completed');
    expect(outcome.value).toBe(1);
    await built.close();
  });
});
