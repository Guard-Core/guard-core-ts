import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PatternCompiler } from '../../src/detection-engine/compiler.js';
import { CORPUS_DIR } from './suite-kinds.js';

/* pattern_safety-kind conformance harness (spec 4.1.0, suite safety_gates).

   Drives the real TS pattern-safety seam, PatternCompiler.validatePatternSafety
   (packages/core/src/detection-engine/compiler.ts), per corpus case and
   compares (safe, reason_class) per index.json comparison.pattern_safety_records:
   only the class is compared, never the numeric parts of host-measured
   reason strings.

   The TS chain is a strict subset of the reference chain
   (specs/04-detection.md "Pattern safety gates"):

   - dangerous-construct gate: TS DANGEROUS_PATTERNS (six hand-written
     regexes) approximates the reference _dangerous_construct_violation;
   - compile check: TS compileSync is a JS RegExp, so JS/Python syntax
     differences surface as honest divergences;
   - test-strings probe: TS times the strings inline with a 50 ms wall-clock
     threshold where the reference runs a killable subprocess probe with a
     0.05 s CPU threshold (the corpus test strings are tiny, so the verdict
     is stable on any host);
   - the five structural prefilters and the reach-probe cost arbiter have NO
     TS port: cost_verdict cases are therefore not executed at all (running
     the TS default probe would time an unrelated seam and drag wall clock
     into the verdict); they record the divergence deterministically. */

export type PatternSafetyMode = 'test_strings' | 'cost_verdict';

export interface PatternSafetyCase {
  id: string;
  input: {
    pattern: string;
    mode: PatternSafetyMode;
    test_strings?: string[];
    max_content_length?: number;
  };
  expected: {
    safe: boolean;
    reason_class: string;
  };
}

export interface PatternSafetySuite {
  suite: string;
  kind: string;
  cases: PatternSafetyCase[];
}

export function parsePatternSafetySuite(text: string, name: string): PatternSafetySuite {
  const obj = JSON.parse(text) as Record<string, unknown>;
  if (obj['suite'] !== name) {
    throw new Error(`${name}.json declares suite "${String(obj['suite'])}"`);
  }
  if (obj['kind'] !== 'pattern_safety') {
    throw new Error(`${name}.json declares kind "${String(obj['kind'])}", expected pattern_safety`);
  }
  if (!Array.isArray(obj['cases'])) {
    throw new Error(`${name}.json: "cases" must be an array`);
  }
  const cases = (obj['cases'] as Record<string, unknown>[]).map(parseCase);
  const seen = new Set<string>();
  for (const corpusCase of cases) {
    if (seen.has(corpusCase.id)) {
      throw new Error(`suite ${name} duplicates case id "${corpusCase.id}"`);
    }
    seen.add(corpusCase.id);
  }
  return { suite: name, kind: 'pattern_safety', cases };
}

function parseCase(value: Record<string, unknown>): PatternSafetyCase {
  const id = value['id'];
  const input = value['input'];
  const expected = value['expected'];
  if (typeof id !== 'string' || typeof input !== 'object' || input === null || typeof expected !== 'object' || expected === null) {
    throw new Error('pattern_safety case must carry id, input and expected objects');
  }
  const inputRecord = input as Record<string, unknown>;
  const mode = inputRecord['mode'];
  if (mode !== 'test_strings' && mode !== 'cost_verdict') {
    throw new Error(`case ${id}: unsupported pattern_safety mode "${String(mode)}"`);
  }
  const expectedRecord = expected as Record<string, unknown>;
  if (typeof expectedRecord['safe'] !== 'boolean' || typeof expectedRecord['reason_class'] !== 'string') {
    throw new Error(`case ${id}: expected must carry safe (boolean) and reason_class (string)`);
  }
  return {
    id,
    input: {
      pattern: inputRecord['pattern'] as string,
      mode,
      test_strings: Array.isArray(inputRecord['test_strings']) ? (inputRecord['test_strings'] as string[]) : undefined,
      max_content_length: typeof inputRecord['max_content_length'] === 'number' ? (inputRecord['max_content_length'] as number) : undefined,
    },
    expected: {
      safe: expectedRecord['safe'] as boolean,
      reason_class: expectedRecord['reason_class'] as string,
    },
  };
}

export async function loadPatternSafetySuite(): Promise<PatternSafetySuite> {
  const text = await readFile(path.join(CORPUS_DIR, 'safety_gates.json'), 'utf8');
  return parsePatternSafetySuite(text, 'safety_gates');
}

/* Map a TS validatePatternSafety reason string to the reference reason_class
   taxonomy (generate_safety_gates.py CLASS_RULES). Only classes the TS chain
   can actually produce are mapped; anything else stays unmapped and is
   reported verbatim. */
export function tsReasonToClass(reason: string): string {
  if (reason.startsWith('Pattern appears safe')) return 'safe';
  if (reason.startsWith('Pattern contains dangerous construct')) return 'dangerous_construct';
  if (reason.startsWith('Pattern validation failed')) return 'compile_failed';
  if (reason.startsWith('Pattern timed out on test string')) return 'probe_string_timeout';
  return 'unmapped_ts_reason';
}

const STRUCTURAL_CLASSES: ReadonlySet<string> = new Set([
  'structural_nested_unbounded',
  'structural_adjacent_broad',
  'structural_unreachable_terminator',
  'structural_literal_absorb',
  'structural_ambiguous_tail',
]);

export interface PatternSafetyRun {
  diffs: string[];
  observedSafe: boolean;
  observedClass: string;
}

/* Run one corpus case through the real TS seam. cost_verdict cases are not
   executed: the TS chain has no cost arbiter, and the closest TS behavior
   (the default-probe path over hardcoded strings) is a different seam with
   wall clock in the verdict. */
export function runPatternSafetyCase(compiler: PatternCompiler, corpusCase: PatternSafetyCase): PatternSafetyRun {
  if (corpusCase.input.mode === 'cost_verdict') {
    return {
      diffs: [
        'mode cost_verdict: the TS safety chain has no cost arbiter; PatternCompiler.validatePatternSafety '
        + '(packages/core/src/detection-engine/compiler.ts) exposes no max_content_length parameter and no '
        + 'reach-probe verdict, so the case was not executed (the reference over_budget verdict is '
        + 'host-measured and the TS surface cannot confirm or contradict it)',
      ],
      observedSafe: false,
      observedClass: 'no_cost_arbiter',
    };
  }

  let safe: boolean;
  let reason: string;
  try {
    const [verdictSafe, verdictReason] = compiler.validatePatternSafety(corpusCase.input.pattern, corpusCase.input.test_strings);
    safe = verdictSafe;
    reason = verdictReason;
  } catch (error: unknown) {
    safe = false;
    reason = `Pattern validation failed: ${String(error)}`;
  }
  const observedClass = tsReasonToClass(reason);

  const diffs: string[] = [];
  if (safe !== corpusCase.expected.safe) {
    diffs.push(`safe: expected ${corpusCase.expected.safe}, got ${safe}`);
  }
  if (observedClass !== corpusCase.expected.reason_class) {
    diffs.push(`reason_class: expected ${corpusCase.expected.reason_class}, got ${observedClass} (TS reason: ${reason})`);
  }
  return { diffs, observedSafe: safe, observedClass };
}

/* Baseline reason for one diverging case, tied to the TS source responsible
   for the gap (fail-closed baseline style of ts_pipeline_xfail.json). */
export function patternSafetyBaselineReason(run: PatternSafetyRun, corpusCase: PatternSafetyCase): string {
  if (corpusCase.input.mode === 'cost_verdict') {
    return 'no cost arbiter in the TS safety chain (compiler.ts validatePatternSafety has no max_content_length path)';
  }
  const got = run.observedClass;
  if (STRUCTURAL_CLASSES.has(corpusCase.expected.reason_class)) {
    return `no structural prefilters in the TS chain (the five _redos_structural_prefilters.py checks have no port in packages/core/src/detection-engine/compiler.ts): got ${got}`;
  }
  if (corpusCase.expected.reason_class === 'over_budget') {
    return `no cost arbiter in the TS chain (packages/core/src/detection-engine/compiler.ts): got ${got}`;
  }
  if (corpusCase.expected.reason_class === 'compile_failed' && got === 'safe') {
    return 'JS RegExp (compiler.ts compileSync) accepts a pattern Python re rejects: got safe';
  }
  if (corpusCase.expected.reason_class === 'safe' && got === 'compile_failed') {
    return 'JS RegExp (compiler.ts compileSync) rejects a pattern Python re accepts: got compile_failed';
  }
  if (corpusCase.expected.reason_class === 'dangerous_construct' && got === 'safe') {
    return 'TS DANGEROUS_PATTERNS gate (compiler.ts) is narrower than the reference dangerous-construct gate: got safe';
  }
  if (corpusCase.expected.reason_class === 'safe' && got === 'dangerous_construct') {
    return 'TS DANGEROUS_PATTERNS gate (compiler.ts) is broader than the reference dangerous-construct gate for this pattern: got dangerous_construct';
  }
  if (corpusCase.expected.reason_class === 'safe' && got === 'probe_string_timeout') {
    return 'TS inline probe (compiler.ts validatePatternSafety, 50 ms wall clock per string) rejected a test string the reference subprocess probe accepted';
  }
  return `divergence: ${run.diffs.join('; ')}`;
}
