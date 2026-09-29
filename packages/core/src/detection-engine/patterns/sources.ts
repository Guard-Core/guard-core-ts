/**
 * Context sets and path-pattern composer functions ported from
 * guard_core/handlers/_suspatterns_sources.py (spec 4.0.2). The regex
 * source strings themselves live in canonical-sources.generated.ts, which is
 * generated from the reference to keep the canonical threat strings exact.
 */

export {
  _SELECT_FROM_RE,
  _SELECT_STAR_RE,
  _WHERE_CLAUSE_RE,
  _SQLI_TAUTOLOGY_RE,
  _PATH_ONLY_CHAR_RE,
  _PATH_ONLY_SEP_RE,
  _PATH_ONLY_PREFIX_RE,
  _PATH_ONLY_SUFFIX_RE,
  _SENSITIVE_SOURCE_EXTENSION_PATH_RE,
  _RECON_EXTENSION_PATH_RE,
  _ATTACK_REPORT_LEXICON_RE,
  _SINGLE_LINE_PREFIX_RE,
  _SINGLE_LINE_SUFFIX_RE,
  _TOP_LEVEL_PATH_PREFIX_RE,
  _TERMINAL_PATH_SUFFIX_RE,
  _LDAP_ATTR_DESC_RE,
  _LDAP_ATTR_EXTENSIBLE_MATCH_RE,
  _LDAP_WILDCARD_CHAIN_RE,
  _LDAP_BREAKOUT_WILDCARD_CLAUSE_END_RE,
  _LDAP_BREAKOUT_ATTACK_TOKEN_RE,
  _LDAP_FILTER_EXPRESSION_STRUCTURE_RE,
  _PROTO_POLLUTION_PROTOTYPE_ASSIGN_RE,
  _PROTO_POLLUTION_SET_PROTOTYPE_OF_RE,
  _XML_XXE_PUBLIC_EXTERNAL_DTD_RE,
  _XSS_JS_SCHEME_CTRL_CHAR_RE,
  _FILE_INCLUSION_JSON_VALUE_RE,
  _SSRF_BARE_METADATA_ALIAS_RE,
  _CMD_INJECTION_NODE_CHILD_PROCESS_RE,
  _CMD_INJECTION_PHP_ASSERT_VARIABLE_RE,
  _CMD_INJECTION_PYTHON_EXEC_FAMILY_RE,
  _JS_DYNAMIC_EVAL_FUNCTION_CTOR_RE,
  _JS_DYNAMIC_EVAL_BRACKET_RE,
  _JS_DYNAMIC_EVAL_CTOR_GADGET_RE,
  _JS_DYNAMIC_EVAL_TIMER_STRING_ARG_RE,
  _FILE_INCLUSION_HOST_LABEL_RE,
  _FILE_INCLUSION_BARE_HOST_RE,
  _HTTP_SPLIT_CRLF_RE,
  _SQLI_ORDER_BY_TERMINATOR_RE,
  _SQLI_ORDER_BY_STRONG_RE,
  _SQLI_EXEC_STRONG_RE,
  _SQLI_COMMENT_TERMINATOR_RE,
  _SQLI_WAITFOR_RE,
  _PATH_TRAVERSAL_ENCODED_DOT_RE,
  _PATH_TRAVERSAL_SEMICOLON_SEP_RE,
  _PATH_TRAVERSAL_DECODED_SHAPE_RE,
  _CMD_INJECTION_NEWLINE_SHELL_DASH_C_RE,
  _CMD_INJECTION_SHELL_DASH_FLAG_RE,
  _DIR_TRAVERSAL_ETC_SENSITIVE_RE,
  _DIR_TRAVERSAL_WINDOWS_INI_RE,
  _DIR_TRAVERSAL_PROC_ENVIRON_RE,
  _DIR_TRAVERSAL_VAR_LOG_RE,
  _SSTI_HASH_BRACE_SHAPE_RE,
  _DESERIALIZATION_JAVA_B64_RE,
  _DESERIALIZATION_DOTNET_B64_RE,
  _DESERIALIZATION_PICKLE_B64_RE,
  _DESERIALIZATION_RUBY_B64_RE,
  _DESERIALIZATION_PICKLE_OS_GLOBAL_RE,
  _PICKLE_IDENT_RE,
  _PICKLE_DOTTED_MODULE_RE,
  _DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE,
  _LDAP_PAREN_CONJUNCTION_RE,
  _LDAP_PAREN_CONJUNCTION_FOLLOWUP_SYMBOL_RE,
  _LDAP_PAREN_CONJUNCTION_FOLLOWUP_ATTR_RE,
  _LDAP_WILDCARD_EQUALS_RE,
  _LDAP_PAREN_BREAKOUT_RE,
  _LDAP_NULL_BYTE_ATTR_RE,
  _LDAP_NULL_BYTE_BARE_RE,
  _LDAP_NULL_BYTE_DECODED_ATTR_RE,
  _LDAP_NULL_BYTE_DECODED_BARE_RE,
  _LDAP_NULL_BYTE_ATTR_COMPILED,
  _LDAP_NULL_BYTE_DECODED_ATTR_COMPILED,
  _LDAP_NULL_BYTE_TAIL_COMPILED,
  _LDAP_NULL_BYTE_DECODED_TAIL_COMPILED,
} from './canonical-sources.generated.js';

export const _DEFAULT_MAX_SCAN_LENGTH = 10000;
export const _DEFAULT_COMPILER_TIMEOUT = 2.0;
export const _DEFAULT_MAX_BODY_INSPECT_BYTES = 262144;

export const _EMBEDDED_JSON_LEAF_CONTEXT_SUFFIX = ':embedded_json';

export function _source_extension_path_is_probe(context: string): boolean {
  return !context.endsWith(_EMBEDDED_JSON_LEAF_CONTEXT_SUFFIX);
}

// Contexts whose scanned value IS a URL path (or of unknown origin), so a
// bare word still reads as a path probe. Mirrors _RECON_BARE_PATH_CONTEXTS
// in guard_core/handlers/_suspatterns_sources.py (upstream #115/#116).
const _RECON_BARE_PATH_CONTEXTS: ReadonlySet<string> = new Set(['url_path', 'unknown']);

/**
 * Python `_recon_path_value_is_probe`: a recon match is a probe when the
 * scanned value's context is url_path/unknown (compared on the first segment
 * before any `:suffix`, e.g. `query_param:embedded_json`), or when the
 * matched value itself starts with a path separator.
 */
export function reconPathValueIsProbe(matchedValue: string, context: string): boolean {
  return (
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
    _RECON_BARE_PATH_CONTEXTS.has(context.split(':', 1)[0] ?? '') ||
    /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
    matchedValue.startsWith('/') ||
    matchedValue.startsWith('\\')
  );
}

// ---------------------------------------------------------------------------
// Context sets (CATEGORY_CONTEXT_MAP)
// ---------------------------------------------------------------------------

export const _CTX_XSS: ReadonlySet<string> = new Set(['query_param', 'header', 'request_body', 'url_path', 'unknown']);
export const _CTX_SQLI: ReadonlySet<string> = new Set(['query_param', 'header', 'request_body', 'url_path', 'unknown']);
export const _CTX_SQLI_NARROW: ReadonlySet<string> = new Set(['query_param', 'request_body', 'unknown']);
export const _CTX_DIR_TRAVERSAL: ReadonlySet<string> = new Set([
  'url_path',
  'query_param',
  'header',
  'request_body',
  'unknown',
]);
export const _CTX_CMD_INJECTION: ReadonlySet<string> = new Set(['query_param', 'header', 'request_body', 'unknown']);
export const _CTX_FILE_INCLUSION: ReadonlySet<string> = new Set([
  'url_path',
  'query_param',
  'header',
  'request_body',
  'unknown',
]);
export const _CTX_LDAP: ReadonlySet<string> = new Set(['query_param', 'header', 'url_path', 'request_body', 'unknown']);
export const _CTX_XML: ReadonlySet<string> = new Set([
  'header',
  'request_body',
  'unknown',
  'query_param',
  'url_path',
]);
export const _CTX_SSRF: ReadonlySet<string> = new Set(['query_param', 'header', 'request_body', 'url_path', 'unknown']);
export const _CTX_NOSQL: ReadonlySet<string> = new Set(['query_param', 'header', 'url_path', 'request_body', 'unknown']);
export const _CTX_FILE_UPLOAD: ReadonlySet<string> = new Set(['header', 'query_param', 'request_body', 'unknown']);
export const _CTX_PATH_TRAVERSAL: ReadonlySet<string> = new Set([
  'url_path',
  'query_param',
  'header',
  'request_body',
  'unknown',
]);
export const _CTX_TEMPLATE: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'request_body',
  'url_path',
  'unknown',
]);
export const _CTX_HTTP_SPLIT: ReadonlySet<string> = new Set([
  'header',
  'query_param',
  'url_path',
  'request_body',
  'unknown',
]);
export const _CTX_SENSITIVE_FILE: ReadonlySet<string> = new Set(['url_path', 'query_param', 'request_body', 'unknown']);
export const _CTX_CMS_PROBING: ReadonlySet<string> = new Set(['url_path', 'query_param', 'request_body', 'unknown']);
export const _CTX_RECON: ReadonlySet<string> = new Set(['url_path', 'query_param', 'request_body', 'unknown']);
export const _CTX_PROTO_POLLUTION: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'url_path',
  'request_body',
  'unknown',
]);
export const _CTX_CODE_INJECTION: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'url_path',
  'request_body',
  'unknown',
]);
export const _CTX_DESERIALIZATION: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'url_path',
  'request_body',
  'unknown',
]);
export const _CTX_ALL: ReadonlySet<string> = new Set([
  'query_param',
  'header',
  'url_path',
  'request_body',
  'unknown',
]);

export const ALL_DETECTION_CATEGORIES: ReadonlySet<string> = new Set([
  'xss',
  'sqli',
  'dir_traversal',
  'path_traversal',
  'cmd_injection',
  'file_inclusion',
  'ldap',
  'xml',
  'ssrf',
  'nosql',
  'file_upload',
  'template',
  'http_split',
  'sensitive_file',
  'cms_probing',
  'recon',
  'proto_pollution',
  'code_injection',
  'deserialization',
]);

export const CATEGORY_CONTEXT_MAP: Readonly<Record<string, ReadonlySet<string>>> = {
  xss: _CTX_XSS,
  sqli: _CTX_SQLI,
  dir_traversal: _CTX_DIR_TRAVERSAL,
  path_traversal: _CTX_PATH_TRAVERSAL,
  cmd_injection: _CTX_CMD_INJECTION,
  file_inclusion: _CTX_FILE_INCLUSION,
  ldap: _CTX_LDAP,
  xml: _CTX_XML,
  ssrf: _CTX_SSRF,
  nosql: _CTX_NOSQL,
  file_upload: _CTX_FILE_UPLOAD,
  template: _CTX_TEMPLATE,
  http_split: _CTX_HTTP_SPLIT,
  sensitive_file: _CTX_SENSITIVE_FILE,
  cms_probing: _CTX_CMS_PROBING,
  recon: _CTX_RECON,
  proto_pollution: _CTX_PROTO_POLLUTION,
  code_injection: _CTX_CODE_INJECTION,
  deserialization: _CTX_DESERIALIZATION,
};
