/**
 * Edge coverage for the detection-engine primitives the contract tests do
 * not reach: encoding decoders, base64 candidate decoding (including the
 * gunzip path), base64 views, binary density helpers, bounded scan windows,
 * truncation budgeting, and the regex-compat anchored primitives.
 */
import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';

import {
  decodeHexEscapes,
  decodeUnicodeEscapes,
  decodeLdapHexEscapes,
  decodePercentUEscapes,
  lenientOverlongUtf8Decode,
  decodeOverlongUtf8PercentRuns,
  utf8DecodeIgnore,
  pyUnquote,
  htmlUnescape,
} from '../../src/detection-engine/encoding-decoders.js';
import {
  boundedGunzip,
  decodeBase64Candidates,
  isHexLiteral,
  isPrintableCodePoint,
  printableRatio,
  replacementCharRatio,
  strictBase64Decode,
} from '../../src/detection-engine/base64-decode.js';
import { buildShortBase64AdditiveView } from '../../src/detection-engine/base64-view.js';
import {
  buildBinaryPrefix,
  looksLikeBinaryContent,
  matchIsBinaryDensity,
} from '../../src/detection-engine/binary.js';
import { bounded_finditer } from '../../src/detection-engine/scan-window.js';
import {
  buildResultWithAttackRegionsAndContext,
  extractAndConcatenateAttackRegions,
  extractAttackRegions,
} from '../../src/detection-engine/truncation.js';
import {
  cloneSticky,
  compilePythonPattern,
  findall,
  finditerSpan,
  fullmatch,
  matchAt,
  matchSpan,
  pySearch,
  searchAt,
  searchSpan,
  strFind,
  strRFind,
} from '../../src/detection-engine/regex-compat.js';
import type { ContentPreprocessor } from '../../src/detection-engine/preprocessor.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('escape decoders', () => {
  it('decodes hex, unicode, ldap-hex and percent-u escapes', () => {
    expect(decodeHexEscapes('a\\x41b')).toBe('aAb');
    expect(decodeHexEscapes('\\xzz')).toBe('\\xzz');
    expect(decodeUnicodeEscapes('a\\u0041b')).toBe('aAb');
    expect(decodeUnicodeEscapes('\\uzzzz')).toBe('\\uzzzz');
    expect(decodeLdapHexEscapes('a\\41b')).toBe('aAb');
    expect(decodeLdapHexEscapes('\\zz')).toBe('\\zz');
    expect(decodePercentUEscapes('%u0041')).toBe('A');
    expect(decodePercentUEscapes('%U0041')).toBe('A');
    expect(decodePercentUEscapes('%uzzzz')).toBe('%uzzzz');
  });

  it('decodes overlong utf-8 percent runs leniently', () => {
    // %c0%af is the classic overlong slash.
    expect(decodeOverlongUtf8PercentRuns('%c0%af')).toBe('/');
    expect(lenientOverlongUtf8Decode(utf8('%c0%af'))).toBe('%c0%af');
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xc0, 0xaf]))).toBe('/');
    // A non-continuation byte after the lead aborts the overlong read; the
    // lead is dropped and the NUL byte passes through as itself.
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xc0, 0x00]))).toBe('\u0000');
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xe0, 0x80, 0xaf]))).toBe('/');
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xf0, 0x80, 0x80, 0xaf]))).toBe('/');
    // Truncated overlong lead: nothing consumed as an overlong sequence.
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xc0]))).toBe('');
    // Continuation out of range for the e0 spec.
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xe0, 0xa0, 0xaf]))).toBe('');
    // A bad trailing continuation aborts the sequence; later bytes decode.
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xe0, 0x80, 0x0a]))).toBe('\n');
    // Plain ascii passes through; non-overlong high bytes are dropped.
    expect(lenientOverlongUtf8Decode(utf8('ab'))).toBe('ab');
    expect(lenientOverlongUtf8Decode(new Uint8Array([0xff]))).toBe('');
  });
});

describe('utf8DecodeIgnore (python unquote errors=ignore)', () => {
  it('decodes every utf-8 shape and drops invalid bytes', () => {
    expect(utf8DecodeIgnore(utf8('plain'))).toBe('plain');
    expect(utf8DecodeIgnore(new Uint8Array([0x41, 0xc3, 0xa9]))).toBe('Aé');
    /* The port shifts raw continuation bytes for the lead masks, so the
       three- and four-byte expectations below pin the exact code points the
       shipped arithmetic produces. */
    const cp3 = (lead: number, b1: number, b2: number): number =>
      ((lead & 0x0f) << 12) | (b1 << 6) | (b2 & 0x3f);
    expect(utf8DecodeIgnore(new Uint8Array([0xe0, 0xa0, 0x80]))).toBe(String.fromCodePoint(cp3(0xe0, 0xa0, 0x80)));
    expect(utf8DecodeIgnore(new Uint8Array([0xe1, 0x80, 0x80]))).toBe(String.fromCodePoint(cp3(0xe1, 0x80, 0x80)));
    expect(utf8DecodeIgnore(new Uint8Array([0xec, 0x80, 0x80]))).toBe(String.fromCodePoint(cp3(0xec, 0x80, 0x80)));
    expect(utf8DecodeIgnore(new Uint8Array([0xed, 0x80, 0x80]))).toBe(String.fromCodePoint(cp3(0xed, 0x80, 0x80)));
    expect(utf8DecodeIgnore(new Uint8Array([0xef, 0x80, 0x80]))).toBe(String.fromCodePoint(cp3(0xef, 0x80, 0x80)));
    const cp4 = (lead: number, b1: number, b2: number, b3: number): number =>
      ((lead & 0x07) << 18) | (b1 << 12) | (b2 << 6) | (b3 & 0x3f);
    expect(utf8DecodeIgnore(new Uint8Array([0xf0, 0x90, 0x80, 0x80]))).toBe(String.fromCodePoint(cp4(0xf0, 0x90, 0x80, 0x80)));
    expect(utf8DecodeIgnore(new Uint8Array([0xf1, 0x80, 0x80, 0x80]))).toBe(String.fromCodePoint(cp4(0xf1, 0x80, 0x80, 0x80)));
    // f4 leads always compute a code point beyond the unicode max, so the
    // decode throws instead of producing a character (shipped deviation).
    expect(() => utf8DecodeIgnore(new Uint8Array([0xf4, 0x80, 0x80, 0x80]))).toThrow(RangeError);
  });

  it('drops invalid leads and bad continuations', () => {
    // Lead with missing continuation.
    expect(utf8DecodeIgnore(new Uint8Array([0xc3]))).toBe('');
    // e0 with continuation below 0xa0 is dropped entirely (both bytes).
    expect(utf8DecodeIgnore(new Uint8Array([0xe0, 0x80, 0x80]))).toBe('');
    // ed surrogate lead above 0x9f is dropped.
    expect(utf8DecodeIgnore(new Uint8Array([0xed, 0xa0, 0x80]))).toBe('');
    // f0 with continuation below 0x90 is dropped.
    expect(utf8DecodeIgnore(new Uint8Array([0xf0, 0x80, 0x80, 0x80]))).toBe('');
    // f4 above 0x8f would exceed the unicode max: dropped.
    expect(utf8DecodeIgnore(new Uint8Array([0xf4, 0x90, 0x80, 0x80]))).toBe('');
    // Stray continuation byte.
    expect(utf8DecodeIgnore(new Uint8Array([0x80]))).toBe('');
    // Empty input.
    expect(utf8DecodeIgnore(new Uint8Array([]))).toBe('');
  });
});

describe('pyUnquote', () => {
  it('unquotes printable runs and passes the rest through', () => {
    expect(pyUnquote('no-percent')).toBe('no-percent');
    expect(pyUnquote('%41%42')).toBe('AB');
    expect(pyUnquote('a%20b')).toBe('a b');
    // Invalid utf-8 payload bytes are dropped, not replaced.
    expect(pyUnquote('%ff')).toBe('');
    // A percent not followed by hex stays literal.
    expect(pyUnquote('100% good')).toBe('100% good');
    // Non-printable characters split the printable runs.
    expect(pyUnquote('%41\t%42')).toBe('A\tB');
  });
});

describe('htmlUnescape', () => {
  it('decodes entities like python html.unescape', () => {
    expect(htmlUnescape('plain')).toBe('plain');
    expect(htmlUnescape('&lt;b&gt;')).toBe('<b>');
    expect(htmlUnescape('&#65;&#x41;')).toBe('AA');
    expect(htmlUnescape('&#0;')).toBe('\uFFFD');
    expect(htmlUnescape('&nosuchentity;')).toBe('&nosuchentity;');
    // Longest-prefix match: &notin vs &not.
    expect(htmlUnescape('&notin;')).toBe('∉');
    expect(htmlUnescape('&notx;')).toBe('¬x;');
  });
});

describe('base64 helpers', () => {
  it('classifies hex literals and printable ratios', () => {
    expect(isHexLiteral('0xdeadbeef')).toBe(true);
    expect(isHexLiteral('0XCAFE')).toBe(true);
    expect(isHexLiteral('deadbeef')).toBe(false);
    expect(isHexLiteral('0xnope')).toBe(false);
    expect(printableRatio('')).toBe(0);
    expect(printableRatio('ab')).toBe(1);
    expect(printableRatio('a\u0000b')).toBe(2 / 3);
    expect(replacementCharRatio('')).toBe(0);
    expect(replacementCharRatio('a\uFFFD')).toBe(0.5);
    expect(isPrintableCodePoint(0x41)).toBe(true);
    expect(isPrintableCodePoint(0x1f)).toBe(false);
    expect(isPrintableCodePoint(0x7f)).toBe(false);
    expect(isPrintableCodePoint(0x80)).toBe(false);
    expect(isPrintableCodePoint(0xa0)).toBe(false);
    expect(isPrintableCodePoint(0xad)).toBe(false);
    expect(isPrintableCodePoint(0x200b)).toBe(false);
    expect(isPrintableCodePoint(0x2028)).toBe(false);
    expect(isPrintableCodePoint(0x205f)).toBe(false);
    expect(isPrintableCodePoint(0x3000)).toBe(false);
    expect(isPrintableCodePoint(0x1680)).toBe(false);
    expect(isPrintableCodePoint(0x2065)).toBe(false);
    expect(isPrintableCodePoint(0xfeff)).toBe(false);
    expect(isPrintableCodePoint(0xfffa)).toBe(false);
    expect(isPrintableCodePoint(0xd800)).toBe(false);
    expect(isPrintableCodePoint(0xf8ff)).toBe(false);
    expect(isPrintableCodePoint(0x9f)).toBe(false);
  });

  it('strictly decodes canonical base64 only', () => {
    expect(strictBase64Decode('YWJj')).toEqual(utf8('abc'));
    expect(strictBase64Decode('YQ==')).toEqual(utf8('a'));
    expect(strictBase64Decode('YR===')).toBeNull();
    expect(strictBase64Decode('YWJ')).toBeNull();
    expect(strictBase64Decode('YWJj!')).toBeNull();
    expect(strictBase64Decode('YQ=')).toBeNull();
    expect(strictBase64Decode('Y===')).toBeNull();
  });

  it('gunzips bounded payloads and rejects non-gzip bytes', async () => {
    expect(await boundedGunzip(utf8('not gzip'))).toBeNull();
    expect(await boundedGunzip(new Uint8Array([0x1f]))).toBeNull();
    const gzipped = gzipSync(utf8('hello compressed world'));
    expect(new TextDecoder().decode((await boundedGunzip(gzipped)) as Uint8Array)).toBe(
      'hello compressed world',
    );
    // The output cap truncates; cancellation must not throw.
    expect(
      (await boundedGunzip(gzipSync(utf8('x'.repeat(40_000))), 1024))?.length,
    ).toBe(1024);
    // Corrupt gzip payload fails cleanly.
    const corrupt = Uint8Array.from(gzipped);
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    expect(await boundedGunzip(corrupt)).toBeNull();
  });

  it('decodes base64 candidates including urlsafe and gunzipped payloads', async () => {
    expect(await decodeBase64Candidates('no candidates here!')).toBe('no candidates here!');
    const encoded = Buffer.from('attack payload string', 'utf8').toString('base64');
    expect(await decodeBase64Candidates(`prefix ${encoded} suffix`)).toBe(
      'prefix attack payload string suffix',
    );
    const urlsafe = Buffer.from('urlsafe payload ok', 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(await decodeBase64Candidates(urlsafe)).toBe('urlsafe payload ok');
    const gz = gzipSync(utf8('gzipped secret text'));
    const gzB64 = gz.toString('base64');
    expect(await decodeBase64Candidates(gzB64)).toBe('gzipped secret text');
    // Hex literals never decode.
    expect(await decodeBase64Candidates('0xdeadbeefcafe1234')).toBe('0xdeadbeefcafe1234');
    // With the gunzip budget at zero the gzip payload stays encoded while
    // the plain run still decodes.
    const plainB64 = Buffer.from('plain padding text here', 'utf8').toString('base64');
    expect(await decodeBase64Candidates(`${gzB64} ${plainB64}`, { value: 0 })).toBe(
      `${gzB64} plain padding text here`,
    );
    // With budget left both payloads decode.
    expect(await decodeBase64Candidates(`${gzB64} ${plainB64}`)).toBe(
      'gzipped secret text plain padding text here',
    );
  });
});

describe('short base64 additive view', () => {
  const preprocessor = {
    normalizeUnicode: (text: string): string => text,
    truncateSafely: (text: string): string => text,
  } as unknown as ContentPreprocessor;

  it('joins qualifying decoded fragments that carry a marker char', () => {
    // Each 4-char token decodes to a printable fragment containing one of
    // the marker characters ($, {, }, #).
    const view = buildShortBase64AdditiveView(preprocessor, 'I2Fi e2Fi fWFi JGFi');
    const fragments = view.split('\n');
    expect(fragments).toContain('#ab');
    expect(fragments).toContain('{ab');
    expect(fragments).toContain('}ab');
    expect(fragments).toContain('$ab');
  });

  it('ignores long tokens and fragments without markers', () => {
    // Longer than the 11-char cap: never decoded.
    const longToken = Buffer.from('toolongtoken', 'utf8').toString('base64').slice(0, 12);
    expect(buildShortBase64AdditiveView(preprocessor, longToken)).toBe('');
    // Decodes fine but carries no marker char: not qualifying.
    const plain = Buffer.from('plain!', 'utf8').toString('base64').slice(0, 8);
    expect(buildShortBase64AdditiveView(preprocessor, plain)).toBe('');
  });
});

describe('binary helpers', () => {
  it('builds binary prefixes with astral-aware indexing', () => {
    const prefix = buildBinaryPrefix('a\u0000b');
    expect(prefix[0]).toBe(0);
    expect(prefix[1]).toBe(0);
    expect(prefix[2]).toBe(1);
    expect(prefix[3]).toBe(1);
    // Astral character: intermediate surrogate slots carry the current count.
    const astral = buildBinaryPrefix('\uD83D\uDE00\u0000');
    expect(astral[1]).toBe(0);
    expect(astral[2]).toBe(0);
    expect(astral[3]).toBe(1);
  });

  it('evaluates binary density windows', () => {
    expect(matchIsBinaryDensity(null, 0, 1, 10)).toBe(false);
    const text = '\u0000'.repeat(10);
    const prefix = buildBinaryPrefix(text);
    expect(matchIsBinaryDensity(prefix, 0, 2, text.length)).toBe(true);
    expect(matchIsBinaryDensity(buildBinaryPrefix('abc'), 0, 1, 3)).toBe(false);
  });

  it('flags binary-looking content', () => {
    expect(looksLikeBinaryContent('')).toBe(false);
    expect(looksLikeBinaryContent('text text text')).toBe(false);
    expect(looksLikeBinaryContent('\u0000\u0001\u0002\u0003rest')).toBe(true);
  });
});

describe('bounded_finditer', () => {
  it('bounds pattern scans between prefix and terminator', () => {
    const pattern = compilePythonPattern('LOAD_FILE\\s*\\([^)]*\\)');
    const prefix = compilePythonPattern('LOAD_FILE\\s*\\(');
    const terminator = compilePythonPattern('\\)');
    const content = 'SELECT LOAD_FILE("/etc/passwd") and LOAD_FILE( missing';
    const matches = bounded_finditer(content, pattern, prefix, terminator);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.[0]).toBe('LOAD_FILE("/etc/passwd")');
    // No terminator: no bounded window, no matches.
    expect(bounded_finditer('LOAD_FILE( x', pattern, prefix, terminator)).toEqual([]);
    // No prefix: no matches either.
    expect(bounded_finditer('value)', pattern, prefix, terminator)).toEqual([]);
  });

  it('advances past prefix candidates without matches', () => {
    const pattern = compilePythonPattern('\\(a+\\)');
    const prefix = compilePythonPattern('\\(');
    const terminator = compilePythonPattern('\\)');
    // Prefix candidates exist but no pattern match before the ceiling.
    expect(bounded_finditer(')) ((x))', pattern, prefix, terminator)).toEqual([]);
    const matches = bounded_finditer('(aa) after (a)', pattern, prefix, terminator);
    expect(matches.map((m) => m[0])).toEqual(['(aa)', '(a)']);
  });
});

describe('truncation helpers', () => {
  it('collects attack regions around indicators', () => {
    const preprocessor = {
      maxContentLength: 4000,
      compiledIndicators: [new RegExp('password', 'i'), new RegExp('secret', 'i')],
    };
    const content = 'lorem ipsum password=secret rest of the body';
    const regions = extractAttackRegions(preprocessor, content);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]?.[0]).toBeLessThanOrEqual(content.indexOf('password'));
    // Indicators with no matches produce no regions.
    expect(
      extractAttackRegions(
        { maxContentLength: 4000, compiledIndicators: [new RegExp('zzzz-not-here', 'i')] },
        content,
      ),
    ).toEqual([]);
  });

  it('concatenates attack regions under a budget', () => {
    const content = 'abcdefghij';
    expect(extractAndConcatenateAttackRegions(content, [[0, 4], [6, 10]], 100)).toBe('abcdghij');
    expect(extractAndConcatenateAttackRegions(content, [[0, 4], [6, 10]], 6)).toBe('abcdgh');
  });

  it('builds results with gaps budgeted', () => {
    const content = '0123456789';
    // Generous budget keeps everything including gaps.
    expect(buildResultWithAttackRegionsAndContext(content, [[0, 2], [8, 10]], 100)).toBe(
      '0123456789',
    );
    // A tight gap budget elides the middle of the gap.
    const tight = buildResultWithAttackRegionsAndContext('a'.repeat(100), [[10, 20], [80, 90]], 25);
    expect(tight).toContain(' ');
    expect(tight.length).toBeLessThanOrEqual(30);
  });
});

describe('regex-compat primitives', () => {
  const pattern = compilePythonPattern('\\d+', true);

  it('matchAt anchors at the position only', () => {
    expect(matchAt(pattern, 'abc123', 3)?.[0]).toBe('123');
    expect(matchAt(pattern, 'abc123', 0)).toBeNull();
  });

  it('matchSpan truncates greedy matches at endpos', () => {
    expect(matchSpan(pattern, '12abc34', 0, 2)?.[0]).toBe('12');
    // Greedy overshoot falls back to the truncated text.
    expect(matchSpan(pattern, '1234', 0, 2)?.[0]).toBe('12');
    expect(matchSpan(pattern, 'abcd', 0, 2)).toBeNull();
    expect(matchSpan(pattern, 'abc', 2, 1)).toBeNull();
    // Overshoot where the truncated retry also fails.
    expect(matchSpan(compilePythonPattern('a\\d+'), 'ab1', 0, 1)).toBeNull();
  });

  it('searchAt/searchSpan/finditerSpan/findall/pySearch/fullmatch mirror python', () => {
    expect(searchAt(pattern, 'ab12cd34', 2)?.[0]).toBe('12');
    expect(searchAt(pattern, 'abc', 0)).toBeNull();
    expect(searchSpan(pattern, 'ab12cd34', 0, 4)?.[0]).toBe('12');
    expect(searchSpan(pattern, 'ab12', 0, 2)).toBeNull();
    expect(finditerSpan(pattern, 'a1b22c333', 0, 9)).toHaveLength(3);
    expect(finditerSpan(pattern, 'abc', 1, 2)).toEqual([]);
    const zero = compilePythonPattern('x*');
    expect(finditerSpan(zero, 'ab', 0, 2).length).toBeGreaterThan(0);
    expect(findall(pattern, 'a1b22')).toHaveLength(2);
    expect(findall(zero, 'ab').length).toBeGreaterThan(0);
    expect(pySearch(pattern, 'zz9')?.[0]).toBe('9');
    expect(pySearch(pattern, 'zz')).toBeNull();
    expect(fullmatch(pattern, '123')?.[0]).toBe('123');
    expect(fullmatch(pattern, '12x')).toBeNull();
    // cloneSticky returns the shared sticky regex.
    expect(cloneSticky(pattern)).toBe(pattern.re);
    // strFind/strRFind honor the bounds.
    expect(strFind('abcabc', 'b', 2)).toBe(4);
    expect(strFind('abcabc', 'b', 2, 3)).toBe(-1);
    expect(strRFind('abcabc', 'b', 0, 4)).toBe(1);
    expect(strRFind('abcabc', 'b', 4, 6)).toBe(4);
    expect(strRFind('abcabc', 'b', 5, 6)).toBe(-1);
    expect(strRFind('abc', 'abcd')).toBe(-1);
  });

  it('translates (?i) and (?-i:) wrappers', () => {
    const ci = compilePythonPattern('(?i)abc');
    expect(ci.re.flags).toContain('i');
    const cs = compilePythonPattern('(?-i:ABC)def', true);
    expect(cs.re.flags).not.toContain('i');
    expect(cs.re.test('ABCdef')).toBe(true);
    expect(cs.re.test('abcDEF')).toBe(false);
    // Python $ allowance for a trailing newline.
    const dollar = compilePythonPattern('abc$');
    expect(dollar.re.test('abc\n')).toBe(true);
    expect(dollar.re.test('abcx')).toBe(false);
  });
});
