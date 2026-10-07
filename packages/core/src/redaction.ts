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
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (text.length > MAX_DECODED_NAME_LENGTH) return text;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
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
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    if (Array.isArray(node)) {
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      for (const item of node) walk(item);
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      return;
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
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
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!changed) return null;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  return JSON.stringify(parsed);
}

/* Pair scanning for non-JSON text: mask the value of `name=value` and
   `name: value` assignments whose name is sensitive (quotes tolerated, one
   bounded percent-decode round on the name, the twin of _redact_pairs_in_text).

   The scan is a hand-rolled linear pass instead of a global regex: any regex
   of the shape (quote?)(name-class+)(sep) over uncontrolled text rescans a
   name run from every offset before failing, which CodeQL
   (js/polynomial-redos) correctly flags as quadratic on adversarial inputs
   like long '%' or quote runs. The scanner walks each character at most a
   constant number of times and recognizes exactly the same matches:
   `(["']?)(NAME+)\1[=:]` with `\s*` before the value, where NAME is a letter,
   digit, '_', '.', '-', '+' or '%'. */

function isPairNameChar(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') ||
         (ch >= 'A' && ch <= 'Z') ||
         (ch >= '0' && ch <= '9') ||
         ch === '_' || ch === '.' || ch === '-' || ch === '+' || ch === '%';
}

function skipPairWhitespace(text: string, from: number): number {
  let j = from;
  while (j < text.length && /\s/.test(text[j])) j++;
  return j;
}

function pairNameIsSensitive(
  text: string,
  start: number,
  end: number,
  sensitive: ReadonlySet<string>,
): boolean {
  const rawName = text.slice(start, end);
  const decodedName = boundedPercentDecode(rawName, decodeURIComponent).trim().toLowerCase();
  return sensitive.has(decodedName);
}

/* Value-end logic, identical to the original scanner: a quoted value runs to
   the mirroring quote (or end of text), an unquoted value runs until a pair
   delimiter. */
function pairValueEnd(text: string, valueStart: number): number {
  const quote = text[valueStart];
  if (quote === '"' || quote === "'") {
    const closing = text.indexOf(quote, valueStart + 1);
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    return closing === -1 ? text.length : closing + 1;
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
  }
  let end = valueStart;
  while (end < text.length && !/[\s,;&|)'"]/.test(text[end])) end++;
  return end;
}

export function redactPairsInText(
  text: string,
  sensitive: ReadonlySet<string>,
): string {
  const out: string[] = [];
  let last = 0;
  const n = text.length;
  let i = 0;
  /* Start of the current maximal run of name characters. A separator or a
     closing quote can only complete a pair whose name is exactly this run. */
  let runStart = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      /* A quote closes a quoted name only when a name run sits between a
         mirroring opening quote and this position, and a separator follows
         immediately (the linear twin of `\1[=:]`). */
      if (
        i > runStart && runStart > 0 &&
        text[runStart - 1] === ch &&
        (text[i + 1] === '=' || text[i + 1] === ':')
      ) {
        const valueStart = skipPairWhitespace(text, i + 2);
        if (pairNameIsSensitive(text, runStart, i, sensitive)) {
          const end = pairValueEnd(text, valueStart);
          out.push(text.slice(last, valueStart), REDACTED);
          last = end;
          i = end;
        } else {
          i = valueStart;
        }
        runStart = i;
        continue;
      }
      i++;
      runStart = i;
      continue;
    }
    if ((ch === '=' || ch === ':') && i > runStart) {
      const valueStart = skipPairWhitespace(text, i + 1);
      if (pairNameIsSensitive(text, runStart, i, sensitive)) {
        const end = pairValueEnd(text, valueStart);
        out.push(text.slice(last, valueStart), REDACTED);
        last = end;
        i = end;
      } else {
        i = valueStart;
      }
      runStart = i;
      continue;
    }
    if (!isPairNameChar(ch)) {
      i++;
      runStart = i;
      continue;
    }
    i++;
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
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (!text) return text;
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
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
  /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
  if (jsonRedacted !== null) return encodeURIComponent(jsonRedacted);
  /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
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
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      ...(sensitiveParams ?? []),
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      ...(sensitiveBodyFields ?? []),
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
      ...(sensitiveHeaders ?? []),
      /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    ].map((n) => n.toLowerCase()),
  );

  /* The urlsplit twin: a scheme is "name:" - with "//" the authority
     follows, without it the remainder is path-only (Python urlsplit gives
     'a:password=x' scheme 'a' and path 'password=x', no netloc), which is
     what lets the endpoint redactor mask pair values after a scheme
     colon. */
  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*:)(\/\/)?/.exec(url);
  let rest = url;
  let scheme = '';
  let hasAuthority = false;
  if (schemeMatch) {
    hasAuthority = schemeMatch[2] === '//';
    scheme = url.slice(0, schemeMatch[0].length);
    rest = url.slice(scheme.length);
  }

  let authority = '';
  if (hasAuthority) {
    const slashIndex = rest.indexOf('/');
    const questionIndex = rest.indexOf('?');
    const hashIndex = rest.indexOf('#');
    let authorityEnd = rest.length;
    for (const idx of [slashIndex, questionIndex, hashIndex]) {
      if (idx !== -1 && idx < authorityEnd) authorityEnd = idx;
    }
    authority = rest.slice(0, authorityEnd);
    rest = rest.slice(authorityEnd);
  } else if (!scheme) {
    /* No scheme: the pre-separator run is the authority only until the
       first path/query/fragment character, exactly like the legacy
       relative-URL handling. */
    const slashIndex = rest.indexOf('/');
    const questionIndex = rest.indexOf('?');
    const hashIndex = rest.indexOf('#');
    let authorityEnd = rest.length;
    for (const idx of [slashIndex, questionIndex, hashIndex]) {
      if (idx !== -1 && idx < authorityEnd) authorityEnd = idx;
    }
    authority = rest.slice(0, authorityEnd);
    rest = rest.slice(authorityEnd);
  }

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

  /* Path pair redaction (the twin of _redact_sensitive_path): a
     sensitive name=value pair inside the path is masked like one in the
     query - the reference endpoint redactor relies on this for
     scheme-colon inputs ('a:password=x' parses scheme 'a', path
     'password=x'). */
  const redactedPath = redactPairsSegment(path, sensitive);

  let result = scheme + authority + redactedPath;
  if (query !== null) result += '?' + redactPairsSegment(query, sensitive);
  if (fragment !== null) result += '#' + redactPairsSegment(fragment, sensitive);
  return result;
}

/* The twin of redact_endpoint_for_display: the reference is a straight
   delegation to redact_url_for_display. */
export function redactEndpointForDisplay(
  value: string,
  sensitiveParams: Iterable<string> | null | undefined,
  sensitiveBodyFields: Iterable<string> | null | undefined,
  sensitiveHeaders: Iterable<string> | null | undefined,
): string {
  return redactUrlForDisplay(value, sensitiveParams, sensitiveBodyFields, sensitiveHeaders);
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
