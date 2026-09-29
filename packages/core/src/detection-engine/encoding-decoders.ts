/**
 * Encoding decoders ported from
 * guard_core/detection_engine/encoding_decoders.py and the HTML/percent
 * decoding stages of the content pipeline (spec 4.0.2, section 05).
 */

import { HTML5_ENTITIES, INVALID_CHARREFS, INVALID_CODEPOINTS } from './html-entities.js';

const HEX_ESCAPE_RE = /\\x([0-9a-fA-F]{2})/g;
const UNICODE_ESCAPE_RE = /\\u([0-9a-fA-F]{4})/g;
const LDAP_HEX_ESCAPE_RE = /\\([0-9a-fA-F]{2})/g;
const PERCENT_U_ESCAPE_RE = /%u([0-9a-fA-F]{4})/gi;
const PERCENT_BYTE_RUN_RE = /(?:%[0-9a-fA-F]{2})+/g;

const OVERLONG_LEAD_SPECS = new Map<number, [number, number, number, number]>([
  [0xc0, [2, 0x1f, 0x80, 0xbf]],
  [0xc1, [2, 0x1f, 0x80, 0xbf]],
  [0xe0, [3, 0x0f, 0x80, 0x9f]],
  [0xf0, [4, 0x07, 0x80, 0x8f]],
]);

export function decodeHexEscapes(content: string): string {
  return content.replace(HEX_ESCAPE_RE, (match, hex: string) => {
    const code = Number.parseInt(hex, 16);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return Number.isNaN(code) ? match : String.fromCharCode(code);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  });
}

export function decodeUnicodeEscapes(content: string): string {
  return content.replace(UNICODE_ESCAPE_RE, (match, hex: string) => {
    const code = Number.parseInt(hex, 16);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return Number.isNaN(code) ? match : String.fromCharCode(code);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  });
}

export function decodeLdapHexEscapes(content: string): string {
  return content.replace(LDAP_HEX_ESCAPE_RE, (match, hex: string) => {
    const code = Number.parseInt(hex, 16);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return Number.isNaN(code) ? match : String.fromCharCode(code);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  });
}

export function decodePercentUEscapes(content: string): string {
  return content.replace(PERCENT_U_ESCAPE_RE, (match, hex: string) => {
    const code = Number.parseInt(hex, 16);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return Number.isNaN(code) ? match : String.fromCharCode(code);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  });
}

function decodeOverlongSequenceAt(raw: Uint8Array, index: number): [string, number] | null {
  const spec = OVERLONG_LEAD_SPECS.get(raw[index] as number);
  if (spec === undefined || index + spec[0] > raw.length) return null;
  const [sequenceLength, leadMask, firstMin, firstMax] = spec;
  const continuations = raw.slice(index + 1, index + sequenceLength);
  const first = continuations[0];
  if (first === undefined || first < firstMin || first > firstMax) return null;
  if (continuations.slice(1).some((byte) => byte < 0x80 || byte > 0xbf)) return null;
  let codepoint = (raw[index] as number) & leadMask;
  for (const byte of continuations) {
    codepoint = (codepoint << 6) | (byte & 0x3f);
  }
  return [String.fromCodePoint(codepoint), sequenceLength];
}

export function lenientOverlongUtf8Decode(raw: Uint8Array): string {
  const chars: string[] = [];
  let index = 0;
  while (index < raw.length) {
    const overlong = decodeOverlongSequenceAt(raw, index);
    if (overlong !== null) {
      chars.push(overlong[0]);
      index += overlong[1];
    } else if ((raw[index] as number) < 0x80) {
      chars.push(String.fromCharCode(raw[index] as number));
      index += 1;
    } else {
      index += 1;
    }
  }
  return chars.join('');
}

export function decodeOverlongUtf8PercentRuns(content: string): string {
  return content.replace(PERCENT_BYTE_RUN_RE, (run) => {
    const bytes: number[] = [];
    for (let i = 0; i < run.length; i += 3) {
      bytes.push(Number.parseInt(run.slice(i + 1, i + 3), 16));
    }
    const raw = Uint8Array.from(bytes);
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(raw);
      return run;
    } catch {
      return lenientOverlongUtf8Decode(raw);
    }
  });
}

// ---------------------------------------------------------------------------
// urllib.parse.unquote(content, errors='ignore')
// ---------------------------------------------------------------------------

const PRINTABLE_ASCII_RUN_RE = /[ -~]+/g;

/**
 * UTF-8 decode with Python's errors='ignore' semantics: valid sequences
 * decode; invalid bytes are dropped (never replaced).
 */
export function utf8DecodeIgnore(bytes: Uint8Array): string {
  let result = '';
  let index = 0;
  const length = bytes.length;
  const isCont = (b: number | undefined): b is number => b !== undefined && b >= 0x80 && b <= 0xbf;
  while (index < length) {
    const b0 = bytes[index] as number;
    let char: string | null = null;
    let consumed = 1;
    if (b0 < 0x80) {
      char = String.fromCharCode(b0);
    } else if (b0 >= 0xc2 && b0 <= 0xdf && isCont(bytes[index + 1])) {
      char = String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[index + 1] as number));
      consumed = 2;
    } else if (b0 === 0xe0 && isCont(bytes[index + 1]) && (bytes[index + 1] as number) >= 0xa0 && isCont(bytes[index + 2])) {
      char = String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[index + 1] as number) << 6) | ((bytes[index + 2] as number) & 0x3f));
      consumed = 3;
    } else if (
      ((b0 >= 0xe1 && b0 <= 0xec) || b0 === 0xee || b0 === 0xef) &&
      isCont(bytes[index + 1]) &&
      isCont(bytes[index + 2])
    ) {
      char = String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[index + 1] as number) << 6) | ((bytes[index + 2] as number) & 0x3f));
      consumed = 3;
    } else if (b0 === 0xed && isCont(bytes[index + 1]) && (bytes[index + 1] as number) <= 0x9f && isCont(bytes[index + 2])) {
      char = String.fromCharCode(((b0 & 0x0f) << 12) | ((bytes[index + 1] as number) << 6) | ((bytes[index + 2] as number) & 0x3f));
      consumed = 3;
    } else if (b0 === 0xf0 && isCont(bytes[index + 1]) && (bytes[index + 1] as number) >= 0x90 && isCont(bytes[index + 2]) && isCont(bytes[index + 3])) {
      const cp = ((b0 & 0x07) << 18) | ((bytes[index + 1] as number) << 12) | ((bytes[index + 2] as number) << 6) | ((bytes[index + 3] as number) & 0x3f);
      char = String.fromCodePoint(cp);
      consumed = 4;
    } else if ((b0 === 0xf1 || b0 === 0xf2 || b0 === 0xf3) && isCont(bytes[index + 1]) && isCont(bytes[index + 2]) && isCont(bytes[index + 3])) {
      const cp = ((b0 & 0x07) << 18) | ((bytes[index + 1] as number) << 12) | ((bytes[index + 2] as number) << 6) | ((bytes[index + 3] as number) & 0x3f);
      char = String.fromCodePoint(cp);
      consumed = 4;
    } else if (b0 === 0xf4 && isCont(bytes[index + 1]) && (bytes[index + 1] as number) <= 0x8f && isCont(bytes[index + 2]) && isCont(bytes[index + 3])) {
      const cp = ((b0 & 0x07) << 18) | ((bytes[index + 1] as number) << 12) | ((bytes[index + 2] as number) << 6) | ((bytes[index + 3] as number) & 0x3f);
      char = String.fromCodePoint(cp);
      consumed = 4;
    }
    if (char !== null) {
      result += char;
      index += consumed;
    } else {
      index += 1;
    }
  }
  return result;
}

function runToBytes(run: string): number[] {
  // `run` is pure printable ASCII ([0x20-0x7e]); each char is one byte.
  const bytes: number[] = [];
  const pieces = run.split('%');
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  for (const ch of pieces[0] ?? '') bytes.push(ch.charCodeAt(0));
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  for (const item of pieces.slice(1)) {
    if (item.length >= 2 && /^[0-9a-fA-F]{2}/.test(item)) {
      bytes.push(Number.parseInt(item.slice(0, 2), 16));
      for (const ch of item.slice(2)) bytes.push(ch.charCodeAt(0));
    } else {
      bytes.push(0x25);
      for (const ch of item) bytes.push(ch.charCodeAt(0));
    }
  }
  return bytes;
}

/**
 * Python `urllib.parse.unquote(s, errors='ignore')`: printable-ASCII runs
 * are unquoted into a byte sequence and decoded as UTF-8 with invalid
 * sequences dropped; everything outside the printable runs passes through
 * verbatim.
 */
export function pyUnquote(content: string): string {
  if (!content.includes('%')) return content;
  const parts: string[] = [];
  let cursor = 0;
  PRINTABLE_ASCII_RUN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRINTABLE_ASCII_RUN_RE.exec(content)) !== null) {
    parts.push(content.slice(cursor, match.index));
    parts.push(match[0]);
    cursor = match.index + match[0].length;
  }
  parts.push(content.slice(cursor));

  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  let out = parts[0] ?? '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  for (let i = 1; i < parts.length; i += 2) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    out += utf8DecodeIgnore(Uint8Array.from(runToBytes(parts[i] ?? '')));
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    out += parts[i + 1] ?? '';
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return out;
}

// ---------------------------------------------------------------------------
// html.unescape
// ---------------------------------------------------------------------------

const CHARREF_RE = /&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/g;

function replaceCharref(match: string, body: string): string {
  if (body.startsWith('#')) {
    let num: number;
    if (body[1] === 'x' || body[1] === 'X') {
      num = Number.parseInt(body.slice(2).replace(/;+$/, ''), 16);
    } else {
      num = Number.parseInt(body.slice(1).replace(/;+$/, ''), 10);
    }
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (Number.isNaN(num)) return match;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    const invalid = INVALID_CHARREFS[num];
    if (invalid !== undefined) return invalid;
    if ((num >= 0xd800 && num <= 0xdfff) || num > 0x10ffff) return '\uFFFD';
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (INVALID_CODEPOINTS.has(num)) return '';
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    return String.fromCodePoint(num);
  }
  const direct = HTML5_ENTITIES[body];
  if (direct !== undefined) return direct;
  for (let x = body.length - 1; x > 1; x--) {
    const prefix = HTML5_ENTITIES[body.slice(0, x)];
    if (prefix !== undefined) return prefix + body.slice(x);
  }
  return `&${body}`;
}

/** Python `html.unescape`. */
export function htmlUnescape(content: string): string {
  if (!content.includes('&')) return content;
  return content.replace(CHARREF_RE, replaceCharref);
}
