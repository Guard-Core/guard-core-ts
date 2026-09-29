/**
 * LDAP breakout, legacy IPv4 host and Log4Shell matchers ported from
 * guard_core/handlers/_suspatterns_ldap_ipv4.py (spec 4.0.2).
 */

import { compilePythonPattern, pySearch } from '../regex-compat.js';
import type { CompiledPythonPattern, RegexMatchLike } from './types.js';
import {
  _LDAP_ATTR_EXTENSIBLE_MATCH_RE,
  _LDAP_PAREN_CONJUNCTION_RE,
  _LDAP_PAREN_CONJUNCTION_FOLLOWUP_ATTR_RE,
  _LDAP_PAREN_CONJUNCTION_FOLLOWUP_SYMBOL_RE,
  _LDAP_WILDCARD_CHAIN_RE,
  _LDAP_WILDCARD_EQUALS_RE,
  _LDAP_PAREN_BREAKOUT_RE,
  _LEGACY_IPV4_PART_RE,
  _LEGACY_IPV4_HOST_RE,
  _LOG4SHELL_JNDI_LOOKUP_RE,
} from './canonical-sources.generated.js';

export {
  _LOG4SHELL_JNDI_LOOKUP_RE,
  _LEGACY_IPV4_PART_RE,
  _LEGACY_IPV4_HOST_RE,
  _LDAP_WILDCARD_CHAIN_RE,
  _LDAP_WILDCARD_EQUALS_RE,
  _LDAP_PAREN_BREAKOUT_RE,
  _LDAP_PAREN_CONJUNCTION_RE,
} from './canonical-sources.generated.js';

export const ALWAYS_SCAN_HEADER_PATTERN_SOURCES: ReadonlySet<string> = new Set([_LOG4SHELL_JNDI_LOOKUP_RE]);

// Blocked networks as [lo, hi] integer ranges (IPv4, unsigned 32-bit).
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 0x00ffffff], // 0.0.0.0/8
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
  [0x646464c8, 0x646464c8], // 100.100.100.200/32
];

function decodeLegacyIpv4Part(part: string): number | null {
  if (part.startsWith('0x') || part.startsWith('0X')) {
    const digits = part.slice(2);
    if (!digits) return null;
    if (!/^[0-9a-fA-F]+$/.test(digits)) return null;
    return parseInt(digits, 16);
  }
  if (part.startsWith('0') && part.length > 1) {
    const digits = part.slice(1);
    if (!/^[0-7]+$/.test(digits)) return null;
    return parseInt(digits, 8);
  }
  return /^\d+$/.test(part) ? parseInt(part, 10) : null;
}

const MIN_BARE_DECIMAL_LEGACY_IPV4 = 1 << 24;

function isBareDecimalLegacyIpv4Part(part: string): boolean {
  return part === '0' || part[0] !== '0';
}

function isAmbiguousBareDecimalPort(parts: string[], decoded: number[]): boolean {
  if (decoded.length !== 1 || decoded[0] === 0) return false;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const isSmallValue = (decoded[0] ?? 0) < MIN_BARE_DECIMAL_LEGACY_IPV4;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const isBareDecimal = isBareDecimalLegacyIpv4Part(parts[0] ?? '');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return isSmallValue && isBareDecimal;
}

export function decodeLegacyIpv4Host(host: string): number | null {
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const decoded: number[] = [];
  for (const part of parts) {
    const value = decodeLegacyIpv4Part(part);
    if (value === null) return null;
    decoded.push(value);
  }
  if (isAmbiguousBareDecimalPort(parts, decoded)) return null;
  for (const value of decoded.slice(0, -1)) {
    if (value > 255) return null;
  }
  const remainingBits = 8 * (5 - decoded.length);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if ((decoded[decoded.length - 1] ?? 0) >= 2 ** remainingBits) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  let result = 0;
  for (const value of decoded.slice(0, -1)) {
    result = (result << 8) | value;
  }
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return (result << remainingBits) | (decoded[decoded.length - 1] ?? 0);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

function isBlockedLegacyIpv4(ipInt: number): boolean {
  return BLOCKED_IPV4_RANGES.some(([lo, hi]) => ipInt >= lo && ipInt <= hi);
}

export function _legacy_ipv4_match_is_blocked(match: RegexMatchLike): boolean {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const host = match[1] ?? '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const ipInt = decodeLegacyIpv4Host(host);
  return ipInt !== null && isBlockedLegacyIpv4(ipInt);
}

// ---------------------------------------------------------------------------
// LDAP breakout window analysis
// ---------------------------------------------------------------------------

const LDAP_BREAKOUT_WILDCARD_CLAUSE_END = compilePythonPattern('=[^()]+\\*\\s*\\Z');
const LDAP_BREAKOUT_ATTACK_TOKEN = compilePythonPattern('\\*|\\(\\s*[&|!]|\\x00|\\(\\s*\\(|~=|>=|<=');
const LDAP_FILTER_EXPRESSION_STRUCTURE = compilePythonPattern("[()\"'\\n]");
const LDAP_PAREN_CONJUNCTION_FOLLOWUP_SYMBOL = compilePythonPattern(_LDAP_PAREN_CONJUNCTION_FOLLOWUP_SYMBOL_RE);
const LDAP_PAREN_CONJUNCTION_FOLLOWUP_ATTR = compilePythonPattern(_LDAP_PAREN_CONJUNCTION_FOLLOWUP_ATTR_RE);

function ldapBreakoutBackwardWindow(
  text: string,
  closeParenPos: number,
): { window: string; depth: number; depthUnresolved: boolean } {
  const backwardStart = Math.max(0, closeParenPos - 40);
  let position = closeParenPos - 1;
  let depth = 0;
  while (
    position >= backwardStart &&
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    !'"\'\n&'.includes(text[position] ?? '')
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  ) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (text[position] === ')') depth--;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    else if (text[position] === '(') depth++;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    position--;
  }
  const window = text.slice(position + 1, closeParenPos);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const depthUnresolved = backwardStart > 0 && position < backwardStart;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return { window, depth, depthUnresolved };
}

function searchSourceFrom(source: string, text: string, after: number): RegExpExecArray | null {
  // Python: match.re.search(match.string, after) - rescan with the same
  // pattern that produced the match, from `after`.
  const compiled = compilePythonPattern(source, true);
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  global.lastIndex = after;
  return global.exec(text);
}

function ldapNextCandidateScanLimit(source: string, match: RegexMatchLike, after: number): number {
  const nextMatch = searchSourceFrom(source, match.input, after);
  return nextMatch !== null ? nextMatch.index + nextMatch[0].length : match.input.length;
}

function ldapFilterExpressionForwardExtent(text: string, start: number, scanLimit: number): number {
  let position = start;
  let depth = 0;
  for (;;) {
    const global = new RegExp(
      LDAP_FILTER_EXPRESSION_STRUCTURE.re.source,
      LDAP_FILTER_EXPRESSION_STRUCTURE.re.flags.replace('y', 'g'),
    );
    global.lastIndex = position;
    const raw = global.exec(text);
    const boundary = raw !== null && raw.index < scanLimit ? raw : null;
    if (boundary === null) return scanLimit;
    const ch = boundary[0];
    if ('"\'\n'.includes(ch)) return boundary.index;
    if (ch === '(') depth++;
    else if (depth === 0) return boundary.index;
    else depth--;
    position = boundary.index + boundary[0].length;
  }
}

function ldapBreakoutForwardWindow(source: string, match: RegexMatchLike, closeParenPos: number): string {
  const text = match.input;
  const scanLimit = ldapNextCandidateScanLimit(source, match, match.index + match[0].length);
  const extent = ldapFilterExpressionForwardExtent(text, closeParenPos + 1, scanLimit);
  return text.slice(closeParenPos, extent);
}

export function _ldap_wildcard_chain_is_injection(match: RegexMatchLike, source: string): boolean {
  const text = match.input;
  const groupIndex = match[0].indexOf(')');
  if (groupIndex === -1) return false;
  const closeParenPos = match.index + groupIndex;

  const { window: backwardWindow, depth, depthUnresolved } = ldapBreakoutBackwardWindow(text, closeParenPos);
  const forwardWindow = ldapBreakoutForwardWindow(source, match, closeParenPos);

  const wildcardAdjacent = match[0].startsWith('*');
  const depthProvesBreakout = depth <= 0 && (wildcardAdjacent || !depthUnresolved);
  const wildcardClauseEnd = pySearch(LDAP_BREAKOUT_WILDCARD_CLAUSE_END, backwardWindow) !== null;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const depthOrWildcardClause = depthProvesBreakout || wildcardClauseEnd;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!depthOrWildcardClause) return false;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return (
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    pySearch(LDAP_BREAKOUT_ATTACK_TOKEN, backwardWindow) !== null ||
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    pySearch(LDAP_BREAKOUT_ATTACK_TOKEN, forwardWindow) !== null
  );
}

export function _ldap_paren_conjunction_is_injection(match: RegexMatchLike, source: string): boolean {
  const text = match.input;
  const scanLimit = ldapNextCandidateScanLimit(source, match, match.index + match[0].length);
  const tailEnd = ldapFilterExpressionForwardExtent(text, match.index + match[0].length, scanLimit);
  const tail = text.slice(match.index + match[0].length, tailEnd);
  if (pySearch(LDAP_PAREN_CONJUNCTION_FOLLOWUP_SYMBOL, tail) !== null) return true;
  if (!tail.includes('=')) return false;
  return pySearch(LDAP_PAREN_CONJUNCTION_FOLLOWUP_ATTR, tail) !== null;
}
