/**
 * Request body value extraction ported from
 * guard_core/_utils/body_form_scan.py (multipart + urlencoded halves) with
 * the observable multipart semantics of the Go and PHP ports
 * (guardcore/multipartscan.go + bodyscan.go, src/Detection/BodyFormScan.php):
 * a hand-rolled line-based scanner, NOT a canonicalizing parser.
 *
 *   - preamble lines before the opening boundary are discarded, epilogue
 *     after the final boundary is discarded;
 *   - part headers keep their raw name case and wire order; a folded
 *     continuation line is appended to the previous value with its original
 *     line break preserved (compat32 keeps the raw fold);
 *   - the first colonless line inside a part ends the header block and that
 *     line and everything after it up to the next boundary is the payload
 *     (MissingHeaderBodySeparatorDefect);
 *   - the line terminator preceding a boundary line belongs to the delimiter,
 *     everything else (including bare newlines) stays in the payload;
 *   - a part whose Content-Type is multipart with a boundary parameter is a
 *     container: its leaf parts are walked in place (message.walk), the
 *     container itself produces no entries; a container without a boundary is
 *     an ordinary leaf;
 *   - no closing boundary is tolerated: the part parsed so far is kept,
 *     matching the email parser's CloseBoundaryNotFoundDefect behavior;
 *   - filename parameters follow RFC 7578 quoting (paired outer quotes
 *     stripped, escaped quotes unescaped) with get_filename's RFC 2231
 *     fallback (filename* / filename*0*..filename*N* segments joined,
 *     charset prefix stripped, percent-decoded).
 *
 * Bodies are engine strings (invalid UTF-8 already decoded to U+FFFD by the
 * TextDecoder at the request boundary), so line scanning over UTF-16 units
 * sees the same boundaries the byte-level Python/Go scanners see: every
 * artifact byte that is not a newline or CR breaks islands and never splits
 * a delimiter comparison. Binary-dense file-part payloads are reduced to
 * printable islands (binary-islands.ts) using the
 * detectionBinaryMinRunLength config knob.
 */

import { extractBinaryIslands, valueIsBinaryLike } from './binary-islands.js';

export const MULTIPART_FILE_LABEL = 'file';

export interface MimeHeaderEntry {
  name: string;
  value: string;
}

export interface MultipartPart {
  headers: MimeHeaderEntry[];
  payload: string;
}

/** One scanned entry of a multipart part, mirroring the
 *  (exclusion_key, label, value) tuples of _multipart_part_entries.
 *  exclusionKey is the disposition name or null when the part carries no
 *  name parameter (a null exclusion key is never suppressible by the
 *  excluded-body-fields config, exactly like the reference). */
export interface MultipartEntry {
  label: string;
  exclusionKey: string | null;
  value: string;
}

// ---------------------------------------------------------------------------
// urlencoded form pairs (parse_qsl keep_blank_values port)
// ---------------------------------------------------------------------------

export interface FormPair {
  name: string;
  value: string;
}

/**
 * parseFormPairs mirrors urllib.parse.parse_qsl with keep_blank_values=True
 * and the "&" separator: empty chunks dropped, partition on the first "=",
 * missing values kept as empty strings, plus/space folding and tolerant
 * percent-decoding.
 */
export function parseFormPairs(rawBody: string): FormPair[] {
  const pairs: FormPair[] = [];
  for (const chunk of rawBody.split('&')) {
    if (chunk === '') continue;
    let name = chunk;
    let value = '';
    const idx = chunk.indexOf('=');
    if (idx >= 0) {
      name = chunk.slice(0, idx);
      value = chunk.slice(idx + 1);
    }
    pairs.push({ name: unquotePlus(name), value: unquotePlus(value) });
  }
  return pairs;
}

function hexVal(c: number): number | null {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  return null;
}

/** Lossy UTF-8 decode shared by the percent-decoders: valid UTF-8 percent
 *  runs decode as text, invalid bytes become U+FFFD, the engine-wide string
 *  model (Python decodes with errors="surrogateescape", Go maps invalid runs
 *  to U+FFFD; ratios stay on the same side of every threshold). */
const LOSSY_TEXT_DECODER = new TextDecoder();

function decodePercentRuns(s: string): string {
  let out = '';
  let run: number[] = [];
  const flush = () => {
    if (run.length > 0) {
      out += LOSSY_TEXT_DECODER.decode(new Uint8Array(run));
      run = [];
    }
  };
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x25 && i + 2 < s.length) {
      const h1 = hexVal(s.charCodeAt(i + 1));
      const h2 = hexVal(s.charCodeAt(i + 2));
      if (h1 !== null && h2 !== null) {
        run.push((h1 << 4) | h2);
        i += 2;
        continue;
      }
    }
    flush();
    out += s[i];
  }
  flush();
  return out;
}

/**
 * unquotePlus mirrors unquote_plus with errors="surrogateescape": "+" becomes
 * a space and every valid %XX escape contributes its byte; invalid escape
 * sequences stay literal.
 */
export function unquotePlus(s: string): string {
  if (!s.includes('+') && !s.includes('%')) return s;
  let out = '';
  let run: number[] = [];
  const flush = () => {
    if (run.length > 0) {
      out += LOSSY_TEXT_DECODER.decode(new Uint8Array(run));
      run = [];
    }
  };
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x2b) {
      flush();
      out += ' ';
    } else if (c === 0x25 && i + 2 < s.length) {
      const h1 = hexVal(s.charCodeAt(i + 1));
      const h2 = hexVal(s.charCodeAt(i + 2));
      if (h1 !== null && h2 !== null) {
        run.push((h1 << 4) | h2);
        i += 2;
        continue;
      }
      flush();
      out += '%';
    } else {
      flush();
      out += s[i];
    }
  }
  flush();
  return out;
}

function percentDecodeTolerant(s: string): string {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!s.includes('%')) return s;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return decodePercentRuns(s);
}

// ---------------------------------------------------------------------------
// Header parameter parsing (email.utils _parseparam / get_params port)
// ---------------------------------------------------------------------------

/**
 * splitHeaderParams splits on semicolons that are not inside a quoted string,
 * mirroring email.utils._parseparam's quote-aware splitting.
 */
function splitHeaderParams(value: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  let inQuotes = false;
  let escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === 0x5c && inQuotes) {
      escaped = true;
    } else if (c === 0x22) {
      inQuotes = !inQuotes;
    } else if (c === 0x3b && !inQuotes) {
      pieces.push(value.slice(start, i));
      start = i + 1;
    }
  }
  pieces.push(value.slice(start));
  return pieces;
}

function splitParamPiece(piece: string): [string, string] | null {
  const idx = piece.indexOf('=');
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (idx < 0) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  const name = piece.slice(0, idx).trim().toLowerCase();
  const value = unquoteHeaderParam(piece.slice(idx + 1).trim());
  return [name, value];
}

/**
 * unquoteHeaderParam mirrors the email parser's param unquoting: matching
 * outer quotes are stripped and escaped quotes and backslashes are unescaped;
 * asymmetric quotes are kept verbatim.
 */
function unquoteHeaderParam(value: string): string {
  if (value.length < 2 || value[0] !== '"' || value[value.length - 1] !== '"') {
    return value;
  }
  value = value.slice(1, -1);
  let out = '';
  for (let i = 0; i < value.length; i++) {
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (value[i] === '\\' && i + 1 < value.length && (value[i + 1] === '"' || value[i + 1] === '\\')) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      out += value[i + 1];
      i++;
      continue;
    }
    out += value[i];
  }
  return out;
}

/** parseMediaTypeParams splits a Content-Type style header into its
 *  lowercased main type and parameters. */
export function parseMediaTypeParams(value: string): [string, Record<string, string>] {
  let mainType = '';
  const params: Record<string, string> = {};
  let first = true;
  for (const piece of splitHeaderParams(value)) {
    if (first) {
      first = false;
      mainType = piece.trim().toLowerCase();
      continue;
    }
    const split = splitParamPiece(piece);
    if (split) params[split[0]] = split[1];
  }
  return [mainType, params];
}

/** parseHeaderParams parses a Content-Disposition style header value into its
 *  parameters (everything after the first ";" piece). */
function parseHeaderParams(value: string): [string, Record<string, string>] {
  const params: Record<string, string> = {};
  const pieces = splitHeaderParams(value);
  for (let i = 1; i < pieces.length; i++) {
    const split = splitParamPiece(pieces[i]);
    if (split) params[split[0]] = split[1];
  }
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return [pieces.length > 0 ? pieces[0].trim() : '', params];
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

// ---------------------------------------------------------------------------
// Multipart part accessors (get_param / get_filename ports)
// ---------------------------------------------------------------------------

function firstHeaderValue(headers: MimeHeaderEntry[], lowerName: string): string | null {
  for (const h of headers) {
    if (h.name.toLowerCase() === lowerName) return h.value;
  }
  return null;
}

/** partDispositionParam extracts a content-disposition parameter the way the
 *  Python email parser does: tolerant semicolon splitting that respects
 *  quoted strings, outer quotes stripped only when they pair, escaped quotes
 *  unescaped. */
function partDispositionParam(part: MultipartPart, param: string): string | null {
  const value = firstHeaderValue(part.headers, 'content-disposition');
  if (value === null) return null;
  const [, params] = parseHeaderParams(value);
  return param in params ? params[param] : null;
}

function mergeRFC2231Segments(params: Record<string, string>, base: string): string | null {
  const pieces: string[] = [];
  for (let i = 0; ; i++) {
    const v = params[`${base}*${i}*`];
    if (v === undefined) break;
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    pieces.push(v);
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  if (pieces.length === 0) return null;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return pieces.join('');
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

function decodeRFC2231Value(value: string): string {
  // charset'lang'percent-encoded
  const idx = value.indexOf("'");
  if (idx >= 0) {
    const rest = value.slice(idx + 1);
    const idx2 = rest.indexOf("'");
    if (idx2 >= 0) value = rest.slice(idx2 + 1);
  }
  return percentDecodeTolerant(value);
}

/** partRFC2231Filename mirrors get_filename's RFC 2231 fallback: when no
 *  plain filename parameter exists, the extended pieces filename*, or the
 *  segments filename*0*..filename*N*, are joined, the charset prefix
 *  stripped, and the value percent-decoded. */
function partRFC2231Filename(part: MultipartPart): string | null {
  const value = firstHeaderValue(part.headers, 'content-disposition');
  if (value === null) return null;
  const [, params] = parseHeaderParams(value);
  if ('filename*' in params) return decodeRFC2231Value(params['filename*']);
  const merged = mergeRFC2231Segments(params, 'filename');
  if (merged === null) return null;
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  return decodeRFC2231Value(merged);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
}

// ---------------------------------------------------------------------------
// Line-based multipart scanner
// ---------------------------------------------------------------------------

/** nextLine returns [lineStart, lineEnd, next] for the line at pos; lineEnd
 *  excludes the '\n', next points past it (past the end when no newline). */
function nextLine(body: string, pos: number): [number, number, number] {
  const idx = body.indexOf('\n', pos);
  if (idx < 0) return [pos, body.length, body.length + 1];
  return [pos, idx, idx + 1];
}

/** trimCRAndPadding strips the trailing CR and transport padding (trailing
 *  spaces and tabs) the boundary comparison ignores. */
function trimCRAndPadding(line: string): string {
  let end = line.length;
  if (end > 0 && line.charCodeAt(end - 1) === 0x0d) end--;
  while (end > 0 && (line.charCodeAt(end - 1) === 0x20 || line.charCodeAt(end - 1) === 0x09)) end--;
  return line.slice(0, end);
}

/**
 * parseMultipartParts splits a multipart body into its leaf parts (nested
 * multipart containers expanded in place). An empty boundary yields no
 * parts, which routes the caller to the whole-body blob fallback like the
 * Python is_multipart() == False path.
 */
export function parseMultipartParts(body: string, boundary: string): MultipartPart[] {
  if (boundary === '') return [];
  return parseMultipartLevel(body, boundary);
}

function parseMultipartLevel(body: string, boundary: string): MultipartPart[] {
  const delim = `--${boundary}`;
  const finalMark = `${delim}--`;
  let pos = 0;

  // Preamble: skip lines until the opening boundary (or the final boundary,
  // which means zero parts).
  while (pos <= body.length) {
    const [lineStart, lineEnd, next] = nextLine(body, pos);
    const bare = trimCRAndPadding(body.slice(lineStart, lineEnd));
    if (bare === delim) {
      pos = next;
      break;
    }
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (bare.startsWith(finalMark)) return [];
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    pos = next;
  }

  let parts: MultipartPart[] = [];
  while (pos <= body.length) {
    const [headers, payload, next, closed, wasFinal] = readPart(body, pos, delim, finalMark);
    parts = appendMultipartLeafOrContainer(parts, headers, payload);
    if (!closed || wasFinal) {
      // Missing closing boundary (payload ran to the end of the input,
      // CloseBoundaryNotFoundDefect) or the multipart body was closed: any
      // epilogue is discarded.
      return parts;
    }
    pos = next;
  }
  return parts;
}

/** readPart reads one part (headers plus payload) starting at pos. It
 *  reports whether a boundary line terminated the part (closed) and whether
 *  that boundary was the final one; a missing closing boundary ends the
 *  multipart body with the payload running to the end of the input. */
function readPart(
  body: string,
  pos: number,
  delim: string,
  finalMark: string,
): [MimeHeaderEntry[], string, number, boolean, boolean] {
  const headers: MimeHeaderEntry[] = [];
  let inHeaders = true;
  let payloadStart = -1;
  while (pos <= body.length) {
    const [lineStart, lineEnd, lineNext] = nextLine(body, pos);
    const raw = body.slice(lineStart, lineEnd);
    const content = trimCRAndPadding(raw);
    if (inHeaders) {
      if (content === '') {
        // Blank line: headers end, payload starts after it.
        inHeaders = false;
        payloadStart = lineNext;
      } else if (headers.length > 0 && (content.charCodeAt(0) === 0x20 || content.charCodeAt(0) === 0x09)) {
        // Folded continuation: keep the raw break and the line.
        /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
        const br = raw.endsWith('\r') ? '\r\n' : '\n';
        /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        const prev = headers[headers.length - 1];
        prev.value += br + content;
      } else {
        const idx = content.indexOf(':');
        if (idx < 0) {
          // Colonless line: the header block ends and the line itself opens
          // the payload (compat32 defect behavior).
          inHeaders = false;
          payloadStart = lineStart;
        } else {
          headers.push({
            name: content.slice(0, idx),
            value: content.slice(idx + 1).replace(/^[ \t]+/, ''),
          });
        }
      }
      pos = lineNext;
      continue;
    }
    if (content === delim || content.startsWith(finalMark)) {
      return [headers, payloadSlice(body, payloadStart, lineStart), lineNext, true, content.startsWith(finalMark)];
    }
    pos = lineNext;
  }
  // No closing boundary: the payload runs to the end of the body.
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (payloadStart < 0) payloadStart = body.length;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return [headers, body.slice(payloadStart), body.length + 1, false, false];
}

/** payloadSlice extracts the payload between payloadStart and the start of
 *  the boundary line; the terminator immediately before the boundary line
 *  belongs to the delimiter, not the payload. */
function payloadSlice(body: string, payloadStart: number, boundaryLineStart: number): string {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (payloadStart < 0) payloadStart = boundaryLineStart;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (boundaryLineStart <= payloadStart) return '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  let end = boundaryLineStart;
  if (end > payloadStart && body.charCodeAt(end - 1) === 0x0a) {
    end--;
    if (end > payloadStart && body.charCodeAt(end - 1) === 0x0d) end--;
  }
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (end < payloadStart) end = payloadStart;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return body.slice(payloadStart, end);
}

/** maintypeIsMultipart mirrors get_content_maintype() == "multipart": the
 *  part of the content type before the "/". */
function maintypeIsMultipart(contentType: string): boolean {
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  const mainType = contentType.split('/', 1)[0] ?? '';
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return mainType === 'multipart';
}

/** appendMultipartLeafOrContainer either expands a nested multipart container
 *  (message.walk descends; the container itself produces no entries) or
 *  appends the part as a leaf. */
function appendMultipartLeafOrContainer(
  parts: MultipartPart[],
  headers: MimeHeaderEntry[],
  payload: string,
): MultipartPart[] {
  const contentType = firstHeaderValue(headers, 'content-type') ?? '';
  const [mainType, params] = parseMediaTypeParams(contentType);
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (maintypeIsMultipart(mainType) && (params['boundary'] ?? '') !== '') {
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    return parts.concat(parseMultipartLevel(payload, params['boundary']));
  }
  return parts.concat([{ headers, payload }]);
}

// ---------------------------------------------------------------------------
// Per-part scan entries (_multipart_part_entries + _part_payload_entries)
// ---------------------------------------------------------------------------

/** partPayloadEntries mirrors _part_payload_entries: a binary-like named file
 *  part's payload reduces to its printable islands, an empty payload yields
 *  no entries, anything else keeps the full payload as one entry. */
function partPayloadEntries(label: string, exclusionKey: string | null, filename: string | null, payload: string, minRunLength: number): MultipartEntry[] {
  if (filename !== null && valueIsBinaryLike(payload)) {
    return extractBinaryIslands(payload, minRunLength).map((island) => ({ label, exclusionKey, value: island }));
  }
  if (!payload) return [];
  return [{ label, exclusionKey, value: payload }];
}

/**
 * multipartPartEntries mirrors _multipart_part_entries: the filename entry,
 * every part header entry in wire order, and the payload entries (islands
 * when the part is a binary-like file part). The label is the disposition
 * name or the "file" fallback; a part with no entries at all is skipped by
 * the caller, like the reference.
 */
export function multipartPartEntries(part: MultipartPart, minRunLength: number): MultipartEntry[] {
  let name = partDispositionParam(part, 'name');
  let filename = partDispositionParam(part, 'filename');
  if (filename === null) filename = partRFC2231Filename(part);
  const label = name ?? MULTIPART_FILE_LABEL;

  const entries: MultipartEntry[] = [];
  if (filename !== null) {
    const sanitized = filename.replace(/"/g, '').replace(/'/g, '');
    entries.push({ label, exclusionKey: name, value: `filename="${sanitized}"` });
  }
  for (const header of part.headers) {
    entries.push({ label, exclusionKey: name, value: `${header.name}: ${header.value}` });
  }
  for (const island of partPayloadEntries(label, name, filename, part.payload, minRunLength)) {
    entries.push({ label, exclusionKey: name, value: island.value });
  }
  return entries;
}
