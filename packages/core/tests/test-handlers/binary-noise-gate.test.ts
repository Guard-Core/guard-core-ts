/**
 * Honesty tests for the 4.0.3 binary-body noise gate, ported from
 * guard-core tests/test_sus_patterns/test_pattern_binary_noise_gate.py
 * (upstream commit 436d6f72).
 *
 * The gate discards matches from noise-prone, low-specificity patterns when
 * the 64-character window around the match holds 4+ binary artifact
 * characters, so text-decoded binary uploads (zips, multipart parts) stop
 * being blocked while attacks hidden in binary padding are still caught and
 * signature patterns are never gated.
 *
 * String-model note (Python -> JS mapping): the Python reference scans
 * decoded text where invalid UTF-8 bytes surface as surrogateescape code
 * points U+DC80-U+DCFF and replacement chars U+FFFD; both are artifact
 * classes in the density regex. The TS engine decodes request bytes with
 * TextDecoder (lossy), which surfaces the same invalid bytes as U+FFFD, and
 * U+FFFD is in the TS artifact ranges, so the observable artifact density
 * matches. These tests exercise both views natively: the latin1 view maps
 * bytes to U+0000-U+00FF like Python's latin-1 decode, and the
 * surrogateescape view is reproduced with a test-local decoder.
 */

import { describe, it, expect } from 'vitest';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { NOISE_PRONE_PATTERN_SOURCES } from '../../src/detection-engine/patterns/pattern-table.js';
import { _SQLI_COMMENT_TERMINATOR_RE } from '../../src/detection-engine/patterns/canonical-sources.generated.js';
import { buildRegexThreat, getCompiledPatterns } from '../../src/detection-engine/patterns/index.js';
import { buildBinaryPrefix } from '../../src/detection-engine/binary.js';
import { compilePythonPattern } from '../../src/detection-engine/regex-compat.js';
import { createTestConfig } from '../helpers.js';
import { defaultLogger } from '../../src/models/logger.js';

const MULTIPART_FIELD_CONTEXT = 'request_body:multipart_field';
const NOISE_SEEDS = [1, 2, 3, 42, 1337];
const NOISE_SIZE = 262144;
const DECODED_VIEWS = ['latin1', 'surrogateescape'] as const;
type DecodedView = (typeof DECODED_VIEWS)[number];

const ATTACK_PAYLOADS = [
  '`rm -rf /`',
  '$(cat /etc/passwd)',
  "c'a't config.ini",
  "'; DROP TABLE users;--",
  '../../../etc/passwd',
];

const PLAIN_TEXT_SAMPLES = [
  'Café résumé naïve décor sélection',
  '日本語のテキストです。中国語與繁體字。한국어 텍스트',
  'кириллица и русский текст',
];

/** Same detection knobs as the reference conftest fixture. */
function createManager(): SusPatternsManager {
  return new SusPatternsManager(
    createTestConfig({
      detectionCompilerTimeout: 2.0,
      detectionMaxContentLength: 10000,
      detectionPreserveAttackPatterns: true,
      detectionSemanticThreshold: 0.7,
      detectionAnomalyThreshold: 3.0,
      detectionSlowPatternThreshold: 0.1,
      detectionMonitorHistorySize: 1000,
      detectionMaxTrackedPatterns: 1000,
    }),
    defaultLogger,
  );
}

function noiseBytes(seed: number): Uint8Array {
  // Deterministic native PRNG (mulberry32); the honesty property is
  // noise-class-based, not tied to Python's Mersenne Twister stream.
  let state = seed >>> 0;
  const bytes = new Uint8Array(NOISE_SIZE);
  for (let i = 0; i < NOISE_SIZE; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    bytes[i] = ((t ^ (t >>> 14)) & 0xff) as number;
  }
  return bytes;
}

/** Python bytes.decode('latin-1'): every byte becomes U+0000-U+00FF. */
function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

/** Python bytes.decode('utf-8', errors='surrogateescape'): invalid byte b -> U+DC80+b. */
export function utf8DecodeSurrogateescape(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  const isCont = (b: number | undefined): b is number => b !== undefined && b >= 0x80 && b <= 0xbf;
  while (i < bytes.length) {
    const b0 = bytes[i] as number;
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if (b0 >= 0xc2 && b0 <= 0xdf && isCont(bytes[i + 1])) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | ((bytes[i + 1] as number) & 0x3f));
      i += 2;
    } else if (
      b0 >= 0xe0 &&
      b0 <= 0xef &&
      isCont(bytes[i + 1]) &&
      isCont(bytes[i + 2]) &&
      !(b0 === 0xe0 && (bytes[i + 1] as number) < 0xa0) &&
      !(b0 === 0xed && (bytes[i + 1] as number) >= 0xa0)
    ) {
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | (((bytes[i + 1] as number) & 0x3f) << 6) | ((bytes[i + 2] as number) & 0x3f),
      );
      i += 3;
    } else if (
      b0 >= 0xf0 &&
      b0 <= 0xf4 &&
      isCont(bytes[i + 1]) &&
      isCont(bytes[i + 2]) &&
      isCont(bytes[i + 3]) &&
      !(b0 === 0xf0 && (bytes[i + 1] as number) < 0x90) &&
      !(b0 === 0xf4 && (bytes[i + 1] as number) > 0x8f)
    ) {
      const cp =
        ((b0 & 0x07) << 18) |
        (((bytes[i + 1] as number) & 0x3f) << 12) |
        (((bytes[i + 2] as number) & 0x3f) << 6) |
        ((bytes[i + 3] as number) & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    } else {
      out += String.fromCharCode(0xdc00 + b0);
      i += 1;
    }
  }
  return out;
}

function decodedNoise(seed: number, view: DecodedView): string {
  const raw = noiseBytes(seed);
  return view === 'latin1' ? latin1Decode(raw) : utf8DecodeSurrogateescape(raw);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc = CRC32_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal stored (uncompressed) zip archive containing one binary entry. */
function zipBytes(seed: number): Uint8Array {
  const payload = noiseBytes(seed).slice(0, 50000);
  const encoder = new TextEncoder();
  const name = encoder.encode('attachment.bin');
  const crc = crc32(payload);
  const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  const localHeader = new Uint8Array([
    ...u32(0x04034b50),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(crc),
    ...u32(payload.length),
    ...u32(payload.length),
    ...u16(name.length),
    ...u16(0),
    ...name,
  ]);
  const centralHeader = new Uint8Array([
    ...u32(0x02014b50),
    ...u16(20),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(crc),
    ...u32(payload.length),
    ...u32(payload.length),
    ...u16(name.length),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...name,
  ]);
  const eocd = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(1),
    ...u16(1),
    ...u32(centralHeader.length),
    ...u32(localHeader.length + payload.length),
    ...u16(0),
  ]);

  const total = localHeader.length + payload.length + centralHeader.length + eocd.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of [localHeader, payload, centralHeader, eocd]) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function detect(manager: SusPatternsManager, payload: string) {
  return manager.detect(payload, '127.0.0.1', MULTIPART_FIELD_CONTEXT);
}

describe('binary noise gate (spec 4.0.3 honesty tests)', () => {
  /* The noise scans are the heaviest CPU loops in the suite; the explicit
     timeout keeps a loaded CI runner from tripping the 5s default. */
  it.each(DECODED_VIEWS.flatMap((view) => NOISE_SEEDS.map((seed) => ({ view, seed }))))(
    'random binary noise produces zero threats (view=$view seed=$seed)',
    { timeout: 30_000 },
    async ({ view, seed }) => {
      const manager = createManager();
      const result = await detect(manager, decodedNoise(seed, view));
      expect(result.isThreat).toBe(false);
      expect(result.threats).toEqual([]);
    },
  );

  it('zip upload produces zero threats', async () => {
    const manager = createManager();
    const result = await detect(manager, utf8DecodeSurrogateescape(zipBytes(11)));
    expect(result.isThreat).toBe(false);
    expect(result.threats).toEqual([]);
  });

  it.each(ATTACK_PAYLOADS)('real payload still detected: %s', async (payload) => {
    const manager = createManager();
    const result = await detect(manager, payload);
    expect(result.isThreat).toBe(true);
    expect(result.threats.length).toBeGreaterThan(0);
  });

  it.each(PLAIN_TEXT_SAMPLES)('non-Latin text without payload not flagged: %s', async (sample) => {
    const manager = createManager();
    const result = await detect(manager, sample);
    expect(result.isThreat).toBe(false);
    expect(result.threats).toEqual([]);
  });

  it.each(PLAIN_TEXT_SAMPLES)('non-Latin text with embedded backtick still detected: %s', async (sample) => {
    const manager = createManager();
    const result = await detect(manager, `${sample}; \`rm -rf /\``);
    expect(result.isThreat).toBe(true);
    expect(result.threats.length).toBeGreaterThan(0);
  });

  it('payload near string start still detected', async () => {
    const manager = createManager();
    const result = await detect(manager, '../../../etc/passwd and more prose here');
    expect(result.isThreat).toBe(true);
  });

  it('payload near string end still detected', async () => {
    const manager = createManager();
    const result = await detect(manager, `${'prose '.repeat(30)}../../../etc/passwd`);
    expect(result.isThreat).toBe(true);
  });

  it('short value below window margin still detected', async () => {
    const manager = createManager();
    const result = await detect(manager, "café '; DELETE FROM users;--");
    expect(result.isThreat).toBe(true);
  });

  it.each([
    '\x00'.repeat(500),
    Array.from({ length: 31 }, (_, i) => String.fromCharCode(i + 1)).join('').repeat(40),
    '\x7f'.repeat(300),
  ])('control-char-only value not flagged', async (controlOnly) => {
    const manager = createManager();
    const result = await detect(manager, controlOnly);
    expect(result.isThreat).toBe(false);
    expect(result.threats).toEqual([]);
  });

  it.each([
    '\x85'.repeat(200) + '..' + '\x9f\x9e\x9d\x9c' + '/' + '\x87'.repeat(200),
    '\x85'.repeat(200) + '$(cat /etc/passwd)' + '\x87'.repeat(200),
  ])('payload fragment buried in binary noise not flagged', async (payload) => {
    const manager = createManager();
    const result = await detect(manager, payload);
    expect(result.isThreat).toBe(false);
    expect(result.threats).toEqual([]);
  });

  it('binary noise scan completes under five seconds', async () => {
    const manager = createManager();
    const started = performance.now();
    const result = await detect(manager, decodedNoise(3, 'latin1'));
    const elapsed = performance.now() - started;
    expect(result.isThreat).toBe(false);
    expect(result.threats.some((t) => t.detectionMethod.includes('timeout'))).toBe(false);
    expect(elapsed).toBeLessThan(5000);
  });

  it('noise-prone registry is non-empty and covers the 4.0.3 sources', () => {
    // Sanity pin: the frozen 4.0.3 registry holds the ten low-specificity
    // shell-source heuristics (backtick pairs, dollar substitutions, quote
    // splice, glob wildcards, template fragments, LDAP paren conjunction,
    // SQLi comment terminators, f5d53ca5).
    expect(NOISE_PRONE_PATTERN_SOURCES.size).toBe(10);
  });

  it('PDF comment line with SQLi terminator bytes is not flagged', async () => {
    // Regression for the real-world 558KB-PDF false positive (guard-core
    // f5d53ca5): a PDF header whose binary comment region contains an
    // apostrophe, a newline and dashes must not be reported as SQLi.
    const manager = createManager();
    const pdfPrefix = '%PDF-1.4\n%\xc7\x8f\xa2\n7 0 obj\n<</Length 8 0 R/Filter /FlateDecode>>\nstream\n';
    // Latin-1 byte encode so the raw bytes match the reference fixture
    // (b"%PDF-1.4\n%\xc7\x8f\xa2\n...") instead of UTF-8 re-encoding them.
    const prefixBytes = new Uint8Array([...pdfPrefix].map((c) => c.charCodeAt(0) & 0xff));
    const buffer = new Uint8Array(prefixBytes.length + 2000);
    buffer.set(prefixBytes, 0);
    buffer.set(noiseBytes(11).slice(0, 2000), prefixBytes.length);
    buffer.set([0x27, 0x0a, 0x2d, 0x2d], 100);
    const payload = utf8DecodeSurrogateescape(buffer);
    const result = await detect(manager, payload);
    expect(result.isThreat).toBe(false);
    expect(result.threats).toEqual([]);
  });

  it('ASCII SQLi comment terminator outside binary is still detected', async () => {
    // detect() does not expose per-threat category (see the conformance
    // harness notes), so assert the sqli signal via the comment-terminator
    // pattern itself.
    const manager = createManager();
    const result = await detect(manager, "users?name=1=1' \n-- drop table users");
    expect(result.isThreat).toBe(true);
    expect(result.threats.some((t) => t.pattern === _SQLI_COMMENT_TERMINATOR_RE)).toBe(true);
  });

  it('SQLi comment-terminator source is noise gated', () => {
    // The SQLi comment-terminator source is registered as noise-prone: a
    // match whose neighborhood is binary-dense must be dropped by
    // buildRegexThreat, while the same match in ASCII surroundings survives
    // (covered by the still-detected test above).
    const source = "'\\s*(?:[\\);]+\\s*)?--|'[\\);]*#(?:\\n|\\Z)";
    const entry = getCompiledPatterns().find((e) => e.source === source);
    expect(entry).toBeDefined();

    const denseNoise = decodedNoise(11, 'surrogateescape').slice(0, 200);
    const text = `abc \n' \n--${denseNoise}`;
    const compiled = compilePythonPattern(source, true);
    compiled.re.lastIndex = 5;
    const match = compiled.re.exec(text);
    expect(match).not.toBeNull();
    expect(match?.[0]).toBe("' \n--");

    const prefix = buildBinaryPrefix(text);
    expect(buildRegexThreat(compiled, match as RegExpExecArray, 'sqli', 'request_body', prefix)).toBeNull();
    expect(buildRegexThreat(compiled, match as RegExpExecArray, 'sqli', 'request_body', null)).not.toBeNull();
  });
});
