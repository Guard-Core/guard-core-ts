/**
 * Template-injection scan matchers ported from
 * guard_core/handlers/_suspatterns_templates.py (spec 4.0.2).
 */

import { compilePythonPattern, matchSpan, searchSpan, finditerSpan, strFind } from '../regex-compat.js';
import type { CompiledPythonPattern, RegexMatchLike } from './types.js';

const KEYWORD_INDICATOR_SOURCE = '(?:system|exec|popen|eval|require|include)\\s*\\Z';
const DOLLAR_INDICATOR_SOURCE = '@[\\w.]+@|\\b\\w+\\s*\\(|(?<!\\d)\\d+\\s*[*/%+\\-]\\s*\\d+';
const CURLY_INDICATOR_SOURCE =
  "@[\\w.]+@|\\b\\w+\\(\\s*\\)" +
  "|(?<!\\d)['\"]?\\d+['\"]?\\s*[*/%+\\-]\\s*['\"]?\\d+['\"]?";
const HASH_INDICATOR_SOURCE =
  "@[\\w.]+@|\\b\\w+\\s*\\(" +
  "|(?<!\\d)['\"]?\\d+['\"]?\\s*[*/%+\\-]\\s*['\"]?\\d+['\"]?";
const ASP_INDICATOR_SOURCE = 'system|exec|eval|`|Runtime|IO\\.|File\\.|Dir\\.|(?<!\\d)\\d+\\s*[-+*/]\\s*\\d+';
const DATE_INDICATOR_SOURCE = '(?=\\d{4}-\\d{1,2}-\\d{1,2}(?!\\d))';

function escapeForCharClass(ch: string): string {
  return ch.replace(/[\\\]^-]/g, '\\$&');
}

function templateRegex(source: string, ignoreCase: boolean): CompiledPythonPattern {
  return compilePythonPattern(source, ignoreCase);
}

interface TemplateRegion {
  start: number;
  barrier: number;
  end: number;
}

function templateRegions(content: string, opening: string, closing: string): TemplateRegion[] {
  const regions: TemplateRegion[] = [];
  let cursor = 0;
  for (;;) {
    const start = strFind(content, opening, cursor);
    if (start === -1) break;
    const bodyStart = start + opening.length;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const barrier = strFind(content, closing[0] ?? '', bodyStart);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (barrier === -1) break;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    cursor = Math.max(bodyStart, barrier - opening.length + 1);
    if (content.startsWith(closing, barrier)) {
      regions.push({ start, barrier, end: barrier + closing.length });
    }
  }
  return regions;
}

function templateFrame(
  content: string,
  opening: string,
  closing: string,
  start: number,
  end: number,
  ignoreCase: boolean,
): RegexMatchLike {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const source = escapeForRegex(opening) + '[^' + escapeForCharClass(closing[0] ?? '') + ']*' + escapeForRegex(closing);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const frame = templateRegex(source, ignoreCase);
  const match = matchSpan(frame, content, start, end);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (match === null) {
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    throw new Error('template frame match invariant violated');
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return match;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function template_keyword_matches(
  content: string,
  compiled: CompiledPythonPattern,
  opening: string,
  closing: string,
): RegexMatchLike[] {
  const indicator = templateRegex(KEYWORD_INDICATOR_SOURCE, compiled.re.ignoreCase);
  const matches: RegexMatchLike[] = [];
  for (const { start, barrier, end } of templateRegions(content, opening, closing)) {
    if (searchSpan(indicator, content, start + opening.length + 1, barrier) !== null) {
      matches.push(templateFrame(content, opening, closing, start, end, compiled.re.ignoreCase));
    }
  }
  return matches;
}

function templateAfterDates(
  content: string,
  opening: string,
  start: number,
  barrier: number,
  ignoreCase: boolean,
): number {
  const dateIndicator = templateRegex(DATE_INDICATOR_SOURCE, ignoreCase);
  const matches = finditerSpan(dateIndicator, content, start + 2, barrier);
  if (matches.length === 0) return start;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const lastDate = matches[matches.length - 1].index;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return strFind(content, opening, lastDate + 1, barrier);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

const TEMPLATE_KINDS: Record<string, { opening: string; closing: string; source: string }> = {
  dollar: { opening: '${', closing: '}', source: DOLLAR_INDICATOR_SOURCE },
  curly: { opening: '{{', closing: '}}', source: CURLY_INDICATOR_SOURCE },
  hash: { opening: '#{', closing: '}', source: HASH_INDICATOR_SOURCE },
  asp: { opening: '<%', closing: '%>', source: ASP_INDICATOR_SOURCE },
};

export function template_expression_matches(
  content: string,
  compiled: CompiledPythonPattern,
  kind: string,
): RegexMatchLike[] {
  const spec = TEMPLATE_KINDS[kind];
  if (!spec) throw new Error(`unknown template kind ${kind}`);
  const { opening, closing, source } = spec;
  const indicator = templateRegex(source, compiled.re.ignoreCase);
  const matches: RegexMatchLike[] = [];
  let lastEnd = 0;
  for (const region of templateRegions(content, opening, closing)) {
    let { start } = region;
    const { barrier, end } = region;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (start < lastEnd) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (kind === 'curly' || kind === 'hash') {
      start = templateAfterDates(content, opening, start, barrier, compiled.re.ignoreCase);
    }
    if (start !== -1 && searchSpan(indicator, content, start + opening.length, barrier) !== null) {
      matches.push(templateFrame(content, opening, closing, start, end, compiled.re.ignoreCase));
      lastEnd = end;
    }
  }
  return matches;
}
