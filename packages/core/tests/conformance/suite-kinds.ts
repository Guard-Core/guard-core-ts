import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* Shared plumbing for the three corpus kinds the detect and pipeline
   runners do not consume (kind pattern_safety, events, redis_interop):

   - suite loading against the index.json registry (kind, case_count pin);
   - the fail-closed per-kind xfail baselines
     (conformance/ts_<kind>_xfail.json): a failing case NOT listed is red,
     a listed case that passes is red (stale), a listed case that never ran
     is red, and a corpus kind with no driver is red;
   - the volatile-field envelope normalization shared by the events kind
     (index.json comparison.events_volatile_fields). */

export const SPEC_VERSION = '4.1.0';
export const CORPUS_DIR = fileURLToPath(
  new URL('../../../../conformance/guard-core-spec-4.1.0/cases/', import.meta.url),
);

/* Every suite kind the corpus may declare, and the runner that consumes it.
   A kind appearing in index.json but missing here means a suite no driver
   consumes: the conformance gate must go red instead of skipping it. */
export const KNOWN_KINDS: Readonly<Record<string, string>> = {
  detect: 'conformance.test.ts (detect runner)',
  pipeline: 'pipeline-conformance.test.ts (pipeline runner)',
  pattern_safety: 'safety-gates-conformance.test.ts',
  events: 'events-conformance.test.ts',
  redis_interop: 'redis-interop-conformance.test.ts',
};

export interface SuiteIndexMeta {
  case_count: number;
  kind?: string;
  consumers?: string[];
}

export interface CorpusIndexMeta {
  spec_version: string;
  suites: Record<string, SuiteIndexMeta>;
}

export async function loadCorpusIndex(): Promise<CorpusIndexMeta> {
  const text = await readFile(path.join(CORPUS_DIR, 'index.json'), 'utf8');
  const obj = JSON.parse(text) as { spec_version?: unknown; suites?: unknown };
  if (obj.spec_version !== SPEC_VERSION) {
    throw new Error(`index.json pins spec ${String(obj.spec_version)}, runner targets ${SPEC_VERSION}`);
  }
  if (typeof obj.suites !== 'object' || obj.suites === null) {
    throw new Error('index.json: "suites" must be an object');
  }
  const suites: Record<string, SuiteIndexMeta> = {};
  for (const [suite, meta] of Object.entries(obj.suites as Record<string, unknown>)) {
    if (typeof meta !== 'object' || meta === null) {
      throw new Error(`index.json: suites.${suite} must be an object`);
    }
    const record = meta as Record<string, unknown>;
    if (typeof record['case_count'] !== 'number') {
      throw new Error(`index.json: suites.${suite}.case_count must be a number`);
    }
    suites[suite] = {
      case_count: record['case_count'],
      kind: typeof record['kind'] === 'string' ? record['kind'] : undefined,
      consumers: Array.isArray(record['consumers']) ? (record['consumers'] as string[]) : undefined,
    };
  }
  return { spec_version: obj.spec_version, suites };
}

/* Driverless = red: every kind in the index must be one a runner consumes,
   and this suite's own kind must still be registered (an empty run over a
   vanished suite would otherwise pass vacuously). */
export function assertKindDriven(
  index: CorpusIndexMeta,
  kind: string,
  expectedSuites: readonly string[],
): void {
  const undriven = Object.entries(index.suites)
    .filter(([, meta]) => meta.kind !== undefined && !(meta.kind in KNOWN_KINDS))
    .map(([suite]) => suite);
  if (undriven.length > 0) {
    throw new Error(
      `corpus suites with no driver: ${undriven.join(', ')}; add a runner or extend KNOWN_KINDS in tests/conformance/suite-kinds.ts`,
    );
  }
  const registered = Object.entries(index.suites)
    .filter(([, meta]) => meta.kind === kind)
    .map(([suite]) => suite)
    .sort();
  const missing = expectedSuites.filter((suite) => !registered.includes(suite));
  if (missing.length > 0) {
    throw new Error(`corpus kind ${kind} lost its suites: ${missing.join(', ')}`);
  }
}

export interface KindSuite<T> {
  name: string;
  suite: T;
}

/* Load the suite files registered under one kind and pin each file's
   declared suite name and case count against index.json. */
export async function loadKindSuites<T extends { suite: string; cases: unknown[] }>(
  index: CorpusIndexMeta,
  kind: string,
  parse: (text: string, name: string) => T,
): Promise<Array<KindSuite<T>>> {
  const out: Array<KindSuite<T>> = [];
  for (const name of Object.keys(index.suites).sort()) {
    const meta = index.suites[name] as SuiteIndexMeta;
    if (meta.kind !== kind) continue;
    const text = await readFile(path.join(CORPUS_DIR, `${name}.json`), 'utf8');
    const suite = parse(text, name);
    if (suite.cases.length !== meta.case_count) {
      throw new Error(
        `suite ${name} has ${suite.cases.length} cases, index.json pins ${meta.case_count}`,
      );
    }
    out.push({ name, suite });
  }
  return out;
}

export interface XfailFile {
  spec_version: string;
  cases: Record<string, string>;
}

export function xfailPath(kind: string): string {
  return fileURLToPath(new URL(`../../../../conformance/ts_${kind}_xfail.json`, import.meta.url));
}

/* Fail-closed: a missing baseline file is an error, not an empty pass. */
export async function loadXfail(kind: string): Promise<Record<string, string>> {
  const text = await readFile(xfailPath(kind), 'utf8');
  const obj = JSON.parse(text) as { spec_version?: unknown; cases?: unknown };
  if (obj.spec_version !== SPEC_VERSION) {
    throw new Error(`ts_${kind}_xfail.json pins spec ${String(obj.spec_version)}, runner targets ${SPEC_VERSION}`);
  }
  if (typeof obj.cases !== 'object' || obj.cases === null) {
    throw new Error(`ts_${kind}_xfail.json: "cases" must be an object`);
  }
  const cases: Record<string, string> = {};
  for (const [key, reason] of Object.entries(obj.cases as Record<string, unknown>)) {
    if (typeof reason !== 'string') {
      throw new Error(`ts_${kind}_xfail.json: cases.${key} must carry a string reason`);
    }
    cases[key] = reason;
  }
  return cases;
}

/* Shared verdict bookkeeping for one kind's run: mirrors the pipeline
   runner's fail-closed semantics (stale entries, unlisted failures and
   entries that never ran are all red). */
export class XfailLedger {
  readonly failures: string[] = [];
  private readonly seen = new Set<string>();
  passed = 0;
  xfailed = 0;
  failed = 0;

  constructor(private readonly xfail: Record<string, string>) {}

  record(key: string, diffs: string[]): void {
    this.seen.add(key);
    if (diffs.length === 0) {
      if (this.xfail[key] !== undefined) {
        this.failures.push(`stale xfail baseline entry ${key}: case now passes; remove the entry`);
      } else {
        this.passed++;
      }
      return;
    }
    if (this.xfail[key] !== undefined) {
      this.xfailed++;
      console.log(`xfail ${key} [${this.xfail[key]}]: ${diffs.join('; ')}`);
      return;
    }
    this.failed++;
    this.failures.push(`${key}: ${diffs.join('; ')}`);
  }

  finish(kind: string): void {
    for (const key of Object.keys(this.xfail)) {
      if (!this.seen.has(key)) {
        this.failures.push(`xfail baseline entry ${key} never ran or now passes; corpus changed?`);
      }
    }
    console.log(
      `${kind} conformance gate: ${this.passed} passed, ${this.failed} failed, ${this.xfailed} xfail (spec ${SPEC_VERSION})`,
    );
  }
}

/* index.json comparison.events_volatile_fields: dropped recursively at
   capture time, exactly like the reference harness's EVENT_DROP_KEYS. */
export const VOLATILE_EVENT_FIELDS: ReadonlySet<string> = new Set([
  'execution_time',
  'execution_time_ms',
  'idempotency_key',
  'response_time',
  'timestamp',
]);

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

/* TS event objects carry camelCase keys; the corpus envelopes are
   snake_case. Normalization is recursive and idempotent for keys that are
   already snake_case (the TS metadata dicts sometimes use snake keys
   directly, e.g. behavior rule_type). */
export function normalizeEnvelope(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeEnvelope(item));
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE_EVENT_FIELDS.has(key)) continue;
      out[camelToSnake(key)] = normalizeEnvelope(item);
    }
    return out;
  }
  if (typeof value === 'number') return Number.isInteger(value) ? value : round6(value);
  return value;
}

export function round6(value: number): number {
  const scaled = value * 1e6;
  return (scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled)) / 1e6;
}

/* Order-insensitive JSON comparison (the reference compares parsed dicts). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/* index.json comparison.events_envelopes: compare only the keys present in
   each expected envelope; a field the TS surface cannot observe is recorded
   as absent. Absence matches an expected null (the reference envelopes pin
   not-applicable fields to null) and diverges from any expected value. */
export function diffEnvelope(expected: Record<string, unknown>, actual: Record<string, unknown> | undefined): string[] {
  if (actual === undefined) return ['envelope missing from the observed event stream'];
  const diffs: string[] = [];
  for (const [key, wantRaw] of Object.entries(expected)) {
    const want = normalizeEnvelope(wantRaw);
    if (!(key in actual)) {
      if (want !== null) diffs.push(`field ${key} not observable in the TS envelope (expected ${JSON.stringify(want)})`);
      continue;
    }
    const got = normalizeEnvelope(actual[key]);
    if (canonicalJson(got) !== canonicalJson(want)) {
      diffs.push(`field ${key}: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
  return diffs;
}
