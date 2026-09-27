import { expect, test } from 'vitest';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import {
  BASELINE_UPDATE_ENV,
  buildBaseline,
  classifyRuns,
  diffCase,
  loadCorpus,
  mapConfigKnobs,
  readBaseline,
  renderReport,
  runCase,
  writeBaseline,
} from './harness.js';
import type { CaseRun } from './harness.js';

test(
  'detect() matches the vendored guard-core spec 4.1.0 corpus under the committed baseline',
  { timeout: 600_000 },
  async () => {
    const corpus = await loadCorpus();
    const { mapped, unmapped } = mapConfigKnobs(corpus.index.config_knobs);
    const manager = new SusPatternsManager(SecurityConfigSchema.parse(mapped), defaultLogger);
    const runs: CaseRun[] = [];
    for (const suite of corpus.suites) {
      for (const corpusCase of suite.cases) {
        const actual = await runCase(manager, corpusCase);
        runs.push({ suite: suite.suite, id: corpusCase.id, diffs: diffCase(corpusCase.expected, actual) });
      }
    }
    if (process.env[BASELINE_UPDATE_ENV] === '1') {
      const baseline = buildBaseline(runs, corpus.corpus_sha256);
      await writeBaseline(baseline);
      const { outcomes } = classifyRuns(runs, baseline, corpus.corpus_sha256);
      console.log(
        `${renderReport(outcomes, [], unmapped)}\n\nbaseline regenerated at conformance/baseline.json; commit it together with the corpus change that required it`,
      );
      return;
    }
    const baseline = await readBaseline();
    const { outcomes, drifts } = classifyRuns(runs, baseline, corpus.corpus_sha256);
    console.log(renderReport(outcomes, drifts, unmapped));
    const driftDetail = drifts.map((drift) => `${drift.kind} ${drift.suite}/${drift.id}: ${drift.detail}`).join('\n');
    expect(
      drifts,
      `conformance drift detected (fail-closed):\n${driftDetail}\nif this follows an intentional corpus or engine change, regenerate the baseline with:\n  ${BASELINE_UPDATE_ENV}=1 pnpm --filter @guardcore/core exec vitest run tests/conformance`,
    ).toEqual([]);
  },
);
