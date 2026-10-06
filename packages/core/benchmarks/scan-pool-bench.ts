/* M6 evidence benchmark: the default scan execution path (deadline-bounded
   synchronous fallback with pattern quarantine) against the opt-in worker
   pool (detectionScanWorkerPool: true), over one realistic + adversarial
   corpus. NOT run by `pnpm test`; run it explicitly:

     pnpm --filter @guardcore/core bench

   Reading the results (the default decision is evidence-based, not dogma):

   - wallTimeMs: total time to scan the corpus sequentially. The worker
     pool pays per-scan message marshaling, so the inline path is expected
     to win raw throughput on small or mostly-benign payloads.
   - maxMainThreadStallMs: the longest single event-loop freeze observed
     while scanning (a 5 ms probe timer measures the drift). The inline
     path runs every regex candidate on the main thread, so one slow scan
     freezes the loop for its full duration; the pool offloads the
     candidate loop to workers and the main thread only awaits. In a
     request-serving process that stall IS tail latency for unrelated
     requests, and the per-scan verdict deadline (detectionCompilerTimeout,
     default 2s) bounds how long a single inline stall can hold the loop.

   Neither number alone switches the default; the benchmark exists so the
   decision is grounded in measured cost on this corpus. */

import { performance } from 'node:perf_hooks';
import { SusPatternsManager } from '../src/handlers/sus-patterns.js';
import { SecurityConfigSchema } from '../src/models/config.js';
import { defaultLogger } from '../src/models/logger.js';

function buildCorpus(): string[] {
  const payloads: string[] = [];

  /* Realistic benign traffic: medium JSON and urlencoded bodies. */
  for (let i = 0; i < 12; i++) {
    const items: string[] = [];
    for (let j = 0; j < 40; j++) {
      items.push(`{"name":"widget-${i}-${j}","desc":"a perfectly ordinary product description","qty":${j}}`);
    }
    payloads.push(items.join(','));
  }
  for (let i = 0; i < 6; i++) {
    payloads.push(
      Array.from({ length: 200 }, (_, j) => `field_${j}=${'lorem ipsum dolor '.repeat(4)}`).join('&'),
    );
  }

  /* Adversarial shapes: long token runs and nested-quote payloads that
     stress the full-content candidate loops. The per-scan verdict deadline
     keeps both paths bounded; the point is measuring the cost profile. */
  payloads.push(`${'a'.repeat(60_000)}SELECT${'a'.repeat(60_000)}`);
  payloads.push(`${"' OR ".repeat(4_000)}1=1`);
  payloads.push(`${'../../'.repeat(8_000)}etc/passwd`);
  payloads.push(`${'<script>alert('.repeat(3_000)}x)`);
  payloads.push(`${'{"$gt":'.repeat(2_000)}1`);

  return payloads;
}

interface StallProbe {
  stop(): number;
}

/* 5ms probe timer: when the event loop freezes, the timer fires late and
   the gap beyond 5ms is the stall duration. Returns the worst stall seen. */
function startStallProbe(): StallProbe {
  let worst = 0;
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    const elapsed = now - last;
    if (elapsed - 5 > worst) worst = elapsed - 5;
    last = now;
  }, 5);
  return {
    stop(): number {
      clearInterval(timer);
      const now = performance.now();
      const elapsed = now - last;
      if (elapsed - 5 > worst) worst = elapsed - 5;
      return Math.round(worst);
    },
  };
}

async function measure(manager: SusPatternsManager, corpus: string[]): Promise<{
  wallTimeMs: number;
  maxMainThreadStallMs: number;
}> {
  const probe = startStallProbe();
  const start = performance.now();
  for (const payload of corpus) {
    await manager.detect(payload, '203.0.113.9', 'request_body');
  }
  const wallTimeMs = Math.round(performance.now() - start);
  const maxMainThreadStallMs = probe.stop();
  return { wallTimeMs, maxMainThreadStallMs };
}

async function main(): Promise<void> {
  const corpus = buildCorpus();
  const inlineManager = new SusPatternsManager(
    SecurityConfigSchema.parse({ detectionScanWorkerPool: false }),
    defaultLogger,
  );
  const pooledManager = new SusPatternsManager(
    SecurityConfigSchema.parse({ detectionScanWorkerPool: true }),
    defaultLogger,
  );

  /* Warmup: compiles the canonical pattern table and (pooled) spins up the
     worker pool so the measurement is steady state, not startup. */
  await inlineManager.detect(corpus[0], '203.0.113.9', 'request_body');
  await pooledManager.detect(corpus[0], '203.0.113.9', 'request_body');

  const inline = await measure(inlineManager, corpus);
  const pooled = await measure(pooledManager, corpus);

  console.log(`corpus: ${corpus.length} payloads (${corpus.reduce((n, p) => n + p.length, 0)} bytes)`);
  console.log('');
  console.log('inline deadline-bounded fallback (default):');
  console.log(`  wall time              : ${inline.wallTimeMs} ms`);
  console.log(`  max main-thread stall  : ${inline.maxMainThreadStallMs} ms`);
  console.log('opt-in worker pool (detectionScanWorkerPool: true):');
  console.log(`  wall time              : ${pooled.wallTimeMs} ms`);
  console.log(`  max main-thread stall  : ${pooled.maxMainThreadStallMs} ms`);

  process.exit(0);
}

void main();
