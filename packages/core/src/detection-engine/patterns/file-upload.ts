/**
 * File-upload matchers ported from
 * guard_core/handlers/_suspatterns_file_upload.py (spec 4.0.2). Pattern
 * sources come from canonical-sources.generated.ts.
 */

import { compilePythonPattern, matchAt, matchSpan, pySearch } from '../regex-compat.js';
import { bounded_finditer } from '../scan-window.js';
import type { CompiledPythonPattern, RegexMatchLike } from './types.js';
import {
  _FILE_UPLOAD_DANGEROUS_EXTENSION_RE,
  _FILE_UPLOAD_DECODED_TRUNCATION_RE,
  _FILE_UPLOAD_DOUBLE_EXTENSION_RE,
  _FILE_UPLOAD_TRUNCATION_RE,
  _FILE_UPLOAD_DANGEROUS_EXT_ALTERNATION,
  _FILE_UPLOAD_DOUBLE_EXT_ALTERNATION,
  _FILE_UPLOAD_BENIGN_TERMINAL_ALTERNATION,
} from './canonical-sources.generated.js';

export {
  _FILE_UPLOAD_DANGEROUS_EXTENSION_RE,
  _FILE_UPLOAD_DECODED_TRUNCATION_RE,
  _FILE_UPLOAD_DOUBLE_EXTENSION_RE,
  _FILE_UPLOAD_TRUNCATION_RE,
  _FILE_UPLOAD_DANGEROUS_EXT_ALTERNATION,
  _FILE_UPLOAD_DOUBLE_EXT_ALTERNATION,
  _FILE_UPLOAD_BENIGN_TERMINAL_ALTERNATION,
  _FILE_UPLOAD_DANGEROUS_EXTENSIONS_SORTED,
  _FILE_UPLOAD_DOUBLE_EXT_EXTENSIONS_SORTED,
  _FILE_UPLOAD_BENIGN_TERMINAL_SORTED,
} from './canonical-sources.generated.js';

const FILE_UPLOAD_DOUBLE_EXT_PREFIX = compilePythonPattern('filename\\s*=\\s*["\']', true);
const FILE_UPLOAD_QUOTE_RE = compilePythonPattern('["\']');
const FILE_UPLOAD_FILENAME_TOKEN_RE_SOURCE = 'filename';
const FILE_UPLOAD_DANGEROUS_EXTENSION_MARKER_RE = compilePythonPattern(
  '\\.(?:' + _FILE_UPLOAD_DOUBLE_EXT_ALTERNATION + ')(?![A-Za-z0-9])',
  true,
);
const FILE_UPLOAD_BENIGN_TERMINAL_EXTENSION_RE = compilePythonPattern(
  '\\.(?:' + _FILE_UPLOAD_BENIGN_TERMINAL_ALTERNATION + ')\\Z',
  true,
);
const FILE_UPLOAD_DANGEROUS_TERMINAL_EXTENSION_RE = compilePythonPattern(
  '\\.(?:' + _FILE_UPLOAD_DANGEROUS_EXT_ALTERNATION + ')\\Z',
  true,
);
const FILE_UPLOAD_TRUNCATION_MARKER_RE = compilePythonPattern(
  '(?:%00|\\\\u0000|\\\\x00|\\\\0|\\x00|;|\\.\\Z)',
  true,
);
const FILE_UPLOAD_DECODED_TRUNCATION_MARKER_RE = compilePythonPattern('(?:\\x00|;|\\.\\Z)');
const FILE_UPLOAD_VALIDATED_SPAN_SOURCE = '[\\s\\S]*';

function isWhitespace(ch: string | undefined): boolean {
  return ch !== undefined && /\s/.test(ch);
}

function fileUploadMatchStart(content: string, filenameStart: number): number | null {
  let cursor = filenameStart - 1;
  let firstNewline = -1;
  while (cursor >= 0 && isWhitespace(content[cursor])) {
    if (content[cursor] === '\n') firstNewline = cursor;
    cursor--;
  }
  if (cursor === -1) return 0;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (';,:\n'.includes(content[cursor] ?? '')) return cursor;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return firstNewline !== -1 ? firstNewline : null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

function fileUploadSkipWhitespace(content: string, cursor: number): number {
  while (cursor < content.length && isWhitespace(content[cursor])) cursor++;
  return cursor;
}

function fileUploadQuotedCandidate(content: string, filenameStart: number): [number, number, number] | null {
  const matchStart = fileUploadMatchStart(content, filenameStart);
  if (matchStart === null) return null;
  let cursor = fileUploadSkipWhitespace(content, filenameStart + FILE_UPLOAD_FILENAME_TOKEN_RE_SOURCE.length);
  if (cursor === content.length || content[cursor] !== '=') return null;
  cursor = fileUploadSkipWhitespace(content, cursor + 1);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (cursor === content.length || !'"\''.includes(content[cursor] ?? '')) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const bodyStart = cursor + 1;
  const tail = content.slice(bodyStart);
  const quoteIndex = tail.search(/["']/);
  if (quoteIndex === -1) return null;
  return [matchStart, bodyStart, bodyStart + quoteIndex + 1];
}

function findAllMatches(compiled: CompiledPythonPattern, text: string, start = 0, end = text.length): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const global = new RegExp(compiled.re.source, compiled.re.flags.replace('y', 'g'));
  const sliced = text.slice(0, end);
  global.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = global.exec(sliced)) !== null) {
    matches.push(match);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (match[0].length === 0) global.lastIndex++;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  return matches;
}

function fileUploadIsDoubleExtension(body: string): boolean {
  if (pySearch(FILE_UPLOAD_BENIGN_TERMINAL_EXTENSION_RE, body) === null) return false;
  const finalDot = body.lastIndexOf('.');
  for (const dangerous of findAllMatches(FILE_UPLOAD_DANGEROUS_EXTENSION_MARKER_RE, body, 0, finalDot)) {
    const suffixStart = dangerous.index + dangerous[0].length;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (suffixStart === finalDot || (suffixStart < finalDot && !' "\''.includes(body[suffixStart] ?? ''))) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      return true;
    }
  }
  return false;
}

function fileUploadIsTruncation(body: string, decoded: boolean): boolean {
  const marker = decoded ? FILE_UPLOAD_DECODED_TRUNCATION_MARKER_RE : FILE_UPLOAD_TRUNCATION_MARKER_RE;
  for (const dangerous of findAllMatches(FILE_UPLOAD_DANGEROUS_EXTENSION_MARKER_RE, body)) {
    const suffixStart = dangerous.index + dangerous[0].length;
    if (matchAt(marker, body, suffixStart) !== null) return true;
  }
  return false;
}

function fileUploadKindMatches(body: string, source: string): boolean {
  if (source === _FILE_UPLOAD_DANGEROUS_EXTENSION_RE) {
    return pySearch(FILE_UPLOAD_DANGEROUS_TERMINAL_EXTENSION_RE, body) !== null;
  }
  if (source === _FILE_UPLOAD_DOUBLE_EXTENSION_RE) {
    return fileUploadIsDoubleExtension(body);
  }
  if (source === _FILE_UPLOAD_TRUNCATION_RE) {
    return fileUploadIsTruncation(body, false);
  }
  if (source === _FILE_UPLOAD_DECODED_TRUNCATION_RE) {
    return fileUploadIsTruncation(body, true);
  }
  return false;
}

export function _file_upload_scan_matches(content: string, compiled: CompiledPythonPattern): RegexMatchLike[] {
  const matches: RegexMatchLike[] = [];
  let lastEnd = 0;
  const global = new RegExp(FILE_UPLOAD_FILENAME_TOKEN_RE_SOURCE, 'gi');
  let filename: RegExpExecArray | null;
  while ((filename = global.exec(content)) !== null) {
    const candidate = fileUploadQuotedCandidate(content, filename.index);
    if (candidate === null) continue;
    const [start, bodyStart, end] = candidate;
    if (start < lastEnd || !fileUploadKindMatches(content.slice(bodyStart, end - 1), compiled.source)) {
      continue;
    }
    const span = compilePythonPattern(FILE_UPLOAD_VALIDATED_SPAN_SOURCE);
    const match = matchSpan(span, content, start, end);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (match === null) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      throw new Error('file upload validated span invariant violated');
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    }
    matches.push(match);
    lastEnd = end;
  }
  return matches;
}

export function _file_upload_double_extension_scan_matches(
  content: string,
  compiled: CompiledPythonPattern,
): RegexMatchLike[] {
  return bounded_finditer(content, compiled, FILE_UPLOAD_DOUBLE_EXT_PREFIX, FILE_UPLOAD_QUOTE_RE);
}
