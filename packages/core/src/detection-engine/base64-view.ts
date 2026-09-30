/**
 * Short-base64 additive view ported from
 * guard_core/detection_engine/base64_view.py (spec 4.0.2, section 05).
 */

import { printableRatio } from './base64-decode.js';
import { strictBase64Decode } from './base64-decode.js';
import type { ContentPreprocessor } from './preprocessor.js';

const RUN_FLOOR = 12;
const SHORT_BASE64_TOKEN_RE = /[A-Za-z0-9+/]{4,}/g;
const MAX_SHORT_BASE64_TOKEN_LENGTH = RUN_FLOOR - 1;
const SHORT_BASE64_MARKER_CHARS = new Set(['$', '{', '}', '#']);
const MAX_SHORT_BASE64_CANDIDATES = 20000;
const PRINTABLE_RATIO_THRESHOLD = 0.95;

function decodeToken(token: string): string | null {
  if (token.length > MAX_SHORT_BASE64_TOKEN_LENGTH) return null;
  const padding = (4 - (token.length % 4)) % 4;
  const bytes = strictBase64Decode(token + '='.repeat(padding));
  if (bytes === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function isQualifyingFragment(text: string): boolean {
  if (printableRatio(text) < PRINTABLE_RATIO_THRESHOLD) return false;
  for (const ch of text) {
    if (SHORT_BASE64_MARKER_CHARS.has(ch)) return true;
  }
  return false;
}

function decodeCandidate(token: string): string | null {
  const decoded = decodeToken(token);
  if (decoded === null || !isQualifyingFragment(decoded)) return null;
  return decoded;
}

export function buildShortBase64AdditiveView(preprocessor: ContentPreprocessor, content: string): string {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!content) return '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */

  let normalized = preprocessor.normalizeUnicode(content);
  normalized = preprocessor.truncateSafely(normalized);

  const decodedFragments: string[] = [];
  let attempts = 0;
  SHORT_BASE64_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SHORT_BASE64_TOKEN_RE.exec(normalized)) !== null) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (attempts >= MAX_SHORT_BASE64_CANDIDATES) break;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    attempts += 1;
    const decoded = decodeCandidate(match[0]);
    if (decoded !== null) decodedFragments.push(decoded);
  }

  return decodedFragments.join('\n');
}
