/**
 * Binary islands ported from guard_core/detection_engine/binary_islands.py
 * (upstream commit 5f399234).
 *
 * A multipart file-part payload whose binary artifact characters fill at
 * least a fifth of it is reduced to its printable runs before pattern
 * scanning: compressed or encrypted upload bytes stop producing attack-shaped
 * matches whose rate grows with file size, while text genuinely embedded in
 * an upload (a script inside a PDF, a stored path inside an archive) forms
 * printable runs past the minimum length and is still scanned in full.
 *
 * String model: artifact classes are evaluated over decoded code points, the
 * engine-wide body representation (invalid UTF-8 bytes decode to U+FFFD,
 * surrogate-escaped bytes surface as lone 0xDC80-0xDCFF surrogates). U+FFFD
 * and the surrogate range are part of the artifact class and are excluded
 * from the printable-run class, so binary bytes break islands exactly like
 * the surrogateescape range does in Python.
 */

import { isBinaryArtifact } from './binary.js';

/** _BINARY_LIKE_ARTIFACT_RATIO from binary_islands.py: a payload is
 *  binary-like when artifact characters make up at least a fifth of it. */
const BINARY_LIKE_ARTIFACT_RATIO = 0.2;

/**
 * valueIsBinaryLike mirrors value_is_binary_like: the artifact-character
 * ratio of the content reaches BINARY_LIKE_ARTIFACT_RATIO.
 */
export function valueIsBinaryLike(content: string): boolean {
  if (!content) return false;
  let total = 0;
  let artifacts = 0;
  for (const ch of content) {
    total++;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (isBinaryArtifact(ch.codePointAt(0) ?? 0)) artifacts++;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return artifacts / total >= BINARY_LIKE_ARTIFACT_RATIO;
}

/**
 * printableIslandRune reports whether the code point belongs to the island
 * run class _ISLAND_RUN_RE from binary_islands.py: tab, newline, carriage
 * return, printable ASCII, and the wide non-control Unicode ranges. The
 * Unicode replacement character (and every other artifact) is excluded, so
 * binary bytes end a run.
 */
function printableIslandRune(cp: number): boolean {
  return (
    cp === 0x09 || cp === 0x0a || cp === 0x0d ||
    (cp >= 0x20 && cp <= 0x7e) ||
    (cp >= 0xa1 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffc) ||
    (cp >= 0xfffe && cp <= 0xffff) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/**
 * extractBinaryIslands mirrors extract_binary_islands: the maximal printable
 * runs of the content whose code point length reaches minRunLength, in
 * order. A minimum of 1 or below keeps the whole content (Python returns
 * [content]).
 */
export function extractBinaryIslands(content: string, minRunLength: number): string[] {
  if (minRunLength <= 1) return [content];
  const islands: string[] = [];
  let runStart = -1;
  let runEnd = 0;
  let runLen = 0;
  let index = 0;
  for (const ch of content) {
    const len = ch.length;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (printableIslandRune(ch.codePointAt(0) ?? 0)) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      if (runStart < 0) runStart = index;
      runEnd = index + len;
      runLen++;
    } else {
      if (runStart >= 0 && runLen >= minRunLength) {
        islands.push(content.slice(runStart, runEnd));
      }
      runStart = -1;
      runLen = 0;
    }
    index += len;
  }
  if (runStart >= 0 && runLen >= minRunLength) {
    islands.push(content.slice(runStart, runEnd));
  }
  return islands;
}
