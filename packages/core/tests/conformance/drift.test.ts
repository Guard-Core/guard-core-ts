import { describe, expect, test } from 'vitest';
import {
  ConformanceError,
  KNOB_MAP,
  buildBaseline,
  classifyRuns,
  diffCase,
  expectedThreatKey,
  mapConfigKnobs,
  round6,
  threatMultisetEqual,
  tsThreatKey,
  verifyCorpusIndex,
} from './harness.js';
import type { Baseline, CaseRun, CorpusIndex, ExpectedResult, ExpectedThreat, TsResult } from './harness.js';

const SCRIPT_PATTERN = '<script[^>]*>[^<]*<\\/script\\s*>';

const scriptExpected: ExpectedResult = {
  is_threat: true,
  threat_score: 1.0,
  threats: [{ type: 'regex', pattern: SCRIPT_PATTERN, match: '<script>alert(1)</script>' }],
  original_length: 25,
  processed_length: 25,
  detection_method: 'enhanced',
};

const scriptActual: TsResult = {
  isThreat: true,
  threatScore: 1.0,
  threats: [{ pattern: SCRIPT_PATTERN, matchedContent: '<script>alert(1)</script>', detectionMethod: 'regex' }],
  originalLength: 25,
  processedLength: 25,
};

function run(suite: string, id: string, diffs: string[] = []): CaseRun {
  return { suite, id, diffs };
}

function baselineOf(overrides: Partial<Baseline> = {}): Baseline {
  const failing_cases = overrides.failing_cases ?? {};
  return {
    spec_version: '4.1.0',
    corpus_sha256: 'digest-current',
    failing_cases,
    total_expected_fail: Object.values(failing_cases).reduce((total, ids) => total + ids.length, 0),
    ...overrides,
  };
}

function corpusIndexOf(specVersion: string): CorpusIndex {
  return { spec_version: specVersion, config_knobs: {}, suites: {} };
}

describe('float and threat comparison rules', () => {
  test('round6 compares floats at 6-decimal precision, half away from zero', () => {
    expect(round6(1.0)).toBe(1.0);
    expect(round6(0.8749999999)).toBe(0.875);
    expect(round6(1.0000004)).toBe(1.0);
    expect(round6(0.0000015)).toBe(0.000002);
    expect(round6(-0.0000015)).toBe(-0.000002);
  });

  test('treats a threat score within 6 decimals as equal', () => {
    expect(diffCase({ ...scriptExpected, threat_score: 0.8749999999 }, { ...scriptActual, threatScore: 0.875 })).toEqual([]);
  });

  test('compares threats order-insensitively as a multiset', () => {
    const first = scriptActual.threats[0];
    const second = { pattern: 'UNION\\s+(?:ALL\\s+)?SELECT', matchedContent: 'UNION SELECT', detectionMethod: 'regex' };
    if (!first) throw new ConformanceError('test fixture is missing the first threat');
    const expected: ExpectedThreat[] = [
      { type: 'regex', pattern: second.pattern, match: second.matchedContent },
      { type: 'regex', pattern: first.pattern, match: first.matchedContent },
    ];
    expect(threatMultisetEqual([first, second], expected)).toBe(true);
    expect(threatMultisetEqual([second, first], expected)).toBe(true);
  });

  test('treats differing matches or differing counts as unequal', () => {
    const first = scriptActual.threats[0];
    if (!first) throw new ConformanceError('test fixture is missing the first threat');
    expect(
      threatMultisetEqual([{ ...first, matchedContent: '<script>alert(2)</script>' }], [{ type: 'regex', pattern: SCRIPT_PATTERN, match: '<script>alert(1)</script>' }]),
    ).toBe(false);
    expect(threatMultisetEqual([first, first], [{ type: 'regex', pattern: SCRIPT_PATTERN, match: '<script>alert(1)</script>' }])).toBe(false);
  });

  test('pairs TS semantic threats with corpus semantic threats on attack_type', () => {
    const tsSemantic = { pattern: 'semantic:template', matchedContent: 'score=1.000', detectionMethod: 'semantic' };
    const corpusSemantic: ExpectedThreat = { type: 'semantic', attack_type: 'template' };
    expect(tsThreatKey(tsSemantic)).toBe('type=semantic|attack_type=template');
    expect(expectedThreatKey(corpusSemantic)).toBe('type=semantic|attack_type=template');
    expect(threatMultisetEqual([tsSemantic], [corpusSemantic])).toBe(true);
    expect(threatMultisetEqual([{ ...tsSemantic, pattern: 'semantic:sql' }], [corpusSemantic])).toBe(false);
  });

  test('reports is_threat, threat_score and processed_length differences', () => {
    expect(diffCase({ ...scriptExpected, is_threat: false }, scriptActual)).toHaveLength(1);
    expect(diffCase({ ...scriptExpected, threat_score: 0.5 }, scriptActual)).toHaveLength(1);
    const processedLengthDiff = diffCase({ ...scriptExpected, processed_length: 41 }, scriptActual);
    expect(processedLengthDiff).toHaveLength(1);
    expect(processedLengthDiff[0]).toContain('processed_length: expected 41, got 25');
    const threatDiff = diffCase(scriptExpected, { ...scriptActual, threats: [] });
    expect(threatDiff).toHaveLength(1);
    expect(threatDiff[0]).toContain('threats: got []');
  });

  test('accepts an exact match', () => {
    expect(diffCase(scriptExpected, scriptActual)).toEqual([]);
  });
});

describe('config knob mapping', () => {
  test('maps every expressible knob and records the knobs the TS engine cannot express', () => {
    const knobs: Record<string, number | boolean> = {};
    for (const knob of Object.keys(KNOB_MAP)) knobs[knob] = 1;
    const { mapped, unmapped } = mapConfigKnobs(knobs);
    const expectedMapped = Object.values(KNOB_MAP).filter((spec) => spec.config_knob !== null).length;
    expect(Object.keys(mapped)).toHaveLength(expectedMapped);
    expect(unmapped).toHaveLength(Object.keys(KNOB_MAP).length - expectedMapped);
    for (const knob of unmapped) {
      expect(knob.note.length).toBeGreaterThan(0);
      expect(mapped).not.toHaveProperty(knob.knob);
    }
  });

  test('routes knob values to their TS config names', () => {
    const { mapped } = mapConfigKnobs({ detection_compiler_timeout: 2.0, detection_semantic_threshold: 0.7 });
    expect(mapped).toEqual({ detectionCompilerTimeout: 2.0, detectionSemanticThreshold: 0.7 });
  });

  test('rejects a corpus knob with no mapping instead of skipping it', () => {
    expect(() => mapConfigKnobs({ detection_unknown_knob: 1 })).toThrow(ConformanceError);
  });
});

describe('corpus index verification', () => {
  test('accepts the targeted spec version', () => {
    expect(() => verifyCorpusIndex(corpusIndexOf('4.1.0'))).not.toThrow();
  });

  test('aborts on a corpus pinned to another spec version', () => {
    expect(() => verifyCorpusIndex(corpusIndexOf('4.0.1'))).toThrow(/spec_version mismatch/);
  });
});

describe('baseline bookkeeping', () => {
  test('records failing case ids per suite, sorted, with a matching total', () => {
    const baseline = buildBaseline(
      [run('xss', 'b', ['boom']), run('xss', 'a', ['boom']), run('sqli', 'c'), run('sqli', 'd', ['boom'])],
      'digest-current',
    );
    expect(baseline.failing_cases).toEqual({ xss: ['a', 'b'], sqli: ['d'] });
    expect(baseline.total_expected_fail).toBe(3);
    expect(baseline.corpus_sha256).toBe('digest-current');
  });

  test('marks a failing case listed in the baseline as expected-fail with no drift', () => {
    const baseline = baselineOf({ failing_cases: { xss: ['script_alert'] } });
    const { outcomes, drifts } = classifyRuns([run('xss', 'script_alert', ['is_threat: expected true, got false'])], baseline, 'digest-current');
    expect(outcomes).toEqual([{ suite: 'xss', id: 'script_alert', diffs: ['is_threat: expected true, got false'], status: 'expected_fail' }]);
    expect(drifts).toEqual([]);
  });

  test('fails a case that regresses without being listed', () => {
    const baseline = baselineOf({ failing_cases: { xss: ['still_broken'] } });
    const { outcomes, drifts } = classifyRuns(
      [run('xss', 'script_alert', ['threats: got [], expected [regex]']), run('xss', 'still_broken', ['is_threat: expected true, got false'])],
      baseline,
      'digest-current',
    );
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]?.status).toBe('failed');
    expect(outcomes[1]?.status).toBe('expected_fail');
    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.kind).toBe('new_failure');
    expect(drifts[0]?.id).toBe('script_alert');
  });

  test('fails a case that passes while listed as expected-fail', () => {
    const baseline = baselineOf({ failing_cases: { xss: ['script_alert'] } });
    const { outcomes, drifts } = classifyRuns([run('xss', 'script_alert')], baseline, 'digest-current');
    expect(outcomes[0]?.status).toBe('passed');
    expect(drifts).toHaveLength(1);
    expect(drifts[0]?.kind).toBe('stale_expected_fail');
  });

  test('fails when the baseline lists a case the corpus does not contain', () => {
    const baseline = baselineOf({ failing_cases: { xss: ['ghost_case'], sqli: ['sqli_ghost'] } });
    const { drifts } = classifyRuns([run('xss', 'script_alert')], baseline, 'digest-current');
    expect(drifts.map((drift) => drift.kind)).toEqual(['unknown_baseline_case', 'unknown_baseline_case']);
  });

  test('fails when the corpus digest changes under the baseline', () => {
    const baseline = baselineOf({ corpus_sha256: 'digest-old' });
    const { drifts } = classifyRuns([run('xss', 'script_alert')], baseline, 'digest-current');
    expect(drifts.map((drift) => drift.kind)).toContain('baseline_corpus_digest_change');
  });

  test('fails when the baseline targets another spec version', () => {
    const baseline = baselineOf({ spec_version: '4.0.1' });
    const { drifts } = classifyRuns([run('xss', 'script_alert')], baseline, 'digest-current');
    expect(drifts.map((drift) => drift.kind)).toContain('baseline_spec_version_change');
  });

  test('fails when the baseline total disagrees with the listed ids', () => {
    const baseline = baselineOf({ failing_cases: { xss: ['script_alert'] }, total_expected_fail: 5 });
    const { drifts } = classifyRuns([run('xss', 'script_alert')], baseline, 'digest-current');
    expect(drifts.map((drift) => drift.kind)).toContain('baseline_total_mismatch');
  });

  test('passes a case that is neither failing nor listed', () => {
    const { outcomes, drifts } = classifyRuns([run('xss', 'script_alert')], baselineOf(), 'digest-current');
    expect(outcomes[0]?.status).toBe('passed');
    expect(drifts).toEqual([]);
  });
});
