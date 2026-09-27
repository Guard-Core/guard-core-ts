import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { SusPatternsManager } from '../../src/handlers/sus-patterns.js';

export const SPEC_VERSION = '4.1.0';
export const FIXED_IP = '203.0.113.7';
export const BASELINE_UPDATE_ENV = 'GUARD_CONFORMANCE_UPDATE_BASELINE';
export const BASELINE_PATH = fileURLToPath(new URL('../../../../conformance/baseline.json', import.meta.url));
const CORPUS_DIR = fileURLToPath(new URL('../../../../conformance/guard-core-spec-4.1.0/cases/', import.meta.url));
const SEMANTIC_PREFIX = 'semantic:';

export class ConformanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformanceError';
  }
}

export interface CorpusIndex {
  spec_version: string;
  config_knobs: Record<string, number | boolean>;
  suites: Record<string, { case_count: number; kind?: string }>;
}

export interface ExpectedThreat {
  type?: string;
  pattern?: string;
  match?: string;
  attack_type?: string;
}

export interface ExpectedResult {
  is_threat: boolean;
  threat_score: number;
  threats: ExpectedThreat[];
  original_length: number;
  processed_length: number;
  detection_method: string;
}

export interface ConformanceCase {
  id: string;
  input: { content: string; context: string };
  expected: ExpectedResult;
}

export interface SuiteData {
  suite: string;
  cases: ConformanceCase[];
}

export interface Corpus {
  index: CorpusIndex;
  suites: SuiteData[];
  corpus_sha256: string;
}

export interface TsThreat {
  pattern: string;
  matchedContent: string;
  detectionMethod: string;
}

export interface TsResult {
  isThreat: boolean;
  threatScore: number;
  threats: TsThreat[];
  originalLength: number;
  processedLength: number;
}

export type CaseStatus = 'passed' | 'expected_fail' | 'failed' | 'not_run';

export interface CaseRun {
  suite: string;
  id: string;
  diffs: string[];
}

export interface CaseOutcome {
  suite: string;
  id: string;
  diffs: string[];
  status: CaseStatus;
}

export type DriftKind =
  | 'new_failure'
  | 'stale_expected_fail'
  | 'unknown_baseline_case'
  | 'baseline_spec_version_change'
  | 'baseline_corpus_digest_change'
  | 'baseline_total_mismatch';

export interface Drift {
  kind: DriftKind;
  suite: string;
  id: string;
  detail: string;
}

export interface Baseline {
  spec_version: string;
  corpus_sha256: string;
  failing_cases: Record<string, string[]>;
  total_expected_fail: number;
}

export interface UnmappedKnob {
  knob: string;
  value: number | boolean;
  note: string;
}

interface KnobSpec {
  config_knob: string | null;
  note: string;
}

export const KNOB_MAP: Readonly<Record<string, KnobSpec>> = {
  detection_compiler_timeout: { config_knob: 'detectionCompilerTimeout', note: '' },
  detection_max_tracked_patterns: { config_knob: 'detectionMaxTrackedPatterns', note: '' },
  detection_max_content_length: { config_knob: 'detectionMaxContentLength', note: '' },
  detection_preserve_attack_patterns: { config_knob: 'detectionPreserveAttackPatterns', note: '' },
  detection_anomaly_threshold: { config_knob: 'detectionAnomalyThreshold', note: '' },
  detection_slow_pattern_threshold: { config_knob: 'detectionSlowPatternThreshold', note: '' },
  detection_monitor_history_size: { config_knob: 'detectionMonitorHistorySize', note: '' },
  detection_semantic_threshold: { config_knob: 'detectionSemanticThreshold', note: '' },
  detection_max_body_inspect_bytes: { config_knob: 'detectionMaxBodyInspectBytes', note: '' },
  detection_anomaly_emission_cooldown: {
    config_knob: null,
    note: 'PerformanceMonitor anomaly emission cooldown is not configurable in the TS config surface',
  },
  detection_min_samples_for_anomaly: {
    config_knob: null,
    note: 'PerformanceMonitor minimum sample count is not configurable in the TS config surface',
  },
  detection_threat_score_threshold: { config_knob: 'detectionThreatScoreThreshold', note: '' },
};

export const COMPARISON_GAPS: ReadonlyArray<string> = [
  'per-threat position, category and weight are not produced by the TS detect() surface and are excluded from threat comparison',
  'semantic probability and analysis are not produced by the TS detect() surface and are excluded from threat comparison',
  'top-level detection_method ("enhanced") has no TS equivalent and is not compared',
  'execution_time, timeout counts and correlation ids are excluded per corpus comparison rules',
];

export interface KnobMappingResult {
  mapped: Record<string, number | boolean>;
  unmapped: UnmappedKnob[];
}

export function mapConfigKnobs(knobs: Readonly<Record<string, number | boolean>>): KnobMappingResult {
  const mapped: Record<string, number | boolean> = {};
  const unmapped: UnmappedKnob[] = [];
  for (const [knob, value] of Object.entries(knobs)) {
    const spec = KNOB_MAP[knob];
    if (!spec) {
      throw new ConformanceError(`corpus knob "${knob}" has no mapping; extend KNOB_MAP in tests/conformance/harness.ts`);
    }
    if (spec.config_knob) {
      mapped[spec.config_knob] = value;
    } else {
      unmapped.push({ knob, value, note: spec.note });
    }
  }
  return { mapped, unmapped };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new ConformanceError(`${label} is not valid JSON: ${String(error)}`);
  }
  if (!isRecord(parsed)) throw new ConformanceError(`${label} is not a JSON object`);
  return parsed;
}

function requireString(obj: Record<string, unknown>, key: string, label: string): string {
  const value = obj[key];
  if (typeof value !== 'string') throw new ConformanceError(`${label}: "${key}" must be a string`);
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string, label: string): number {
  const value = obj[key];
  if (typeof value !== 'number') throw new ConformanceError(`${label}: "${key}" must be a number`);
  return value;
}

function requireBoolean(obj: Record<string, unknown>, key: string, label: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') throw new ConformanceError(`${label}: "${key}" must be a boolean`);
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

function parseKnobs(obj: Record<string, unknown>, label: string): Record<string, number | boolean> {
  const raw = obj['config_knobs'];
  if (!isRecord(raw)) throw new ConformanceError(`${label}: "config_knobs" must be an object`);
  const knobs: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' && typeof value !== 'boolean') {
      throw new ConformanceError(`${label}: config_knobs.${key} must be a number or boolean`);
    }
    knobs[key] = value;
  }
  return knobs;
}

function parseSuiteRegistry(obj: Record<string, unknown>, label: string): Record<string, { case_count: number; kind?: string }> {
  const raw = obj['suites'];
  if (!isRecord(raw)) throw new ConformanceError(`${label}: "suites" must be an object`);
  const suites: Record<string, { case_count: number; kind?: string }> = {};
  for (const [suite, entry] of Object.entries(raw)) {
    if (!isRecord(entry) || typeof entry['case_count'] !== 'number') {
      throw new ConformanceError(`${label}: suites.${suite} must be an object with a numeric case_count`);
    }
    const kind = typeof entry['kind'] === 'string' ? entry['kind'] : undefined;
    suites[suite] = { case_count: entry['case_count'], kind };
  }
  return suites;
}

export function parseCorpusIndex(text: string): CorpusIndex {
  const obj = parseJsonObject(text, 'index.json');
  return {
    spec_version: requireString(obj, 'spec_version', 'index.json'),
    config_knobs: parseKnobs(obj, 'index.json'),
    suites: parseSuiteRegistry(obj, 'index.json'),
  };
}

export function verifyCorpusIndex(index: CorpusIndex): void {
  if (index.spec_version !== SPEC_VERSION) {
    throw new ConformanceError(`spec_version mismatch: corpus pins ${index.spec_version}, runner targets ${SPEC_VERSION}`);
  }
}

function parseExpectedThreat(value: unknown): ExpectedThreat {
  if (!isRecord(value)) throw new ConformanceError('expected threat must be an object');
  const threat: ExpectedThreat = {};
  const type = optionalString(value, 'type');
  if (type !== undefined) threat.type = type;
  const pattern = optionalString(value, 'pattern');
  if (pattern !== undefined) threat.pattern = pattern;
  const match = optionalString(value, 'match');
  if (match !== undefined) threat.match = match;
  const attackType = optionalString(value, 'attack_type');
  if (attackType !== undefined) threat.attack_type = attackType;
  return threat;
}

function parseCase(value: unknown, suite: string): ConformanceCase {
  if (!isRecord(value)) throw new ConformanceError(`suite ${suite}: case must be an object`);
  const id = requireString(value, 'id', `suite ${suite} case`);
  const label = `case ${suite}/${id}`;
  const input = value['input'];
  if (!isRecord(input)) throw new ConformanceError(`${label}: "input" must be an object`);
  const expected = value['expected'];
  if (!isRecord(expected)) throw new ConformanceError(`${label}: "expected" must be an object`);
  const threatsRaw = expected['threats'];
  if (!isUnknownArray(threatsRaw)) throw new ConformanceError(`${label}: "threats" must be an array`);
  return {
    id,
    input: {
      content: requireString(input, 'content', label),
      context: requireString(input, 'context', label),
    },
    expected: {
      is_threat: requireBoolean(expected, 'is_threat', label),
      threat_score: requireNumber(expected, 'threat_score', label),
      threats: threatsRaw.map(parseExpectedThreat),
      original_length: requireNumber(expected, 'original_length', label),
      processed_length: requireNumber(expected, 'processed_length', label),
      detection_method: requireString(expected, 'detection_method', label),
    },
  };
}

function parseSuite(text: string, suiteName: string): SuiteData {
  const obj = parseJsonObject(text, `${suiteName}.json`);
  const declared = requireString(obj, 'suite', `${suiteName}.json`);
  if (declared !== suiteName) {
    throw new ConformanceError(`${suiteName}.json declares suite "${declared}"`);
  }
  const casesRaw = obj['cases'];
  if (!isUnknownArray(casesRaw)) throw new ConformanceError(`${suiteName}.json: "cases" must be an array`);
  const cases = casesRaw.map((value) => parseCase(value, suiteName));
  const seen = new Set<string>();
  for (const corpusCase of cases) {
    if (seen.has(corpusCase.id)) {
      throw new ConformanceError(`suite ${suiteName} duplicates case id "${corpusCase.id}"`);
    }
    seen.add(corpusCase.id);
  }
  return { suite: suiteName, cases };
}

export function corpusDigest(files: ReadonlyMap<string, string>): string {
  const hash = createHash('sha256');
  for (const name of [...files.keys()].sort()) {
    const fileSha256 = createHash('sha256').update(files.get(name) ?? '', 'utf8').digest('hex');
    hash.update(`${name}:${fileSha256}\n`);
  }
  return hash.digest('hex');
}

export async function loadCorpus(corpusDir: string = CORPUS_DIR): Promise<Corpus> {
  const entries = await readdir(corpusDir);
  const files = new Map<string, string>();
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    files.set(entry, await readFile(path.join(corpusDir, entry), 'utf8'));
  }
  if (!files.has('index.json')) {
    throw new ConformanceError(`corpus at ${corpusDir} has no index.json`);
  }
  const indexText = files.get('index.json') ?? '';
  const index = parseCorpusIndex(indexText);
  verifyCorpusIndex(index);
  const suites: SuiteData[] = [];
  for (const [file, text] of files) {
    if (file === 'index.json') continue;
    const suiteName = file.slice(0, -'.json'.length);
    const registered = index.suites[suiteName];
    if (!registered) {
      throw new ConformanceError(`${file} is not registered in index.json`);
    }
    if (registered.kind !== undefined && registered.kind !== 'detect') {
      // Pipeline-kind suites are consumed by the pipeline conformance test
      // through the full middleware; the detect runner skips them.
      continue;
    }
    const suite = parseSuite(text, suiteName);
    if (suite.cases.length !== registered.case_count) {
      throw new ConformanceError(`suite ${suiteName} has ${suite.cases.length} cases, index.json pins ${registered.case_count}`);
    }
    suites.push(suite);
  }
  for (const suiteName of Object.keys(index.suites)) {
    if (!files.has(`${suiteName}.json`)) {
      throw new ConformanceError(`suite ${suiteName} is registered in index.json but ${suiteName}.json is missing`);
    }
  }
  return { index, suites, corpus_sha256: corpusDigest(files) };
}

export function round6(value: number): number {
  const scaled = value * 1e6;
  return (scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled)) / 1e6;
}

export function semanticAttackType(pattern: string): string {
  return pattern.startsWith(SEMANTIC_PREFIX) ? pattern.slice(SEMANTIC_PREFIX.length) : 'unknown';
}

export function tsThreatKey(threat: TsThreat): string {
  if (threat.detectionMethod === 'semantic') {
    return `type=semantic|attack_type=${semanticAttackType(threat.pattern)}`;
  }
  return `type=${threat.detectionMethod}|pattern=${threat.pattern}|match=${threat.matchedContent}`;
}

export function expectedThreatKey(threat: ExpectedThreat): string {
  if (threat.type === 'semantic') {
    return `type=semantic|attack_type=${threat.attack_type ?? 'unknown'}`;
  }
  return `type=${threat.type ?? 'unknown'}|pattern=${threat.pattern ?? 'unknown'}|match=${threat.match ?? 'unknown'}`;
}

export function threatMultisetEqual(tsThreats: readonly TsThreat[], expectedThreats: readonly ExpectedThreat[]): boolean {
  if (tsThreats.length !== expectedThreats.length) return false;
  const counts = new Map<string, number>();
  for (const threat of tsThreats) {
    const key = tsThreatKey(threat);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const threat of expectedThreats) {
    const key = expectedThreatKey(threat);
    const remaining = counts.get(key) ?? 0;
    if (remaining === 0) return false;
    counts.set(key, remaining - 1);
  }
  return true;
}

export function diffCase(expected: ExpectedResult, actual: TsResult): string[] {
  const diffs: string[] = [];
  if (expected.is_threat !== actual.isThreat) {
    diffs.push(`is_threat: expected ${expected.is_threat}, got ${actual.isThreat}`);
  }
  if (round6(expected.threat_score) !== round6(actual.threatScore)) {
    diffs.push(`threat_score: expected ${round6(expected.threat_score)}, got ${round6(actual.threatScore)}`);
  }
  if (expected.original_length !== actual.originalLength) {
    diffs.push(`original_length: expected ${expected.original_length}, got ${actual.originalLength}`);
  }
  if (expected.processed_length !== actual.processedLength) {
    diffs.push(`processed_length: expected ${expected.processed_length}, got ${actual.processedLength}`);
  }
  if (!threatMultisetEqual(actual.threats, expected.threats)) {
    diffs.push(`threats: got ${summarizeTs(actual.threats)}, expected ${summarizeExpected(expected.threats)}`);
  }
  return diffs;
}

function shortPattern(pattern: string): string {
  return pattern.length > 48 ? `${pattern.slice(0, 45)}...` : pattern;
}

function summarizeTs(threats: readonly TsThreat[]): string {
  const parts = threats.map((threat) => {
    if (threat.detectionMethod === 'semantic') return `semantic/${semanticAttackType(threat.pattern)}`;
    return `${threat.detectionMethod}/${shortPattern(threat.pattern)}@"${shortPattern(threat.matchedContent)}"`;
  });
  return `[${parts.join('; ')}]`;
}

function summarizeExpected(threats: readonly ExpectedThreat[]): string {
  const parts = threats.map((threat) => {
    const label = threat.pattern ?? threat.attack_type ?? 'unknown';
    const where = threat.match !== undefined ? `"${shortPattern(threat.match)}"` : '?';
    return `${threat.type ?? 'unknown'}/${shortPattern(label)}@${where}`;
  });
  return `[${parts.join('; ')}]`;
}

export async function runCase(manager: SusPatternsManager, corpusCase: ConformanceCase): Promise<TsResult> {
  const result = await manager.detect(corpusCase.input.content, FIXED_IP, corpusCase.input.context);
  return {
    isThreat: result.isThreat,
    threatScore: result.threatScore,
    threats: result.threats.map((threat) => ({
      pattern: threat.pattern,
      matchedContent: threat.matchedContent,
      detectionMethod: threat.detectionMethod,
    })),
    originalLength: result.originalLength,
    processedLength: result.processedLength,
  };
}

export function buildBaseline(runs: readonly CaseRun[], corpusSha256: string): Baseline {
  const failing_cases: Record<string, string[]> = {};
  for (const run of runs) {
    if (run.diffs.length === 0) continue;
    const ids = failing_cases[run.suite] ?? [];
    ids.push(run.id);
    failing_cases[run.suite] = ids;
  }
  for (const ids of Object.values(failing_cases)) ids.sort();
  const total_expected_fail = Object.values(failing_cases).reduce((total, ids) => total + ids.length, 0);
  return { spec_version: SPEC_VERSION, corpus_sha256: corpusSha256, failing_cases, total_expected_fail };
}

export function serializeBaseline(baseline: Baseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

export async function readBaseline(baselinePath: string = BASELINE_PATH): Promise<Baseline> {
  let text: string;
  try {
    text = await readFile(baselinePath, 'utf8');
  } catch {
    throw new ConformanceError(`baseline manifest ${baselinePath} is missing; generate it with ${BASELINE_UPDATE_ENV}=1`);
  }
  const obj = parseJsonObject(text, 'baseline.json');
  const failingCasesRaw = obj['failing_cases'];
  if (!isRecord(failingCasesRaw)) throw new ConformanceError('baseline.json: "failing_cases" must be an object');
  const failing_cases: Record<string, string[]> = {};
  for (const [suite, idsRaw] of Object.entries(failingCasesRaw)) {
    if (!isUnknownArray(idsRaw)) {
      throw new ConformanceError(`baseline.json: failing_cases.${suite} must be an array of case ids`);
    }
    const ids: string[] = [];
    for (const id of idsRaw) {
      if (typeof id !== 'string') {
        throw new ConformanceError(`baseline.json: failing_cases.${suite} must contain only string case ids`);
      }
      ids.push(id);
    }
    failing_cases[suite] = ids;
  }
  return {
    spec_version: requireString(obj, 'spec_version', 'baseline.json'),
    corpus_sha256: requireString(obj, 'corpus_sha256', 'baseline.json'),
    failing_cases,
    total_expected_fail: requireNumber(obj, 'total_expected_fail', 'baseline.json'),
  };
}

export async function writeBaseline(baseline: Baseline, baselinePath: string = BASELINE_PATH): Promise<void> {
  await writeFile(baselinePath, serializeBaseline(baseline), 'utf8');
}

export function classifyRuns(
  runs: readonly CaseRun[],
  baseline: Baseline,
  corpusSha256: string,
): { outcomes: CaseOutcome[]; drifts: Drift[] } {
  const drifts: Drift[] = [];
  if (baseline.spec_version !== SPEC_VERSION) {
    drifts.push({
      kind: 'baseline_spec_version_change',
      suite: '*',
      id: '*',
      detail: `baseline pins spec ${baseline.spec_version}, runner targets ${SPEC_VERSION}`,
    });
  }
  if (baseline.corpus_sha256 !== corpusSha256) {
    drifts.push({
      kind: 'baseline_corpus_digest_change',
      suite: '*',
      id: '*',
      detail: `baseline corpus digest ${baseline.corpus_sha256} != corpus digest ${corpusSha256}`,
    });
  }
  const declaredTotal = Object.values(baseline.failing_cases).reduce((total, ids) => total + ids.length, 0);
  if (declaredTotal !== baseline.total_expected_fail) {
    drifts.push({
      kind: 'baseline_total_mismatch',
      suite: '*',
      id: '*',
      detail: `failing_cases lists ${declaredTotal} ids, total_expected_fail says ${baseline.total_expected_fail}`,
    });
  }
  const baselineFailing = new Set<string>();
  for (const [suite, ids] of Object.entries(baseline.failing_cases)) {
    for (const id of ids) baselineFailing.add(`${suite}/${id}`);
  }
  const outcomes: CaseOutcome[] = [];
  const runKeys = new Set<string>();
  for (const run of runs) {
    const key = `${run.suite}/${run.id}`;
    runKeys.add(key);
    const failing = run.diffs.length > 0;
    const listed = baselineFailing.has(key);
    const status: CaseStatus = failing && listed ? 'expected_fail' : failing ? 'failed' : 'passed';
    outcomes.push({ suite: run.suite, id: run.id, diffs: run.diffs, status });
    if (failing && !listed) {
      drifts.push({ kind: 'new_failure', suite: run.suite, id: run.id, detail: run.diffs.join('; ') });
    }
    if (!failing && listed) {
      drifts.push({ kind: 'stale_expected_fail', suite: run.suite, id: run.id, detail: 'case passes but is listed in the baseline' });
    }
  }
  for (const [suite, ids] of Object.entries(baseline.failing_cases)) {
    const corpusIds = new Set(runs.filter((run) => run.suite === suite).map((run) => run.id));
    for (const id of ids) {
      if (!corpusIds.has(id)) {
        drifts.push({ kind: 'unknown_baseline_case', suite, id, detail: 'baseline lists a case the corpus does not contain' });
      }
    }
  }
  return { outcomes, drifts };
}

export interface SuiteCounts {
  passed: number;
  expected_fail: number;
  failed: number;
  not_run: number;
}

export function countBySuite(outcomes: readonly CaseOutcome[]): Map<string, SuiteCounts> {
  const counts = new Map<string, SuiteCounts>();
  for (const outcome of outcomes) {
    const suite = counts.get(outcome.suite) ?? { passed: 0, expected_fail: 0, failed: 0, not_run: 0 };
    suite[outcome.status] += 1;
    counts.set(outcome.suite, suite);
  }
  return counts;
}

function renderCountsLine(label: string, counts: SuiteCounts): string {
  return `${label.padEnd(28)}${String(counts.passed).padStart(6)}  ${String(counts.expected_fail).padStart(5)}  ${String(counts.failed).padStart(6)}  ${String(counts.not_run).padStart(7)}`;
}

export function renderReport(
  outcomes: readonly CaseOutcome[],
  drifts: readonly Drift[],
  unmappedKnobs: readonly UnmappedKnob[],
): string {
  const lines: string[] = [];
  const totals: SuiteCounts = { passed: 0, expected_fail: 0, failed: 0, not_run: 0 };
  lines.push('suite                        passed  xfail  failed  not_run');
  const counts = [...countBySuite(outcomes).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [suite, suiteCounts] of counts) {
    totals.passed += suiteCounts.passed;
    totals.expected_fail += suiteCounts.expected_fail;
    totals.failed += suiteCounts.failed;
    totals.not_run += suiteCounts.not_run;
    lines.push(renderCountsLine(suite, suiteCounts));
  }
  lines.push(renderCountsLine('TOTAL', totals));
  if (unmappedKnobs.length > 0) {
    lines.push('', 'config knobs the TS engine cannot express:');
    for (const { knob, value, note } of unmappedKnobs) {
      lines.push(`  ${knob} = ${String(value)}: ${note}`);
    }
  }
  lines.push('', 'comparison gaps (engine surface, to be closed by the engine rework items):');
  for (const gap of COMPARISON_GAPS) {
    lines.push(`  ${gap}`);
  }
  if (drifts.length > 0) {
    lines.push('', `drift (${drifts.length}):`);
    for (const drift of drifts) {
      lines.push(`  ${drift.kind} ${drift.suite}/${drift.id}: ${drift.detail}`);
    }
  } else {
    lines.push('', 'drift: none');
  }
  const nonPassing = outcomes.filter((outcome) => outcome.status !== 'passed');
  if (nonPassing.length > 0) {
    lines.push('', `non-passing cases (${nonPassing.length}):`);
    for (const outcome of nonPassing) {
      if (outcome.status === 'failed') {
        lines.push(`  [failed] ${outcome.suite}/${outcome.id}`);
        for (const diff of outcome.diffs) {
          lines.push(`    ${diff}`);
        }
      } else {
        lines.push(`  [${outcome.status}] ${outcome.suite}/${outcome.id}`);
      }
    }
  }
  return lines.join('\n');
}
