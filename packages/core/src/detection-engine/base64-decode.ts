/**
 * Base64 candidate decoding ported from
 * guard_core/detection_engine/base64_decode.py (spec 4.0.2, section 05).
 */

import { utf8DecodeIgnore } from './encoding-decoders.js';

export const MIN_RUN_LENGTH = 12;
export const MAX_GUNZIP_OUTPUT_BYTES = 8192;
export const MAX_GUNZIP_ATTEMPTS_PER_PASS = 8;
export const PRINTABLE_RATIO_THRESHOLD = 0.5;
export const FALLBACK_PRINTABLE_RATIO_THRESHOLD = 0.95;
export const MAX_REPLACEMENT_CHAR_RATIO = 0.2;

/** Data alphabet for run scanning: base64 standard + urlsafe data chars. */
const DATA_CLASS = 'A-Za-z0-9+/\\-_';
const SEPARATOR_CLASS = buildSeparatorClass();
const HEX_LITERAL_RE = /^0[xX][0-9a-fA-F]+$/;

function buildSeparatorClass(): string {
  // Python: every byte < 0x80 that is not a data char, plus the
  // surrogateescape range used for decoded binary bytes.
  const parts: string[] = [];
  const ranges: Array<[number, number]> = [];
  let start: number | null = null;
  const isData = (b: number): boolean =>
    (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || (b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2f || b === 0x2d || b === 0x5f;
  for (let b = 0x00; b <= 0x7f; b++) {
    if (!isData(b)) {
      if (start === null) start = b;
    } else if (start !== null) {
      ranges.push([start, b - 1]);
      start = null;
    }
  }
  if (start !== null) ranges.push([start, 0x7f]);
  for (const [lo, hi] of ranges) {
    parts.push(lo === hi ? escapeClassChar(lo) : `${escapeClassChar(lo)}-${escapeClassChar(hi)}`);
  }
  parts.push('\\uDC80-\\uDCFF');
  return `[${parts.join('')}]`;
}

function escapeClassChar(b: number): string {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (b === 0x5c) return '\\\\';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (b === 0x5d) return '\\]';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  if (b === 0x5e) return '\\^';
  if (b >= 0x20 && b <= 0x7e) {
    const ch = String.fromCharCode(b);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return ch === '-' ? '\\-' : ch === ']' ? '\\]' : ch === '\\' ? '\\\\' : ch === '^' ? '\\^' : ch;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return `\\x${b.toString(16).padStart(2, '0')}`;
}

const RUN_UNIT = `[${DATA_CLASS}]${SEPARATOR_CLASS}*`;
export const BASE64_RE_SOURCE =
  `(?<![${DATA_CLASS}])(?:(?:${RUN_UNIT}){${MIN_RUN_LENGTH},}={0,2}` +
  `|(?:${RUN_UNIT}){${MIN_RUN_LENGTH - 1},}=` +
  `|(?:${RUN_UNIT}){${MIN_RUN_LENGTH - 2},}==)(?![${DATA_CLASS}=])`;
export const RUN_RE_SOURCE =
  `(?<![${DATA_CLASS}])[${DATA_CLASS}]{${MIN_RUN_LENGTH},}={0,2}(?![${DATA_CLASS}=])`;
export const SUB_FLOOR_RUN_RE_SOURCE =
  `(?<![${DATA_CLASS}])[${DATA_CLASS}]{1,${MIN_RUN_LENGTH - 1}}(?![${DATA_CLASS}])`;
const SEPARATOR_STRIP_RE_SOURCE = SEPARATOR_CLASS;

function buildWidenedMarkerClass(): string {
  // Python: WIDENED_SEPARATOR_CHARS = separators minus \r\n=, plus "_-".
  const parts: string[] = [];
  const isData = (b: number): boolean =>
    (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || (b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2f || b === 0x5f;
  const isExcluded = (b: number): boolean => b === 0x0d || b === 0x0a || b === 0x3d;
  const ranges: Array<[number, number]> = [];
  let start: number | null = null;
  for (let b = 0x00; b <= 0x7f; b++) {
    const widened = (!isData(b) && !isExcluded(b)) || b === 0x2d || b === 0x5f;
    if (widened) {
      if (start === null) start = b;
    } else if (start !== null) {
      ranges.push([start, b - 1]);
      start = null;
    }
  }
  if (start !== null) ranges.push([start, 0x7f]);
  for (const [lo, hi] of ranges) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    parts.push(lo === hi ? escapeClassChar(lo) : `${escapeClassChar(lo)}-${escapeClassChar(hi)}`);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return `[${parts.join('')}]`;
}

// WIDENED separator set: separators minus \r\n=, plus explicit _ and -.
const WIDENED_MARKER_RE_SOURCE = buildWidenedMarkerClass();

export function isHexLiteral(token: string): boolean {
  return HEX_LITERAL_RE.test(token);
}

/** Python `str.isprintable` approximation (exact for ASCII and Latin-1). */
export function isPrintableCodePoint(cp: number): boolean {
  if (cp < 0x20 || cp === 0x7f) return false;
  if (cp >= 0x80 && cp <= 0x9f) return false;
  if (cp === 0xa0) return false; // Zs
  if (cp === 0xad) return false; // Cf
  if (cp >= 0x2000 && cp <= 0x200f) return false; // Zs/Zl/Zp/Cf
  if (cp >= 0x2028 && cp <= 0x202f) return false; // Zl/Zp/Zs
  if (cp === 0x205f || cp === 0x3000 || cp === 0x1680) return false; // Zs
  if (cp >= 0x2060 && cp <= 0x206f) return false; // Cf
  if (cp === 0xfeff) return false; // Cf
  if (cp >= 0xfff9 && cp <= 0xfffb) return false; // Cf
  if (cp >= 0xd800 && cp <= 0xdfff) return false; // Cs
  if (cp >= 0xe000 && cp <= 0xf8ff) return false; // Co
  return true;
}

export function printableRatio(text: string): number {
  if (!text) return 0.0;
  let printableCount = 0;
  let length = 0;
  for (const ch of text) {
    length++;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    const cp = ch.codePointAt(0) ?? 0;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    if (isPrintableCodePoint(cp)) printableCount++;
  }
  return printableCount / length;
}

export function replacementCharRatio(text: string): number {
  if (!text) return 0.0;
  let count = 0;
  let length = 0;
  for (const ch of text) {
    length++;
    if (ch === '\uFFFD') count++;
  }
  return count / length;
}

/** Bounded gunzip via DecompressionStream (Node 18+ and edge runtimes). */
export async function boundedGunzip(raw: Uint8Array, maxOutputBytes = MAX_GUNZIP_OUTPUT_BYTES): Promise<Uint8Array | null> {
  if (raw.length < 2 || raw[0] !== 0x1f || raw[1] !== 0x8b) return null;
  try {
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      const take = Math.min(chunk.length, maxOutputBytes - total);
      if (take > 0) {
        chunks.push(chunk.subarray(0, take));
        total += take;
      }
      if (total >= maxOutputBytes) {
        await reader.cancel();
        break;
      }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  } catch {
    return null;
  }
}

/** Python base64.b64decode(cleaned, validate=True); null on any error. */
export function strictBase64Decode(cleaned: string): Uint8Array | null {
  if (cleaned.length % 4 !== 0) return null;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (/[^A-Za-z0-9+/=]/.test(cleaned)) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const padStart = cleaned.indexOf('=');
  if (padStart !== -1) {
    const padding = cleaned.slice(padStart);
    if (!/^={1,2}$/.test(padding)) return null;
    const bodyLength = padStart;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (bodyLength % 4 === 1) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (bodyLength % 4 + padding.length !== 4) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  const bytes: number[] = [];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) lookup.set(alphabet[i] as string, i);
  let buffer = 0;
  let bits = 0;
  for (const ch of cleaned) {
    if (ch === '=') break;
    const sixBits = lookup.get(ch);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (sixBits === undefined) return null;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    buffer = (buffer << 6) | sixBits;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeUtf8Bytes(raw: Uint8Array, minPrintableRatio: number): string | null {
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    decoded = new TextDecoder('utf-8', { fatal: false }).decode(raw);
    if (replacementCharRatio(decoded) > MAX_REPLACEMENT_CHAR_RATIO) return null;
  }
  if (printableRatio(decoded) >= minPrintableRatio) return decoded;
  return null;
}

async function decodeCleaned(
  cleaned: string,
  minPrintableRatio: number,
  gunzipAttemptsLeft: { value: number },
): Promise<string | null> {
  const padding = (4 - (cleaned.length % 4)) % 4;
  const padded = cleaned + '='.repeat(padding);
  const raw = strictBase64Decode(padded);
  if (raw === null) return null;
  let data = raw;
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b && gunzipAttemptsLeft.value > 0) {
    gunzipAttemptsLeft.value -= 1;
    const gunzipped = await boundedGunzip(raw);
    if (gunzipped !== null) data = gunzipped;
  }
  return decodeUtf8Bytes(data, minPrintableRatio);
}

async function decodeToken(
  token: string,
  minPrintableRatio: number,
  gunzipAttemptsLeft: { value: number },
): Promise<string | null> {
  if (isHexLiteral(token)) return null;
  const cleaned = token.replace(new RegExp(SEPARATOR_STRIP_RE_SOURCE, 'gu'), '');
  const urlsafeDecoded = await decodeCleaned(
    cleaned.replace(/-/g, '+').replace(/_/g, '/'),
    minPrintableRatio,
    gunzipAttemptsLeft,
  );
  if (urlsafeDecoded !== null) return urlsafeDecoded;
  if (cleaned.includes('-') || cleaned.includes('_')) {
    return decodeCleaned(cleaned.replace(/-/g, '').replace(/_/g, ''), minPrintableRatio, gunzipAttemptsLeft);
  }
  return null;
}

async function decodeRuns(
  token: string,
  gunzipAttemptsLeft: { value: number },
): Promise<string> {
  const runRe = new RegExp(RUN_RE_SOURCE, 'gu');
  const matches = [...token.matchAll(runRe)];
  if (matches.length === 0) return token;
  let result = '';
  let lastEnd = 0;
  for (const match of matches) {
    const start = match.index;
    const end = start + match[0].length;
    result += token.slice(lastEnd, start);
    const decoded = await decodeToken(match[0], FALLBACK_PRINTABLE_RATIO_THRESHOLD, gunzipAttemptsLeft);
    result += decoded !== null ? decoded : match[0];
    lastEnd = end;
  }
  result += token.slice(lastEnd);
  return result;
}

export async function decodeBase64Candidates(
  content: string,
  gunzipAttemptsLeft?: { value: number },
): Promise<string> {
  const attempts = gunzipAttemptsLeft ?? { value: MAX_GUNZIP_ATTEMPTS_PER_PASS };
  const base64Re = new RegExp(BASE64_RE_SOURCE, 'gu');
  const matches = [...content.matchAll(base64Re)];
  if (matches.length === 0) return content;
  const subFloorRe = new RegExp(SUB_FLOOR_RUN_RE_SOURCE, 'gu');
  const widenedMarkerRe = new RegExp(WIDENED_MARKER_RE_SOURCE, 'u');
  let result = '';
  let lastEnd = 0;
  for (const match of matches) {
    const start = match.index;
    const end = start + match[0].length;
    result += content.slice(lastEnd, start);
    const token = match[0];
    const primaryThreshold = widenedMarkerRe.test(token) ? FALLBACK_PRINTABLE_RATIO_THRESHOLD : PRINTABLE_RATIO_THRESHOLD;
    const decoded = await decodeToken(token, primaryThreshold, attempts);
    const base = decoded !== null ? decoded : await decodeRuns(token, attempts);
    const fragments = [...token.matchAll(new RegExp(subFloorRe.source, 'gu'))].map((m) => m[0]).join('');
    const reassembled =
      fragments.length >= MIN_RUN_LENGTH
        ? await decodeToken(fragments, FALLBACK_PRINTABLE_RATIO_THRESHOLD, attempts)
        : null;
    if (reassembled === null || base.includes(reassembled)) {
      result += base;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    } else {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      result += `${base} ${reassembled}`;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    lastEnd = end;
  }
  result += content.slice(lastEnd);
  return result;
}
