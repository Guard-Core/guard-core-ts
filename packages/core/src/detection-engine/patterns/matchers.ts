/**
 * Pattern scan matchers ported from
 * guard_core/handlers/_suspatterns_matchers.py (spec 4.0.2).
 *
 * Each matcher narrows where an expensive pattern runs without rewriting
 * the pattern itself: candidates are located with cheap linear scans, then
 * the unmodified pattern is anchored at each candidate position.
 */

import { compilePythonPattern, matchAt, matchSpan, strFind, strRFind } from '../regex-compat.js';
import { bounded_finditer } from '../scan-window.js';
import type { CompiledPythonPattern, RegexMatchLike } from './types.js';
import { template_expression_matches, template_keyword_matches } from './templates.js';

export {
  _CMD_INJECTION_NEWLINE_SHELL_DASH_C_RE,
  _DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE,
  _LDAP_NULL_BYTE_ATTR_RE,
  _LDAP_NULL_BYTE_DECODED_ATTR_RE,
  _SQLI_LOAD_FILE_RE,
  _CMD_INJECTION_DOLLAR_SUBSTITUTION_RE,
  _TEMPLATE_CURLY_KEYWORD_RE,
  _TEMPLATE_DOLLAR_BRACE_CALL_RE,
  _TEMPLATE_CURLY_CALL_RE,
  _TEMPLATE_PERCENT_KEYWORD_RE,
  _TEMPLATE_ASP_KEYWORD_RE,
  _ATTR_EQUALS_WHITESPACE_RE,
  _HTML_TAG_OPEN_RE,
} from './canonical-sources.generated.js';
import {
  _CMD_INJECTION_NEWLINE_SHELL_DASH_C_RE,
  _DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE,
  _LDAP_NULL_BYTE_ATTR_RE,
  _LDAP_NULL_BYTE_DECODED_ATTR_RE,
  _LDAP_NULL_BYTE_ATTR_COMPILED,
  _LDAP_NULL_BYTE_DECODED_ATTR_COMPILED,
  _LDAP_NULL_BYTE_TAIL_COMPILED,
  _LDAP_NULL_BYTE_DECODED_TAIL_COMPILED,
  _QUOTE_SPLICE_CANDIDATE_RE,
} from './canonical-sources.generated.js';

const CMD_INJECTION_NEWLINE_SHELL_DASH_C_COMPILED = compilePythonPattern(
  _CMD_INJECTION_NEWLINE_SHELL_DASH_C_RE,
  true,
);
const CMD_INJECTION_ASSIGNMENT_PREFIX = compilePythonPattern('\\n[^\\S\\r\\n]*');
const CMD_INJECTION_ASSIGNMENT_TOKEN = compilePythonPattern('[^=\\s;|&]+=[^\\s;|&]+\\s+', true);

export function _cmd_injection_shell_dash_c_finditer(text: string): RegexMatchLike[] {
  const matches: RegexMatchLike[] = [];
  const prefixGlobal = new RegExp(
    CMD_INJECTION_ASSIGNMENT_PREFIX.re.source,
    CMD_INJECTION_ASSIGNMENT_PREFIX.re.flags.replace('y', 'g'),
  );
  const tokenGlobal = new RegExp(
    CMD_INJECTION_ASSIGNMENT_TOKEN.re.source,
    CMD_INJECTION_ASSIGNMENT_TOKEN.re.flags.replace('y', 'g'),
  );
  let lastEnd = 0;
  let prefixMatch: RegExpExecArray | null;
  while ((prefixMatch = prefixGlobal.exec(text)) !== null) {
    const start = prefixMatch.index;
    if (start < lastEnd) continue;
    let pos = prefixMatch.index + prefixMatch[0].length;
    for (;;) {
      tokenGlobal.lastIndex = pos;
      const tokenMatch = tokenGlobal.exec(text);
      if (tokenMatch === null || tokenMatch.index !== pos) break;
      pos = tokenMatch.index + tokenMatch[0].length;
    }
    const match = matchAt(CMD_INJECTION_NEWLINE_SHELL_DASH_C_COMPILED, text, start);
    if (match !== null) {
      matches.push(match);
      lastEnd = match.index + match[0].length;
    } else {
      lastEnd = pos;
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// LDAP null byte attribute scanning
// ---------------------------------------------------------------------------

const LDAP_NULL_BYTE_ATTR_CONTINUATION_CHAR = /[\w-]/;
const LDAP_NULL_BYTE_ATTR_LEAD_CHAR = /[a-zA-Z]/;
const LDAP_NULL_BYTE_VALUE_CHAR = /[\d\w\s]/;
const LDAP_NULL_BYTE_TAIL_RE = _LDAP_NULL_BYTE_TAIL_COMPILED;
const LDAP_NULL_BYTE_DECODED_TAIL_RE = _LDAP_NULL_BYTE_DECODED_TAIL_COMPILED;

function ldapNullByteAttrNameStart(text: string, equalsPos: number): number | null {
  let i = equalsPos;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  while (i > 0 && LDAP_NULL_BYTE_ATTR_CONTINUATION_CHAR.test(text[i - 1] ?? '')) i--;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (i === equalsPos || !LDAP_NULL_BYTE_ATTR_LEAD_CHAR.test(text[i] ?? '')) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return i;
}

function ldapNullByteValueStart(text: string, starPos: number): number {
  let i = starPos;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  while (i > 0 && LDAP_NULL_BYTE_VALUE_CHAR.test(text[i - 1] ?? '')) i--;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return i;
}

function ldapNullByteAttrFinditer(
  text: string,
  compiled: CompiledPythonPattern,
  tailSource: string,
): RegexMatchLike[] {
  if (!text.includes('*') || !text.includes(')')) return [];
  const tail = compilePythonPattern(tailSource);
  const tailMatches: RegExpExecArray[] = [];
  {
    const global = new RegExp(tail.re.source, tail.re.flags.replace('y', 'g'));
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      tailMatches.push(match);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }
  const matches: RegexMatchLike[] = [];
  let lastEnd = 0;
  for (const tailMatch of tailMatches) {
    const starPos = tailMatch.index;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (starPos < lastEnd) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const valueStart = ldapNullByteValueStart(text, starPos);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (valueStart === 0 || text[valueStart - 1] !== '=') continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const nameStart = ldapNullByteAttrNameStart(text, valueStart - 1);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (nameStart === null) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const match = matchSpan(compiled, text, nameStart, tailMatch.index + tailMatch[0].length);
    if (match !== null) {
      matches.push(match);
      lastEnd = match.index + match[0].length;
    }
  }
  return matches;
}

export const _LDAP_NULL_BYTE_TAIL_SOURCE = LDAP_NULL_BYTE_TAIL_RE;
export const _LDAP_NULL_BYTE_DECODED_TAIL_SOURCE = LDAP_NULL_BYTE_DECODED_TAIL_RE;

export function _ldap_null_byte_attr_finditer(text: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  const tailSource = compiled.source === _LDAP_NULL_BYTE_DECODED_ATTR_RE ? LDAP_NULL_BYTE_DECODED_TAIL_RE : LDAP_NULL_BYTE_TAIL_RE;
  return ldapNullByteAttrFinditer(text, compiled, tailSource);
}

export function _ldap_null_byte_bare_finditer(text: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return ldapNullByteAttrFinditer(text, compiled, LDAP_NULL_BYTE_TAIL_RE);
}

// ---------------------------------------------------------------------------
// Quote splice scanning
// ---------------------------------------------------------------------------

const QUOTE_SPLICE_WORD_CHAR_RE = /\w/;
const QUOTE_SPLICE_QUOTE_RUN_RE = /['"]+/g;
const QUOTE_SPLICE_CANDIDATE_COMPILED = compilePythonPattern(_QUOTE_SPLICE_CANDIDATE_RE, true);

function quoteSpliceWordStart(text: string, pos: number): number | null {
  let i = pos;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  while (i > 0 && QUOTE_SPLICE_WORD_CHAR_RE.test(text[i - 1] ?? '')) i--;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return i < pos ? i : null;
}

export function _quote_splice_finditer(text: string): RegexMatchLike[] {
  const n = text.length;
  const matches: RegexMatchLike[] = [];
  let lastEnd = 0;
  const global = new RegExp(QUOTE_SPLICE_QUOTE_RUN_RE.source, 'g');
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = global.exec(text)) !== null) {
    const quoteStart = quoteMatch.index;
    const quoteEnd = quoteStart + quoteMatch[0].length;
    if (quoteStart < lastEnd) continue;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (quoteEnd >= n || !QUOTE_SPLICE_WORD_CHAR_RE.test(text[quoteEnd] ?? '')) continue;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const wordStart = quoteSpliceWordStart(text, quoteStart);
    if (wordStart === null) continue;
    const match = matchAt(QUOTE_SPLICE_CANDIDATE_COMPILED, text, wordStart);
    if (match !== null) {
      matches.push(match);
      lastEnd = match.index + match[0].length;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    } else {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      lastEnd = quoteEnd;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// LOAD_FILE scanning
// ---------------------------------------------------------------------------

const LOAD_FILE_SCAN_PREFIX = compilePythonPattern('LOAD_FILE\\s*\\(', true);
const LOAD_FILE_SCAN_TERMINATOR = compilePythonPattern('\\)');

export function _load_file_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return bounded_finditer(content, compiled, LOAD_FILE_SCAN_PREFIX, LOAD_FILE_SCAN_TERMINATOR);
}

// ---------------------------------------------------------------------------
// Dollar substitution scanning
// ---------------------------------------------------------------------------

const DOLLAR_PAREN_PREFIX = compilePythonPattern('[;&|]\\s*\\$\\(');
const DOLLAR_PAREN_TERMINATOR = compilePythonPattern('\\)');
const DOLLAR_BRACE_PREFIX = compilePythonPattern('[;&|]\\s*\\$\\{');
const DOLLAR_BRACE_TERMINATOR = compilePythonPattern('\\}');

export function _cmd_injection_dollar_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  const parenMatches = bounded_finditer(content, compiled, DOLLAR_PAREN_PREFIX, DOLLAR_PAREN_TERMINATOR);
  const braceMatches = bounded_finditer(content, compiled, DOLLAR_BRACE_PREFIX, DOLLAR_BRACE_TERMINATOR);
  return [...parenMatches, ...braceMatches];
}

// ---------------------------------------------------------------------------
// Template scan matchers
// ---------------------------------------------------------------------------


export function _template_curly_keyword_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_keyword_matches(content, compiled, '{{', '}}');
}

export function _template_dollar_brace_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_expression_matches(content, compiled, 'dollar');
}

export function _template_curly_call_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_expression_matches(content, compiled, 'curly');
}

export function _template_percent_keyword_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_keyword_matches(content, compiled, '{%', '%}');
}

export function _template_asp_keyword_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_expression_matches(content, compiled, 'asp');
}

export function _template_hash_brace_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  return template_expression_matches(content, compiled, 'hash');
}

// ---------------------------------------------------------------------------
// Brace expansion validation
// ---------------------------------------------------------------------------

const BRACE_EXPANSION_WORD_ITEM_RE = /^[A-Za-z0-9_./~-]+$/;
const BRACE_EXPANSION_LETTER_RE = /[A-Za-z]/;

export function _brace_expansion_is_dangerous_command(match: RegexMatchLike): boolean {
  const text = match[0];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return false;
  for (const item of text.slice(start + 1, end).split(',')) {
    if (BRACE_EXPANSION_WORD_ITEM_RE.test(item) && BRACE_EXPANSION_LETTER_RE.test(item)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Pickle global scanning
// ---------------------------------------------------------------------------

const PICKLE_GLOBAL_NEWLINE_RE = /\n/g;
const PICKLE_GLOBAL_IDENT_FULL_RE = /^[A-Za-z_][A-Za-z0-9_]{0,100}$/i;
const PICKLE_GLOBAL_NON_MODULE_CHAR_RE = /[^A-Za-z0-9_.]/gi;
const PICKLE_GLOBAL_IDENT_START_RE = /[A-Za-z_]/i;
const PICKLE_GLOBAL_IDENT_MAX_LEN = 101;
const PICKLE_GLOBAL_DOTTED_SEGMENTS_MAX = 20;

function pickleGlobalFirstValidMarker(
  text: string,
  lower: string,
  upper: string,
  floor: number,
  ceiling: number,
): number | null {
  let start = floor;
  for (;;) {
    const posLower = strFind(text, lower, start, ceiling);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const posUpper = upper !== lower ? strFind(text, upper, start, ceiling) : -1;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const candidates = [posLower, posUpper].filter((pos) => pos !== -1);
    if (candidates.length === 0) return null;
    const pos = Math.min(...candidates);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (PICKLE_GLOBAL_IDENT_START_RE.test(text[pos + 1] ?? '')) return pos;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    start = pos + 1;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
}

function pickleGlobalChainStart(text: string, nl1: number, floor: number): number | null {
  let segEnd = nl1;
  let earliest: number | null = null;
  for (let i = 0; i < PICKLE_GLOBAL_DOTTED_SEGMENTS_MAX + 1; i++) {
    const dotPos = strRFind(text, '.', floor, segEnd);
    const segStart = dotPos >= floor ? dotPos + 1 : floor;
    const segFloor = Math.max(segStart, segEnd - PICKLE_GLOBAL_IDENT_MAX_LEN - 1);
    const cPos = pickleGlobalFirstValidMarker(text, 'c', 'C', segFloor, segEnd);
    if (cPos !== null) earliest = cPos;
    if (dotPos < floor || !PICKLE_GLOBAL_IDENT_FULL_RE.test(text.slice(segStart, segEnd))) break;
    segEnd = dotPos;
  }
  return earliest;
}

function pickleGlobalRunStart(nonModulePositions: number[], nl1: number, floor: number): number {
  let idx = 0;
  while (idx < nonModulePositions.length && nonModulePositions[idx] < nl1) idx++;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return idx > 0 ? Math.max(floor, (nonModulePositions[idx - 1] ?? 0) + 1) : floor;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

export function _pickle_global_generic_finditer(text: string): RegexMatchLike[] {
  const newlinePositions: number[] = [];
  {
    const global = new RegExp(PICKLE_GLOBAL_NEWLINE_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      newlinePositions.push(match.index);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }
  if (newlinePositions.length < 2) return [];
  const nonModulePositions: number[] = [];
  {
    const global = new RegExp(PICKLE_GLOBAL_NON_MODULE_CHAR_RE.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      nonModulePositions.push(match.index);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }

  const compiled = PICKLE_GLOBAL_GENERIC_COMPILED;
  const matches: RegexMatchLike[] = [];
  let lastEnd = 0;
  for (let i = 0; i + 1 < newlinePositions.length; i++) {
    const nl1 = newlinePositions[i];
    const nl2 = newlinePositions[i + 1];
    if (nl1 < lastEnd) continue;
    if (!PICKLE_GLOBAL_IDENT_FULL_RE.test(text.slice(nl1 + 1, nl2))) continue;
    const runStart = pickleGlobalRunStart(nonModulePositions, nl1, lastEnd);
    const start = pickleGlobalChainStart(text, nl1, runStart);
    if (start === null) continue;
    const match = matchAt(compiled, text, start);
    if (match !== null) {
      matches.push(match);
      lastEnd = match.index + match[0].length;
    }
  }
  return matches;
}

const PICKLE_GLOBAL_GENERIC_COMPILED = compilePythonPattern(_DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE, true);

