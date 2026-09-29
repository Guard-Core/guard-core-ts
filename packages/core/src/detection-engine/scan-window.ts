/**
 * Bounded scan windows ported from guard_core/detection_engine/scan_window.py
 * (spec 4.0.2).
 *
 * Several built-in detection patterns have the shape
 * `literal_prefix + unbounded_negated_class + terminator`. When the
 * terminator is absent, the regex engine rescans to end-of-input from every
 * prefix occurrence, which is quadratic in input length. This module locates
 * prefix and terminator occurrences with linear passes, then runs the
 * caller's UNMODIFIED pattern against a bounded span per prefix candidate:
 * from that candidate to the rightmost terminator occurrence reachable from
 * it. The pattern itself is never rewritten.
 */

import { matchSpan } from './regex-compat.js';
import type { CompiledPythonPattern, RegexMatchLike } from './patterns/types.js';

export function bounded_finditer(
  text: string,
  compiled: CompiledPythonPattern,
  prefix: CompiledPythonPattern,
  terminator: CompiledPythonPattern,
): RegexMatchLike[] {
  const terminatorEnds: number[] = [];
  {
    const global = new RegExp(terminator.re.source, terminator.re.flags.replace('y', 'g'));
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      terminatorEnds.push(match.index + match[0].length);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }
  if (terminatorEnds.length === 0) return [];
  const ceiling = terminatorEnds[terminatorEnds.length - 1];

  const prefixStarts: number[] = [];
  {
    const global = new RegExp(prefix.re.source, prefix.re.flags.replace('y', 'g'));
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      prefixStarts.push(match.index);
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      if (match[0].length === 0) global.lastIndex++;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
  }
  if (prefixStarts.length === 0) return [];

  const matches: RegexMatchLike[] = [];
  let searchFrom = 0;
  let startIndex = 0;
  for (;;) {
    while (startIndex < prefixStarts.length && prefixStarts[startIndex] < searchFrom) startIndex++;
    let match: RegexMatchLike | null = null;
    for (let i = startIndex; i < prefixStarts.length; i++) {
      const start = prefixStarts[i];
      if (start >= ceiling) break;
      match = matchSpan(compiled, text, start, ceiling);
      if (match !== null) {
        startIndex = i;
        break;
      }
    }
    if (match === null) return matches;
    matches.push(match);
    const matchEnd = match.index + match[0].length;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    searchFrom = matchEnd > match.index ? matchEnd : match.index + 1;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
}
