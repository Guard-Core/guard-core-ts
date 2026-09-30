/**
 * Binary-content detection ported from
 * guard_core/detection_engine/binary_prefix.py and semantic.py
 * (looks_like_binary_content), spec 4.0.2.
 */

import { isPrintableCodePoint } from './base64-decode.js';

const BINARY_ARTIFACT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0b],
  [0x0c, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x7f],
  [0x80, 0xa2],
  [0xa4, 0xa4],
  [0xa6, 0xa9],
  [0xab, 0xaf],
  [0xb4, 0xb4],
  [0xb6, 0xb8],
  [0xbb, 0xbf],
  [0x0180, 0x024f],
  [0xfffd, 0xfffd],
  [0xdc80, 0xdcff],
];

export function isBinaryArtifact(cp: number): boolean {
  return BINARY_ARTIFACT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/**
 * Cumulative artifact-count prefix: counts[i] = number of artifact code
 * points ending at or before UTF-16 index i. Mirrors
 * guard_core/detection_engine/binary_prefix.py build_binary_prefix: the
 * reference walks regex matches and records each artifact's match.end(); the
 * port walks code points and records each artifact's actual end index, so
 * gap (non-artifact) positions keep the previous count. O(n) prep, O(1)
 * density lookup per candidate match.
 */
export function buildBinaryPrefix(text: string): number[] {
  const counts = new Array<number>(text.length + 1).fill(0);
  let count = 0;
  let index = 0;
  for (const ch of text) {
    const len = ch.length;
    if (len > 1) {
      // Astral code point: intermediate UTF-16 positions (low surrogate)
      // keep the current count; no artifact class spans a surrogate pair.
      for (let k = index + 1; k < index + len; k++) counts[k] = count;
    }
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (isBinaryArtifact(ch.codePointAt(0) ?? 0)) count++;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    index += len;
    counts[index] = count;
  }
  return counts;
}

const BINARY_DENSITY_RADIUS = 64;
const BINARY_DENSITY_LIMIT = 4;

export function matchIsBinaryDensity(
  binaryPrefix: number[] | null,
  matchStart: number,
  matchEnd: number,
  textLength: number,
): boolean {
  if (binaryPrefix === null) return false;
  const high = Math.min(matchEnd + BINARY_DENSITY_RADIUS, binaryPrefix.length - 1);
  const low = Math.max(matchStart - BINARY_DENSITY_RADIUS, 0);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return (binaryPrefix[high] ?? 0) - (binaryPrefix[low] ?? 0) >= BINARY_DENSITY_LIMIT;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

const BINARY_CONTENT_RATIO_THRESHOLD = 0.2;

export function looksLikeBinaryContent(content: string): boolean {
  if (!content) return false;
  let nonTextCount = 0;
  let length = 0;
  for (const ch of content) {
    length++;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const cp = ch.codePointAt(0) ?? 0;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const isWhitespace = ch === '\t' || ch === '\r' || ch === '\n';
    if (!isWhitespace && (!isPrintableCodePoint(cp) || cp === 0xfffd)) nonTextCount++;
  }
  return nonTextCount / length >= BINARY_CONTENT_RATIO_THRESHOLD;
}
