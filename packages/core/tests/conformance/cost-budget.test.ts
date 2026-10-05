import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/index.js';

// Cost-budget conformance for the cost_bodies suite: verdict parity for
// large inputs is enforced by conformance.test.ts; this file enforces scan-
// cost ceilings so gross divergence from the reference can never pass
// silently. Ceilings are self-relative (index.json cost_budgets.method):
// the run measures its own best-of-N at the 8 KiB workload and every other
// workload must satisfy
//
//   best_ms <= K * best8_ms * (size_bytes / 8192) + floor_ms
//
// with K=5 and floor_ms=250, tolerating host speed and fixed overhead
// while catching superlinear scans.

const K = 5;

function threatOf(r: unknown): boolean {
  return Boolean((r as { is_threat?: boolean }).is_threat ?? (r as { isThreat?: boolean }).isThreat);
}
const FLOOR_MS = 250;

interface CostCase {
  id: string;
  input: { content: string; context: string };
  expected: { is_threat: boolean };
}

describe('cost_bodies scan-cost ceilings', () => {
  it('every workload stays under its self-relative linear ceiling', async () => {
    const casesPath = fileURLToPath(
      new URL('../../../../conformance/guard-core-spec-4.1.0/cases/', import.meta.url),
    );
    const index = JSON.parse(readFileSync(path.join(casesPath, 'index.json'), 'utf8'));
    expect(index.cost_budgets).toBeTruthy();
    const suite = JSON.parse(readFileSync(path.join(casesPath, 'cost_bodies.json'), 'utf8'));

    const config = SecurityConfigSchema.parse({});
    const manager = new SusPatternsManager(config, defaultLogger);

    const runs = (sizeBytes: number): number => {
      if (sizeBytes >= 256 * 1024) return 1;
      if (sizeBytes >= 64 * 1024) return 2;
      return 3;
    };

    const measured = new Map<string, { best: number; threat: boolean }>();
    for (const c of suite.cases as CostCase[]) {
      const result = await manager.detect(c.input.content, '203.0.113.7', c.input.context);
      expect(threatOf(result)).toBe(c.expected.is_threat);
      // warmup + timed samples via the async API
      const samples: number[] = [];
      const n = runs(c.input.content.length);
      for (let i = 0; i < n; i++) {
        const t0 = process.hrtime.bigint();
        await manager.detect(c.input.content, '203.0.113.7', c.input.context);
        const t1 = process.hrtime.bigint();
        samples.push(Number(t1 - t0) / 1e6);
      }
      measured.set(c.id, { best: Math.min(...samples), threat: threatOf(result) });
    }

    const best8 = measured.get('cost_prose_8kib')?.best ?? Number.POSITIVE_INFINITY;
    const overs: string[] = [];
    for (const c of suite.cases as CostCase[]) {
      const m = measured.get(c.id);
      expect(m).toBeTruthy();
      const ceiling = K * best8 * (c.input.content.length / 8192) + FLOOR_MS;
      const line = `${c.id}: best=${m!.best.toFixed(1)} ms ceiling=${ceiling.toFixed(1)} ms (size ${c.input.content.length})`;
      if (m!.best > ceiling) overs.push(line);
      else console.log(`cost budgets/${line}`);
    }
    expect(overs).toEqual([]);
  }, 300_000);
});
