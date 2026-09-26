/* Log-redaction utilities, the TS port of the guard_core/_utils/request_logging.py
   redaction surface: hardcoded default sensitive sets merged (case-insensitively)
   with the user's logSensitiveHeaders / logSensitiveParams / logSensitiveBodyFields
   config, and value masking with the '[REDACTED]' marker.

   Ported semantics:
   - default sensitive headers: authorization, proxy-authorization, cookie, x-api-key
     (_DEFAULT_SENSITIVE_LOG_HEADERS).
   - default sensitive fields (params and body): access_token, refresh_token, api_key,
     apikey, token, password, secret, client_secret, signature
     (_DEFAULT_SENSITIVE_LOG_FIELDS).
   - names are matched case-insensitively; configured names are merged on top of the
     defaults, never replacing them.
   - redactUrlForDisplay masks query-string (and fragment) pair values whose names are
     sensitive, after one bounded percent-decoding round.
   - redactBlobForDisplay masks sensitive JSON keys at any depth, then falls back to
     pair scanning (name=value / name:value) for non-JSON text.
   - redactHeaderValueForDisplay applies blob redaction, mirroring the reference's use
     on check-error messages.
   - netloc passwords (user:pass@host) are masked.

   Deviation from the reference (documented): the reference's pair scanner is a
   character-level engine with repeated percent-decode rounds and XML-element
   redaction; the TS port uses a regex pair scanner with a single percent-decode
   round and no XML element handling. Defaults, marker, case-insensitivity, JSON
   depth walk, and the URL/query/blob entry points match. */

export const DEFAULT_SENSITIVE_LOG_HEADERS: ReadonlySet<string> = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'x-api-key',
]);

export const DEFAULT_SENSITIVE_LOG_FIELDS: ReadonlySet<string> = new Set([
  'access_token', 'refresh_token', 'api_key', 'apikey', 'token',
  'password', 'secret', 'client_secret', 'signature',
]);

const REDACTED = '[REDACTED]';

const MAX_DECODE_ROUNDS = 3;

/* decodeURIComponent's scan is the CodeQL-flagged polynomial hotspot on
   '%' repetitions; sensitive names are short by construction (they are
   matched against config-supplied and hardcoded name sets), so names past
   this bound skip decoding entirely. */
const MAX_DECODED_NAME_LENGTH = 256;

export function mergeSensitiveNames(
  defaults: ReadonlySet<string>,
  extra: Iterable<string> | null | undefined,
): Set<string> {
  const merged = new Set(defaults);
  if (extra) {
    for (const name of extra) merged.add(name.toLowerCase());
  }
  return merged;
}

function boundedPercentDecode(text: string, decode: (s: string) => string): string {
  if (text.length > MAX_DECODED_NAME_LENGTH) return text;
  if (!text.includes('%') && !text.includes('+')) return text;
  let decoded = text;
  for (let i = 0; i < MAX_DECODE_ROUNDS; i++) {
    const next = decode(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

/* JSON walking, the twin of _redact_sensitive_json: mask the values of sensitive
   keys at any depth. Returns null when the text is not a JSON object/array or
   nothing was redacted. */
function redactJsonText(
  text: string,
  sensitive: ReadonlySet<string>,
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  let changed = false;

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (sensitive.has(key.toLowerCase())) {
          record[key] = REDACTED;
          changed = true;
        } else {
          walk(record[key]);
        }
      }
    }
  };

  walk(parsed);
  if (!changed) return null;
  return JSON.stringify(parsed);
}

/* Pair scanning for non-JSON text: mask the value of `name=value` and
   `name: value` assignments whose name is sensitive (quotes tolerated, one
   bounded percent-decode round on the name, the twin of _redact_pairs_in_text).
   The pattern is written backtrack-free (single-char-class name, mirrored
   quote reference, no nested quantifiers) so it stays linear on adversarial
   inputs like long '%' or quote runs. */
const PAIR_HEAD_RE = /(["']?)([A-Za-z0-9_.\-+%]+)\1[=:]\s*/g;

export function redactPairsInText(
  text: string,
  sensitive: ReadonlySet<string>,
): string {
  const out: string[] = [];
  let last = 0;
  PAIR_HEAD_RE.lastIndex = 0;
  for (let m = PAIR_HEAD_RE.exec(text); m !== null; m = PAIR_HEAD_RE.exec(text)) {
    const rawName = m[2] ?? '';
    const decodedName = boundedPercentDecode(rawName, decodeURIComponent).trim().toLowerCase();
    if (!sensitive.has(decodedName)) continue;
    // Keep everything up to and including the separator, mask the value run.
    const valueStart = m.index + m[0].length;
    let end = valueStart;
    const quote = text[valueStart];
    if (quote === '"' || quote === "'") {
      const closing = text.indexOf(quote, valueStart + 1);
      end = closing === -1 ? text.length : closing + 1;
    } else {
      while (end < text.length && !/[\s,;&|)'"]/.test(text[end])) end++;
    }
    out.push(text.slice(last, valueStart), REDACTED);
    last = end;
    PAIR_HEAD_RE.lastIndex = end;
  }
  out.push(text.slice(last));
  return out.join('');
}

/* The twin of redact_blob_for_display: try JSON first, then pair scanning. */
export function redactBlobForDisplay(
  text: string,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): string {
  if (!text) return text;
  const sensitive = mergeSensitiveNames(
    DEFAULT_SENSITIVE_LOG_FIELDS,
    [
      ...(sensitiveParams ?? []),
      ...(sensitiveBodyFields ?? []),
      ...(sensitiveHeaders ?? []),
    ].map((n) => n.toLowerCase()),
  );
  const jsonRedacted = redactJsonText(text, sensitive);
  if (jsonRedacted !== null) return jsonRedacted;
  return redactPairsInText(text, sensitive);
}

function redactPairsSegment(
  segment: string,
  sensitive: ReadonlySet<string>,
): string {
  const decoded = boundedPercentDecode(segment, decodeURIComponent);
  const jsonRedacted = redactJsonText(decoded, sensitive);
  if (jsonRedacted !== null) return encodeURIComponent(jsonRedacted);
  return redactPairsInText(segment, sensitive);
}

/* The twin of redact_url_for_display: mask sensitive pair values in the query
   string and fragment; mask userinfo passwords in the netloc. */
export function redactUrlForDisplay(
  url: string,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): string {
  const sensitive = mergeSensitiveNames(
    DEFAULT_SENSITIVE_LOG_FIELDS,
    [
      ...(sensitiveParams ?? []),
      ...(sensitiveBodyFields ?? []),
      ...(sensitiveHeaders ?? []),
    ].map((n) => n.toLowerCase()),
  );

  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)/.exec(url);
  let rest = url;
  let scheme = '';
  if (schemeMatch) {
    scheme = schemeMatch[1];
    rest = url.slice(scheme.length);
  }

  let authority = '';
  const slashIndex = rest.indexOf('/');
  const questionIndex = rest.indexOf('?');
  const hashIndex = rest.indexOf('#');
  let authorityEnd = rest.length;
  for (const idx of [slashIndex, questionIndex, hashIndex]) {
    if (idx !== -1 && idx < authorityEnd) authorityEnd = idx;
  }
  authority = rest.slice(0, authorityEnd);
  rest = rest.slice(authorityEnd);

  // netloc password masking, the twin of _redact_netloc_password.
  const atSign = authority.lastIndexOf('@');
  if (atSign !== -1) {
    const userInfo = authority.slice(0, atSign);
    const colon = userInfo.indexOf(':');
    if (colon !== -1) {
      authority = `${userInfo.slice(0, colon)}:${REDACTED}@${authority.slice(atSign + 1)}`;
    }
  }

  let path = rest;
  let query: string | null = null;
  let fragment: string | null = null;
  const qIdx = rest.indexOf('?');
  const hIdx = rest.indexOf('#');
  if (qIdx !== -1 && (hIdx === -1 || qIdx < hIdx)) {
    path = rest.slice(0, qIdx);
    const afterQuery = rest.slice(qIdx + 1);
    const fragIdx = afterQuery.indexOf('#');
    if (fragIdx !== -1) {
      query = afterQuery.slice(0, fragIdx);
      fragment = afterQuery.slice(fragIdx + 1);
    } else {
      query = afterQuery;
    }
  } else if (hIdx !== -1) {
    path = rest.slice(0, hIdx);
    fragment = rest.slice(hIdx + 1);
  }

  let result = scheme + authority + path;
  if (query !== null) result += '?' + redactPairsSegment(query, sensitive);
  if (fragment !== null) result += '#' + redactPairsSegment(fragment, sensitive);
  return result;
}

/* The twin of redact_header_value_for_display. */
export function redactHeaderValueForDisplay(
  value: string,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): string {
  if (!value) return value;
  return redactBlobForDisplay(value, sensitiveParams, sensitiveBodyFields, sensitiveHeaders);
}
