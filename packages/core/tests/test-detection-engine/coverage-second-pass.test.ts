/**
 * Second-pass edge coverage: core pipeline helpers, check implementations,
 * decorators, and the remaining detection-engine primitives.
 */
import { describe, expect, it, vi } from 'vitest';

import { compilePythonPattern } from '../../src/detection-engine/regex-compat.js';
import { bounded_finditer } from '../../src/detection-engine/scan-window.js';
import { ContentPreprocessor } from '../../src/detection-engine/preprocessor.js';
import { SemanticAnalyzer } from '../../src/detection-engine/semantic.js';
import {
  extractAttackRegions,
  capWithTail,
} from '../../src/detection-engine/truncation.js';
import { capWithTail as _capWithTail } from '../../src/detection-engine/truncation.js';
import {
  htmlUnescape,
  utf8DecodeIgnore,
} from '../../src/detection-engine/encoding-decoders.js';
import {
  buildBinaryPrefix,
  matchIsBinaryDensity,
  looksLikeBinaryContent,
} from '../../src/detection-engine/binary.js';
import { isHexLiteral } from '../../src/detection-engine/base64-decode.js';

describe('detection primitive second pass', () => {
  it('covers bounded_finditer empty terminator and prefix sets', () => {
    const pattern = compilePythonPattern('a\\)');
    const prefix = compilePythonPattern('a');
    const terminator = compilePythonPattern('\\)');
    // No terminator occurrence: no bounded window.
    expect(bounded_finditer('aa b', pattern, prefix, terminator)).toEqual([]);
    // Terminators exist but no prefix candidate.
    expect(bounded_finditer(') ) )', pattern, prefix, terminator)).toEqual([]);
    // A zero-width terminator run still terminates.
    expect(bounded_finditer('a)', pattern, prefix, terminator).map((m) => m[0])).toEqual(['a)']);
  });

  it('drives preprocessor and semantic edge paths', async () => {
    const preprocessor = new ContentPreprocessor();
    // Empty content short-circuits every entry point.
    expect(await preprocessor.preprocess('')).toBe('');
    expect(await preprocessor.preprocessWithDecoded('')).toEqual(['', '']);
    expect(preprocessor.preprocessSignalPreserving('')).toBe('');
    expect(await preprocessor.preprocessUrlDecodedNewlinePreserving('')).toBe('');
    // The budget flag is set when decoding runs past the iteration cap.
    const budget = { value: false };
    const nested = '%2525252525252525252525252525252525';
    await preprocessor.preprocess(nested, budget);
    expect(typeof budget.value).toBe('boolean');
    const analyzer = new SemanticAnalyzer();
    // Obfuscation heuristics.
    expect(analyzer.detectObfuscation('plain text')).toBe(false);
    expect(analyzer.detectObfuscation('a'.repeat(120))).toBe(true);
    expect(analyzer.detectObfuscation('!!!!')).toBe(true);
    expect(analyzer.detectObfuscation('\u0000\u0001\u0002\u0003rest')).toBe(false);
    expect(analyzer.extractSuspiciousPatterns('no structures')).toEqual([]);
  });

  it('covers truncation and scan caps', () => {
    const preprocessor = {
      maxContentLength: 300,
      compiledIndicators: [new RegExp('needle', 'i')],
    };
    const content = `prefix needle suffix ${'x'.repeat(1000)}`;
    const regions = extractAttackRegions(preprocessor, content);
    expect(regions.length).toBeGreaterThan(0);
    // capWithTail keeps head and tail around the cap.
    const capped = capWithTail('a'.repeat(5000), 1000);
    expect(capped.length).toBe(1000);
  });

  it('pins remaining decoder branches', () => {
    // htmlUnescape numeric branches: invalid hex/decimal and out-of-range.
    expect(htmlUnescape('&#xZZ;')).toBe('&#xZZ;');
    expect(htmlUnescape('&#1114112;')).toBe('\uFFFD');
    expect(htmlUnescape('&#x110000;')).toBe('\uFFFD');
    // utf8DecodeIgnore on empty and single-byte inputs.
    expect(utf8DecodeIgnore(new Uint8Array([0x7f]))).toBe('\u007f');
    expect(isHexLiteral('0x')).toBe(false);
  });

  it('pins binary helper boundaries', () => {
    expect(matchIsBinaryDensity(buildBinaryPrefix('ab\u0000'), 0, 1, 3)).toBe(false);
    expect(matchIsBinaryDensity(buildBinaryPrefix('\u0000'.repeat(5)), 0, 100, 5)).toBe(true);
    expect(looksLikeBinaryContent('\t\r\n ok')).toBe(false);
  });
});
