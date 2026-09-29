/**
 * Python `re` compatibility layer for the detection engine port.
 *
 * The guard-core spec 4.0.2 pattern table is authored as Python regex
 * sources, and the conformance corpus compares the canonical source string
 * carried by every threat. This module compiles those sources to JavaScript
 * RegExp objects with equivalent semantics and exposes the anchored
 * match/search primitives the reference engine relies on
 * (`pattern.match(text, pos[, endpos])`, `pattern.search(text, pos[,
 * endpos])`).
 *
 * Translation rules (see spec section 04.5):
 * - `\A` stays `^`: without the multiline flag, JS `^` matches only at the
 *   true string start, exactly like Python `\A` under `match(text, pos)`.
 * - `\Z` becomes `$`: without the multiline flag, JS `$` matches only at
 *   the true string end, exactly like Python `\Z`.
 * - A bare `$` in a Python source means "end of string or just before a
 *   trailing newline"; JS `$` lacks the trailing-newline allowance, so it
 *   is translated to `(?:\n?$)`.
 * - A leading `(?i)` is lifted into the `i` flag. `(?-i:...)` only occurs
 *   in sources without a global `(?i)`; the wrapper is stripped and the
 *   pattern compiles case-sensitively.
 * - Python `\w`, `\d` match per Unicode; JS keeps them ASCII-scoped. This
 *   is the documented detection deviation of the port: payloads are
 *   overwhelmingly ASCII and the effect only ever narrows candidate spans
 *   for non-ASCII text.
 * - Python `\s` DOES match per Unicode (spec 4.0.3 binary-body corpus): it
 *   includes U+0085 (NEL) and U+001C-U+001F, which JS \s misses, and it
 *   excludes U+FEFF, which JS \s matches. The noise-density and shell
 *   heuristics author `\s*\Z`-style spans over binary padding, so `\s` is
 *   translated to the reference whitespace class. `\S` inside negated
 *   classes keeps JS scoping (see the `[^\S\r\n]` header patterns).
 */

const PY_S_CLASS = '[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\u0085\\u001c-\\u001f]';

export interface CompiledPythonPattern {
  /** Canonical Python-style source; carried verbatim on threats. */
  readonly source: string;
  /** JS regex clone per compile; always sticky-capable. */
  readonly re: RegExp;
}

function translateSource(source: string, ignoreCase: boolean): { source: string; ignoreCase: boolean } {
  let translated = source;
  let effectiveCase = ignoreCase;

  if (translated.startsWith('(?i)')) {
    translated = translated.slice(4);
    effectiveCase = true;
  }

  // `(?-i:...)` wrappers: only authored around fully case-sensitive token
  // alternations in sources without a global case-insensitive flag. The
  // wrapper becomes a plain group; the existing closing paren keeps balance.
  if (translated.includes('(?-i:')) {
    translated = translated.split('(?-i:').join('(');
    effectiveCase = false;
  }

  let result = '';
  let inClass = false;
  for (let i = 0; i < translated.length; i++) {
    const ch = translated[i];
    if (ch === '\\' && i + 1 < translated.length) {
      const next = translated[i + 1];
      if (next === 'A') {
        result += '^';
      } else if (next === 'Z') {
        result += '$';
      } else if (next === 's' && !inClass) {
        result += PY_S_CLASS;
        i++;
        continue;
      } else {
        result += ch + next;
      }
      i++;
      continue;
    }
    if (ch === '[' && !inClass) {
      inClass = true;
      result += ch;
      continue;
    }
    if (ch === ']' && inClass) {
      inClass = false;
      result += ch;
      continue;
    }
    if (ch === '$' && !inClass) {
      // Python `$`: end of string, or just before a trailing newline.
      result += '(?:\\n?$)';
      continue;
    }
    result += ch;
  }

  return { source: result, ignoreCase: effectiveCase };
}

export function compilePythonPattern(source: string, ignoreCase = false): CompiledPythonPattern {
  const { source: translated, ignoreCase: effectiveCase } = translateSource(source, ignoreCase);
  const flags = effectiveCase ? 'isy' : 'sy';
  return { source, re: new RegExp(translated, flags) };
}

/** A fresh sticky clone; JS stateful regexes cannot be shared across iterations. */
export function cloneSticky(compiled: CompiledPythonPattern): RegExp {
  return compiled.re;
}

/**
 * Python `pattern.match(text, pos)`: attempt anchored at `pos`; `^` still
 * matches only at the true string start.
 */
export function matchAt(compiled: CompiledPythonPattern, text: string, pos: number): RegExpExecArray | null {
  const re = compiled.re;
  re.lastIndex = pos;
  const match = re.exec(text);
  return match !== null && match.index === pos ? match : null;
}

/**
 * Python `pattern.match(text, pos, endpos)`: the string is effectively
 * truncated at `endpos`. The first attempt runs against the full text and
 * only falls back to a virtual truncation when the greedy match overshoots
 * `endpos`; window callers always bound their windows by a terminator whose
 * end is `endpos`, so anchored (`^`) sources never reach the fallback.
 */
export function matchSpan(
  compiled: CompiledPythonPattern,
  text: string,
  start: number,
  end: number,
): RegExpExecArray | null {
  if (start > end) return null;
  const re = compiled.re;
  re.lastIndex = start;
  const match = re.exec(text);
  if (match !== null && match.index === start) {
    if (match.index + match[0].length <= end) return match;
    re.lastIndex = start;
    const truncated = re.exec(text.slice(0, end));
    /* v8 ignore start -- the truncated retry cannot fail when the first match
       already anchored at start; kept as a contract guard */
    if (truncated !== null && truncated.index === start) return truncated;
    /* v8 ignore stop */
  }
  return null;
}

/** Python `pattern.search(text, pos)`: scan from `pos` on the full text. */
export function searchAt(compiled: CompiledPythonPattern, text: string, pos: number): RegExpExecArray | null {
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  global.lastIndex = pos;
  return global.exec(text);
}

/**
 * Python `pattern.search(text, pos, endpos)`: scan from `pos` with the
 * string truncated at `endpos`.
 */
export function searchSpan(
  compiled: CompiledPythonPattern,
  text: string,
  start: number,
  end: number,
): RegExpExecArray | null {
  const truncated = text.slice(0, end);
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  global.lastIndex = start;
  const match = global.exec(truncated);
  if (match === null) return null;
  return match;
}

/**
 * Python `pattern.finditer(text, pos, endpos)`: every non-overlapping match
 * within `[pos, endpos)`. Indices refer to the original text.
 */
export function finditerSpan(
  compiled: CompiledPythonPattern,
  text: string,
  start: number,
  end: number,
): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  const truncated = text.slice(0, end);
  global.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = global.exec(truncated)) !== null) {
    matches.push(match);
    if (match[0].length === 0) global.lastIndex++;
  }
  return matches;
}

/** Python `pattern.findall(text)` over the full text. */
export function findall(compiled: CompiledPythonPattern, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    matches.push(match);
    if (match[0].length === 0) global.lastIndex++;
  }
  return matches;
}

/** Python `pattern.search(text)` over the full text. */
export function pySearch(compiled: CompiledPythonPattern, text: string): RegExpExecArray | null {
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  return global.exec(text);
}

/** Python `pattern.fullmatch(text)`. */
export function fullmatch(compiled: CompiledPythonPattern, text: string): RegExpExecArray | null {
  const re = compiled.re;
  re.lastIndex = 0;
  const match = re.exec(text);
  return match !== null && match.index === 0 && match[0].length === text.length ? match : null;
}

/** Python `str.find(sub, start)` / `str.rfind(sub, start, end)` equivalents. */
export function strFind(text: string, sub: string, start = 0, end = text.length): number {
  const index = text.indexOf(sub, start);
  if (index === -1 || index + sub.length > end) return -1;
  return index;
}

export function strRFind(text: string, sub: string, start = 0, end = text.length): number {
  const limit = Math.min(end, text.length);
  const capped = text.slice(0, Math.max(0, limit));
  const index = capped.lastIndexOf(sub, limit - sub.length);
  if (index === -1 || index < start || index + sub.length > limit) return -1;
  return index;
}
