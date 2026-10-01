import { expect, test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { PatternCompiler } from '../../src/detection-engine/compiler.js';
import {
  assertKindDriven,
  loadCorpusIndex,
  loadXfail,
  xfailPath,
  XfailLedger,
} from './suite-kinds.js';
import {
  loadPatternSafetySuite,
  patternSafetyBaselineReason,
  runPatternSafetyCase,
} from './pattern-safety-harness.js';
import type { PatternSafetyCase } from './pattern-safety-harness.js';

const BASELINE_UPDATE_ENV = 'GUARD_CONFORMANCE_UPDATE_BASELINE';

/* pattern_safety-kind conformance (spec 4.1.0): runs the suite safety_gates
   through the real TS pattern-safety seam and compares (safe, reason_class).
   Documented divergences live in conformance/ts_pattern_safety_xfail.json
   with the fail-closed drift semantics shared by the per-kind baselines:
   failing-not-listed is red, listed-but-passing is red, an entry that never
   ran is red, and a corpus kind with no driver is red. */

test(
  'pattern safety gates match the vendored guard-core spec 4.1.0 corpus under the committed baseline',
  { timeout: 600_000 },
  async () => {
    const index = await loadCorpusIndex();
    assertKindDriven(index, 'pattern_safety', ['safety_gates']);
    const suite = await loadPatternSafetySuite();
    const compiler = new PatternCompiler(2000, 1000);
    const updateBaseline = process.env[BASELINE_UPDATE_ENV] === '1';

    const ledger = new XfailLedger(updateBaseline ? {} : await loadXfail('pattern_safety'));
    const regenerated: Record<string, string> = {};
    for (const corpusCase of suite.cases) {
      const run = runPatternSafetyCase(compiler, corpusCase);
      const key = `${suite.name}/${corpusCase.id}`;
      if (updateBaseline) {
        if (run.diffs.length > 0) {
          regenerated[key] = patternSafetyBaselineReason(run, corpusCase as PatternSafetyCase);
        }
        continue;
      }
      ledger.record(key, run.diffs);
    }

    if (updateBaseline) {
      const payload = {
        spec_version: '4.1.0',
        _comment: 'Documented divergences of the TS pattern-safety chain against the reference '
          + 'safety_gates corpus. Fail-closed: a failing case NOT listed here is red; a listed case '
          + 'that now passes is red (stale baseline). The TS chain '
          + '(packages/core/src/detection-engine/compiler.ts validatePatternSafety) implements only the '
          + 'dangerous-construct gate, the compile check and the inline test-string probe; the five '
          + 'structural prefilters and the reach-probe cost arbiter have no TS port.',
        cases: regenerated,
      };
      await writeFile(xfailPath('pattern_safety'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      console.log(`pattern_safety baseline regenerated at conformance/ts_pattern_safety_xfail.json (${Object.keys(regenerated).length} entries)`);
      return;
    }

    ledger.finish('pattern_safety');
    expect(
      ledger.failures,
      `pattern_safety conformance drift:\n${ledger.failures.join('\n')}\nif this follows an intentional corpus or engine change, regenerate the baseline with:\n  ${BASELINE_UPDATE_ENV}=1 pnpm --filter @guardcore/core exec vitest run tests/conformance/pattern-safety-conformance.test.ts`,
    ).toEqual([]);
  },
);
