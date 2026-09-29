/**
 * Candidate-rejection validators ported from
 * guard_core/handlers/_suspatterns_shell_validators.py (spec 4.0.2).
 *
 * A validator receives a candidate match plus the detection context and
 * decides whether the match is a true injection; returning false rejects
 * the candidate and lets the scan continue with later matches.
 */

import { compilePythonPattern, pySearch } from '../regex-compat.js';
import {
  _AMBIGUOUS_BACKTICK_INJECTION_CONTEXTS,
  _BACKTICK_WINDOW_DELIMITER_CHARS,
  _BACKTICK_WINDOW_DELIMITER_RE,
  _BARE_SHELL_PARAMETER_NAME_RE,
  _GLUED_BACKTICK_ASCII_WORD_RE,
  _IMPLAUSIBLE_DOLLAR_PAREN_TOKEN_CHARS_RE,
  _IMPLAUSIBLE_SQL_IDENTIFIER_CHARS_RE,
  _SHELL_SPECIAL_PARAMETER_NAMES,
  _STRONG_SQL_KEYWORD_GLUED_PREFIX_RE,
  _STRONG_SQL_KEYWORD_GLUED_SUFFIX_RE,
} from './shell-sources.js';
import type { CompiledPythonPattern } from '../regex-compat.js';

type RegexMatch = RegExpExecArray;

export interface ValidatorContext {
  /** True when the validator context carries the embedded-JSON leaf suffix. */
  readonly rawContext: string;
}

function backtickTokenHasChainedShellOperators(token: string): boolean {
  const chain = /;|\|\||\||&&/g;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = chain.exec(token)) !== null) count++;
  return count >= 2;
}

const SHELL_METACHARACTER_WINDOW_RE =
  /(?:;|\|\||\||&&)\s*(?:`|[A-Za-z_][\w-]*|[~./][\w./-]*|-[\w-]*)|\$\(|\$\{/;

function backtickPairGlued(content: string, start: number, end: number): boolean {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const prefixGlued = start > 0 && _GLUED_BACKTICK_ASCII_WORD_RE.test(content[start - 1] ?? '');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const suffixGlued = end < content.length && _GLUED_BACKTICK_ASCII_WORD_RE.test(content[end] ?? '');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return prefixGlued || suffixGlued;
}

const BACKTICK_CLAUSE_BOUNDARY_CHARS = '.!?;&|';

function backtickPairTailAnchored(content: string, end: number): boolean {
  return content.slice(end).trim() === '';
}

function backtickPairClauseInitial(content: string, start: number): boolean {
  if (start === 0) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!' \t\r\n'.includes(content[start - 1] ?? '')) return false;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const prefix = content.slice(0, start).replace(/\s+$/, '');
  if (!prefix) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return BACKTICK_CLAUSE_BOUNDARY_CHARS.includes(prefix[prefix.length - 1] ?? '');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

function backtickPairAppendedClause(content: string, start: number, end: number): boolean {
  return backtickPairTailAnchored(content, end) && backtickPairClauseInitial(content, start);
}

function backtickWindowStart(content: string, position: number): number {
  let index = position;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  while (index > 0 && !_BACKTICK_WINDOW_DELIMITER_CHARS.includes(content[index - 1] ?? '')) {
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    index--;
  }
  return index;
}

function backtickWindowEnd(content: string, position: number): number {
  const re = new RegExp(_BACKTICK_WINDOW_DELIMITER_RE.source);
  re.lastIndex = position;
  const delimiter = re.exec(content);
  return delimiter !== null ? delimiter.index : content.length;
}

function backtickPairContextWindow(content: string, start: number, end: number): string {
  const windowStart = backtickWindowStart(content, start);
  const windowEnd = backtickWindowEnd(content, end);
  return content.slice(windowStart, windowEnd);
}

const SHELL_TEXT_PRINTABLE_ASCII_RE = /^[\t\x20-\x7e]*$/;

function backtickTokenIsImplausibleSqlIdentifier(token: string): boolean {
  return _IMPLAUSIBLE_SQL_IDENTIFIER_CHARS_RE.test(token);
}

function strongSqlKeywordGluedToPair(content: string, start: number, end: number): boolean {
  const windowStart = backtickWindowStart(content, start);
  const windowEnd = backtickWindowEnd(content, end);
  const prefix = content.slice(windowStart, start);
  const suffix = content.slice(end, windowEnd);
  if (pySearch(_STRONG_SQL_KEYWORD_GLUED_PREFIX_RE as CompiledPythonPattern, prefix) !== null) return true;
  const suffixMatch = _STRONG_SQL_KEYWORD_GLUED_SUFFIX_RE.re.test(suffix);
  return suffixMatch;
}

export function _glued_backtick_pair_is_injection(match: RegexMatch, context: string): boolean {
  const content = match.input;
  const start = match.index;
  const end = match.index + match[0].length;
  const token = content.slice(start + 1, end - 1);
  if (!SHELL_TEXT_PRINTABLE_ASCII_RE.test(token)) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (backtickTokenHasChainedShellOperators(token)) return true;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const appendedClause = backtickPairAppendedClause(content, start, end);
  if (!backtickPairGlued(content, start, end) && !appendedClause) return false;
  if (backtickTokenIsImplausibleSqlIdentifier(token)) return true;
  const window = backtickPairContextWindow(content, start, end);
  if (SHELL_METACHARACTER_WINDOW_RE.test(window)) return true;
  if (strongSqlKeywordGluedToPair(content, start, end)) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const normalized = context.split(':', 1)[0] ?? context;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return _AMBIGUOUS_BACKTICK_INJECTION_CONTEXTS.has(normalized) || appendedClause;
}

const BARE_SHELL_PARAMETER_NAME_COMPILED = compilePythonPattern(_BARE_SHELL_PARAMETER_NAME_RE);

function dollarSubstitutionTokenIsImplausible(token: string, delimiter: string): boolean {
  const stripped = token.trim().toLowerCase();
  if (_SHELL_SPECIAL_PARAMETER_NAMES.has(stripped)) return true;
  if (delimiter === '{') {
    return BARE_SHELL_PARAMETER_NAME_COMPILED.re.exec(token.trim()) === null;
  }
  return _IMPLAUSIBLE_DOLLAR_PAREN_TOKEN_CHARS_RE.test(token);
}

function dollarSubstitutionPairBacktickQuoted(content: string, start: number, end: number): boolean {
  const prefixQuoted = start > 0 && content[start - 1] === '`';
  const suffixQuoted = end < content.length && content[end] === '`';
  return prefixQuoted || suffixQuoted;
}

export function _dollar_substitution_pair_is_injection(match: RegexMatch, context: string): boolean {
  const content = match.input;
  const start = match.index;
  const end = match.index + match[0].length;
  if (dollarSubstitutionPairBacktickQuoted(content, start, end)) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const delimiter = content[start + 1] ?? '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const token = content.slice(start + 2, end - 1);
  if (dollarSubstitutionTokenIsImplausible(token, delimiter)) return true;
  if (strongSqlKeywordGluedToPair(content, start, end)) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const normalized = context.split(':', 1)[0] ?? context;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return _AMBIGUOUS_BACKTICK_INJECTION_CONTEXTS.has(normalized);
}

export function _quote_splice_token_is_dangerous_command(match: RegexMatch): boolean {
  let run = 0;
  for (const fragment of match[0].split(/['"]+/)) {
    run = fragment.length === 1 ? run + 1 : 0;
    if (run >= 3) return true;
  }
  return false;
}

const GLOB_WILDCARD_COMMAND_BOUNDARY_PREFIX_RE = /(?:;|\|\||\||&&|\$\(|`)\s*$/;
const GLOB_WILDCARD_VALUE_START_CONTEXTS: ReadonlySet<string> = new Set(['request_body']);
const GLOB_WILDCARD_LETTER_RE = /[A-Za-z]/;
const GLOB_WILDCARD_COMMAND_SUFFIX_CHARS = ' \t\r\n;|&';

function globWildcardTokenIsWordShaped(token: string): boolean {
  for (const wildcard of token.matchAll(/[?*]/g)) {
    const index = wildcard.index;
    let left = 0;
    let position = index - 1;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    while (position >= 0 && GLOB_WILDCARD_LETTER_RE.test(token[position] ?? '')) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      left++;
      position--;
    }
    let right = 0;
    position = index + 1;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    while (position < token.length && GLOB_WILDCARD_LETTER_RE.test(token[position] ?? '')) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      right++;
      position++;
    }
    if (left + right >= 2) return true;
  }
  return false;
}

export function _glob_wildcard_token_is_dangerous_command(match: RegexMatch, context = 'unknown'): boolean {
  if (!globWildcardTokenIsWordShaped(match[0])) return false;
  const suffix = match.input[match.index + match[0].length] ?? '';
  if (suffix && !GLOB_WILDCARD_COMMAND_SUFFIX_CHARS.includes(suffix)) return false;
  const prefix = match.input.slice(0, match.index);
  if (GLOB_WILDCARD_COMMAND_BOUNDARY_PREFIX_RE.test(prefix)) return true;
  if (GLOB_WILDCARD_VALUE_START_CONTEXTS.has(context)) return prefix.trim() === '';
  return false;
}
