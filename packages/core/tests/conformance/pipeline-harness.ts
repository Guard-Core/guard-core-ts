import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CORPUS_DIR = fileURLToPath(
  new URL('../../../../conformance/guard-core-spec-4.1.0/cases/', import.meta.url),
);
const XFAIL_PATH = fileURLToPath(
  new URL('../../../../conformance/ts_pipeline_xfail.json', import.meta.url),
);

export interface PipelineDrive {
  client_ip: string;
  method?: string;
  url_path?: string;
  headers?: Record<string, string>;
  body?: string;
  stage?: string;
  response_status?: number;
  response_body?: string;
}

export interface PipelineCase {
  id: string;
  config: Record<string, unknown>;
  geo_countries: Record<string, string>;
  routes: Record<string, Record<string, unknown>>;
  drives: PipelineDrive[];
  expected: Array<Record<string, unknown>>;
}

export interface PipelineSuite {
  suite: string;
  kind: string;
  cases: PipelineCase[];
}

export async function loadPipelineSuites(index: {
  suites: Record<string, { kind?: string; consumers?: string[] }>;
}): Promise<Array<{ name: string; suite: PipelineSuite }>> {
  const names = Object.entries(index.suites)
    .filter(([, meta]) => meta.kind === 'pipeline' && (meta.consumers ?? []).includes('ts'))
    .map(([name]) => name)
    .sort();
  const out: Array<{ name: string; suite: PipelineSuite }> = [];
  for (const name of names) {
    const text = await readFile(path.join(CORPUS_DIR, `${name}.json`), 'utf8');
    out.push({ name, suite: JSON.parse(text) as PipelineSuite });
  }
  return out;
}

export async function loadPipelineXfail(): Promise<Record<string, string>> {
  try {
    const baseline = JSON.parse(await readFile(XFAIL_PATH, 'utf8')) as {
      spec_version: string;
      cases: Record<string, string>;
    };
    if (baseline.spec_version !== '4.1.0') {
      throw new Error(`xfail baseline spec pin ${baseline.spec_version} does not match 4.1.0`);
    }
    return baseline.cases;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

export { CORPUS_DIR };
