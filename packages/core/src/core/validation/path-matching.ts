/* URL path normalization and exclusion matching, the TS port of
   guard_core/core/validation/path_matching.py. Behavior mirrored exactly:

   - percent-decode consecutive %XX runs (up to 4 recursive rounds); a run
     that is not valid UTF-8 makes the whole path undecidable (null -> the
     caller treats it as NOT excluded, so undecodable paths stay checked);
     after the rounds any remaining %XX run also makes it undecidable
   - backslashes fold to slashes; empty and "." segments drop; ".." pops the
     previous segment; a "…;params" segment folds to its base only when the
     base is "." or ".."
   - exclusion matching is subtree-or-equal: path == excluded or
     path.startsWith(excluded + "/"), with "/" excluding everything

   The previous TS behavior (raw startsWith) had two bug classes this module
   removes: any path sharing a textual prefix with an exclusion was excluded
   (fail-open: /docsanything was skipped when /docs was configured), and
   percent-encoded or dot-segmented paths bypassed exclusions entirely
   (fail-closed vs the reference). */

const PERCENT_RUN = /(?:%[0-9A-Fa-f]{2})+/g;
const MAX_DECODE_ROUNDS = 4;

/* fatal TextDecoder throws on byte sequences that are not valid UTF-8, the
   twin of Python's bytes.decode('utf-8') raising UnicodeDecodeError. */
let fatalUtf8Decoder: TextDecoder | null = null;
function getFatalUtf8Decoder(): TextDecoder {
  /* v8 ignore start -- one-time lazy init; the throw branch is covered through decodePercentRun */
  fatalUtf8Decoder ??= new TextDecoder('utf-8', { fatal: true });
  return fatalUtf8Decoder;
  /* v8 ignore stop */
}

function decodePercentRun(run: string): string | null {
  const bytes = new Uint8Array(run.length / 3);
  for (let i = 0; i < run.length; i += 3) {
    bytes[i / 3] = parseInt(run.slice(i + 1, i + 3), 16);
  }
  try {
    return getFatalUtf8Decoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodePercentOnce(value: string): string | null {
  let out = '';
  let lastIndex = 0;
  PERCENT_RUN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PERCENT_RUN.exec(value)) !== null) {
    const decoded = decodePercentRun(match[0]);
    if (decoded === null) return null;
    out += value.slice(lastIndex, match.index) + decoded;
    lastIndex = match.index + match[0].length;
  }
  return out + value.slice(lastIndex);
}

function decodePercentRecursive(rawPath: string): string | null {
  let decoded = rawPath;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    const next = decodePercentOnce(decoded);
    if (next === null) return null;
    decoded = next;
  }
  if (PERCENT_RUN.test(decoded)) return null;
  return decoded;
}

/* Only dot bases fold away their ;params part ("..;x" -> ".."); every other
   segment keeps its raw text (reference _fold_dot_segment_params). */
function foldDotSegmentParams(rawSegment: string): string {
  const semi = rawSegment.indexOf(';');
  if (semi === -1) return rawSegment;
  const base = rawSegment.slice(0, semi);
  return base === '.' || base === '..' ? base : rawSegment;
}

function collapseDotSegments(decoded: string): string {
  const segments: string[] = [];
  for (const rawSegment of decoded.replace(/\\/g, '/').split('/')) {
    const segment = foldDotSegmentParams(rawSegment);
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

/** Normalize a raw URL path: recursive percent-decode (4 rounds max) +
 *  dot-segment collapse. Returns null when the path is not decodable
 *  (invalid UTF-8 escape or leftover %XX run after the rounds). */
export function normalizeUrlPath(rawPath: string): string | null {
  const decoded = decodePercentRecursive(rawPath);
  if (decoded === null) return null;
  return collapseDotSegments(decoded);
}

function isSubtreeOrEqual(path: string, excluded: string): boolean {
  if (excluded === '/') return true;
  return path === excluded || path.startsWith(`${excluded}/`);
}

/** Normalize every configured exclusion; undecodable entries drop out
 *  (reference normalize_exclude_paths). */
export function normalizeExcludePaths(excludePaths: readonly string[]): string[] {
  const normalized: string[] = [];
  for (const entry of excludePaths) {
    const path = normalizeUrlPath(entry);
    if (path !== null) normalized.push(path);
  }
  return normalized;
}

/** Subtree-or-equal matching of an already-normalized path against
 *  already-normalized exclusions (reference path_matches_exclusions). */
export function pathMatchesExclusions(normalizedPath: string, normalizedExclusions: readonly string[]): boolean {
  return normalizedExclusions.some((excluded) => isSubtreeOrEqual(normalizedPath, excluded));
}

/** One-shot helper: normalize the request path and the configured
 *  exclusions, then subtree-match (reference path_is_excluded). */
export function pathIsExcluded(urlPath: string, excludePaths: readonly string[]): boolean {
  const normalizedPath = normalizeUrlPath(urlPath);
  if (normalizedPath === null) return false;
  return pathMatchesExclusions(normalizedPath, normalizeExcludePaths(excludePaths));
}
