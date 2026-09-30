/**
 * Edge coverage for the detection pattern matchers the contract tests do not
 * reach: pickle opcode validation, xml/xxe structural scans, ldap breakout
 * windows, legacy ipv4 decoding, scan-window matchers, file-upload kinds,
 * shell validators, and template scan regions.
 */
import { describe, expect, it } from 'vitest';

import {
  _PICKLE_REDUCE_OR_BUILD_KEYS,
  _pickle_global_candidate_is_injection,
  picklePrefixIsOpcodeStream,
  pickleSuffixReachesReduceOrBuild,
} from '../../src/detection-engine/patterns/pickle.js';
import {
  _xml_internal_entity_finditer,
  _xml_system_finditer,
  _xml_xxe_public_external_dtd_finditer,
} from '../../src/detection-engine/patterns/xml-xxe.js';
import {
  _legacy_ipv4_match_is_blocked,
  decodeLegacyIpv4Host,
} from '../../src/detection-engine/patterns/ldap-ipv4.js';
import {
  _brace_expansion_is_dangerous_command,
  _cmd_injection_dollar_scan_matches,
  _cmd_injection_shell_dash_c_finditer,
  _ldap_null_byte_attr_finditer,
  _load_file_scan_matches,
  _pickle_global_generic_finditer,
  _quote_splice_finditer,
  _template_asp_keyword_scan_matches,
  _template_curly_call_scan_matches,
  _template_curly_keyword_scan_matches,
  _template_dollar_brace_scan_matches,
  _template_percent_keyword_scan_matches,
} from '../../src/detection-engine/patterns/matchers.js';
import {
  _file_upload_double_extension_scan_matches,
  _file_upload_scan_matches,
} from '../../src/detection-engine/patterns/file-upload.js';
import {
  _dollar_substitution_pair_is_injection,
  _glued_backtick_pair_is_injection,
  _glob_wildcard_token_is_dangerous_command,
  _quote_splice_token_is_dangerous_command,
} from '../../src/detection-engine/patterns/shell-validators.js';
import {
  template_expression_matches,
  template_keyword_matches,
} from '../../src/detection-engine/patterns/templates.js';
import { reconPathValueIsProbe } from '../../src/detection-engine/patterns/sources.js';
import {
  compilePythonPattern,
  matchSpan,
  searchSpan,
} from '../../src/detection-engine/regex-compat.js';
import {
  _CMD_INJECTION_DOLLAR_SUBSTITUTION_RE,
  _FILE_UPLOAD_DANGEROUS_EXTENSION_RE,
  _FILE_UPLOAD_DECODED_TRUNCATION_RE,
  _FILE_UPLOAD_DOUBLE_EXTENSION_RE,
  _FILE_UPLOAD_TRUNCATION_RE,
  _GLUED_BACKTICK_CANDIDATE_RE,
  _GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE,
  _GLOB_WILDCARD_ATOM_RE,
  _LDAP_NULL_BYTE_ATTR_RE,
  _LDAP_NULL_BYTE_DECODED_ATTR_RE,
  _SQLI_LOAD_FILE_RE,
  _TEMPLATE_ASP_KEYWORD_RE,
  _TEMPLATE_CURLY_CALL_RE,
  _TEMPLATE_CURLY_KEYWORD_RE,
  _TEMPLATE_DOLLAR_BRACE_CALL_RE,
  _TEMPLATE_PERCENT_KEYWORD_RE,
} from '../../src/detection-engine/patterns/canonical-sources.generated.js';
import { bounded_finditer } from '../../src/detection-engine/scan-window.js';

/** Build a match-like object the way a python finditer would. */
function findMatch(source: string, text: string): RegExpExecArray | null {
  return new RegExp(source, 'g').exec(text);
}

describe('pickle opcode walk', () => {
  it('accepts trivial and empty prefixes', () => {
    expect(picklePrefixIsOpcodeStream('')).toBe(true);
    expect(picklePrefixIsOpcodeStream('already ends newline\n')).toBe(true);
    expect(_PICKLE_REDUCE_OR_BUILD_KEYS.has(0x52)).toBe(true);
    expect(_PICKLE_REDUCE_OR_BUILD_KEYS.has(0x62)).toBe(true);
  });

  it('validates a stream of stack-neutral opcodes', () => {
    // PROTO + EMPTY_LIST + NONE + NEWTRUE + MEMOIZE + FRAME is a valid walk.
    const bytes = [0x80, 0x04, 0x5d, 0x4e, 0x88, 0x94, 0x71, 0x01, 0x95, 0, 0, 0, 0, 0, 0, 0, 0];
    const text = String.fromCharCode(...bytes);
    expect(picklePrefixIsOpcodeStream(text)).toBe(true);
  });

  it('rejects unknown opcodes and blocked resolution', () => {
    expect(picklePrefixIsOpcodeStream('\u00ff')).toBe(false); // 0xff unknown
    expect(picklePrefixIsOpcodeStream('c')).toBe(false); // GLOBAL blocked
    expect(picklePrefixIsOpcodeStream('R')).toBe(false); // REDUCE stops the walk as incomplete
  });

  it('validates scalar opcode encodings', () => {
    expect(picklePrefixIsOpcodeStream('I01\nN')).toBe(true);
    expect(picklePrefixIsOpcodeStream('I-42\nN')).toBe(true);
    expect(picklePrefixIsOpcodeStream('Iabc\nN')).toBe(false);
    expect(picklePrefixIsOpcodeStream('L123L\nN')).toBe(true);
    expect(picklePrefixIsOpcodeStream('L1.5\nN')).toBe(false);
    expect(picklePrefixIsOpcodeStream('F1.5\nN')).toBe(true);
    expect(picklePrefixIsOpcodeStream('Fxyz\nN')).toBe(false);
    expect(picklePrefixIsOpcodeStream('J1234')).toBe(true);
    expect(picklePrefixIsOpcodeStream('K1')).toBe(true);
    expect(picklePrefixIsOpcodeStream('M12')).toBe(true);
    expect(picklePrefixIsOpcodeStream('G12345678')).toBe(true);
    expect(picklePrefixIsOpcodeStream("S'ab'\nN")).toBe(true);
    expect(picklePrefixIsOpcodeStream('ab\nN')).toBe(false);
    expect(picklePrefixIsOpcodeStream('V unicode here\nN')).toBe(true);
    // Length-prefixed string opcodes read exactly length bytes.
    expect(picklePrefixIsOpcodeStream('U\u0003abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('C\u0003abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('T\u0003\u0000\u0000\u0000abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('\u008c\u0003abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('B\u0003\u0000\u0000\u0000abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('\u008e\u0003\u0000\u0000\u0000\u0000\u0000\u0000\u0000abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('\u0096\u0003\u0000\u0000\u0000\u0000\u0000\u0000\u0000abc')).toBe(true);
    expect(picklePrefixIsOpcodeStream('\u008a\u0002ab')).toBe(true);
    expect(picklePrefixIsOpcodeStream('\u008b\u0002\u0000\u0000\u0000ab')).toBe(true);
    // Truncated length-prefixed payloads fail the complete walk.
    expect(picklePrefixIsOpcodeStream('U3abc')).toBe(false);
    expect(picklePrefixIsOpcodeStream('\u0080\u0004')).toBe(true);
  });

  it('validates memo get operations', () => {
    // MEMOIZE seeds the memo, then BINPUT/BINGET with the same index.
    expect(picklePrefixIsOpcodeStream('\u0094q\u0005h\u0005')).toBe(false);
    // BINGET without a memo entry is blocked.
    expect(picklePrefixIsOpcodeStream('h\u0005')).toBe(false);
    // One item on the stack, MEMOIZE (key 0), then GET '0' resolves.
    expect(picklePrefixIsOpcodeStream('N\u0094g0\nN')).toBe(true);
    // GET without a memo entry is blocked.
    expect(picklePrefixIsOpcodeStream('g9\nN')).toBe(false);
  });

  it('validates mark/pop and container opcodes', () => {
    // MARK, two items, APPENDS consumes the mark group.
    expect(picklePrefixIsOpcodeStream('(NNe')).toBe(true);
    // POP on an empty stack is blocked.
    expect(picklePrefixIsOpcodeStream('0')).toBe(false);
    // DUP on empty stack is blocked.
    expect(picklePrefixIsOpcodeStream('2')).toBe(false);
    // MARK, items, then the mark-consuming container opcodes.
    expect(picklePrefixIsOpcodeStream('(NNu')).toBe(true);
    expect(picklePrefixIsOpcodeStream('(NNl')).toBe(true);
    expect(picklePrefixIsOpcodeStream('(NNt')).toBe(true);
    expect(picklePrefixIsOpcodeStream('(NNd')).toBe(true);
    // APPEND pops one item; SETITEM pops two.
    expect(picklePrefixIsOpcodeStream('NNa')).toBe(true);
    expect(picklePrefixIsOpcodeStream('NNs')).toBe(true);
    // POP_MARK without a mark is blocked.
    expect(picklePrefixIsOpcodeStream('1')).toBe(false);
    // MEMOIZE on an empty stack is blocked.
    expect(picklePrefixIsOpcodeStream('\u0094')).toBe(false);
    // BINPUT on an empty stack is blocked.
    expect(picklePrefixIsOpcodeStream('q\u0001')).toBe(false);
    // LONG_BINPUT on an empty stack is blocked.
    expect(picklePrefixIsOpcodeStream('r\u0001\u0000\u0000\u0000')).toBe(false);
  });

  it('rejects windows that are not byte-safe', () => {
    expect(picklePrefixIsOpcodeStream('\u1234')).toBe(false);
    // Surrogate escapes map back into bytes.
    expect(picklePrefixIsOpcodeStream(String.fromCharCode(0xdc80 + 0x0a))).toBe(false);
  });

  it('walks suffixes up to REDUCE or BUILD', () => {
    expect(pickleSuffixReachesReduceOrBuild('R')).toBe(true);
    expect(pickleSuffixReachesReduceOrBuild('\u0094b')).toBe(true);
    expect(pickleSuffixReachesReduceOrBuild('NNR')).toBe(true);
    expect(pickleSuffixReachesReduceOrBuild('\u00ff')).toBe(false);
    // A complete window that exhausts without REDUCE/BUILD fails.
    expect(pickleSuffixReachesReduceOrBuild('\u0080\u0004')).toBe(false);
    // Overlong windows are incomplete: treated as inconclusive (true).
    const long = `${'K1'.repeat(3000)}R`;
    expect(pickleSuffixReachesReduceOrBuild(long)).toBe(true);
  });

  it('filters pickle global injection candidates', () => {
    const payload = 'cos\nsystem\n(R';
    const match = findMatch(
      '(c[A-Za-z_][A-Za-z0-9_]{0,100}(?:\\.[A-Za-z_][A-Za-z0-9_]{0,100}){0,20}\\n[A-Za-z_][A-Za-z0-9_]{0,100}\\n)[^ \\t]{0,100}?[Rb]',
      payload,
    );
    expect(match).not.toBeNull();
    expect(_pickle_global_candidate_is_injection(match as RegExpExecArray, 'request_body')).toBe(true);
    // Without a newline the prefix walk fails -> rejected.
    const bad = findMatch(
      '(c[A-Za-z_][A-Za-z0-9_]{0,100}(?:\\.[A-Za-z_][A-Za-z0-9_]{0,100}){0,20}\\n[A-Za-z_][A-Za-z0-9_]{0,100}\\n)[^ \\t]{0,100}?[Rb]',
      'cos\nsystem\n(',
    );
    expect(bad).toBeNull();
  });

  it('drives the generic pickle global finder', () => {
    const text = 'junk\ncos\nsystem\n(R\ntrailing';
    const matches = _pickle_global_generic_finditer(text);
    expect(matches.length).toBeGreaterThan(0);
    expect(_pickle_global_generic_finditer('no newlines here')).toEqual([]);
    expect(_pickle_global_generic_finditer('one\nnewline')).toEqual([]);
  });
});

describe('xml/xxe structural scans', () => {
  it('finds SYSTEM declarations', () => {
    const text = '<!DOCTYPE r SYSTEM "http://x"><r/>';
    expect(_xml_system_finditer(text)).toHaveLength(1);
    expect(_xml_system_finditer('<!DOCTYPE r "no-keyword">')).toEqual([]);
    expect(_xml_system_finditer('<!DOCTYPE r SYSTEM')).toEqual([]);
  });

  it('finds internal entity blocks after DOCTYPE[', () => {
    const text = '<!DOCTYPE r [ <!ENTITY x SYSTEM "file:///e"> ]>';
    expect(_xml_internal_entity_finditer(text)).toHaveLength(1);
    expect(_xml_internal_entity_finditer('<!DOCTYPE r [ no entity')).toEqual([]);
    expect(_xml_internal_entity_finditer('<!DOCTYPE r > <!ENTITY x>')).toEqual([]);
  });

  it('finds PUBLIC external DTD candidates', () => {
    const text = '<!DOCTYPE r PUBLIC "-//x//y" "http://evil/x"> <r/>';
    expect(_xml_xxe_public_external_dtd_finditer(text)).toHaveLength(1);
    expect(_xml_xxe_public_external_dtd_finditer('<!DOCTYPE r PUBLIC "no-scheme" "x">')).toEqual([]);
    expect(_xml_xxe_public_external_dtd_finditer('<!DOCTYPE r SYSTEM "http://x">')).toEqual([]);
  });
});

describe('legacy ipv4 hosts', () => {
  it('decodes legacy forms', () => {
    expect(decodeLegacyIpv4Host('127.0.0.1')).toBe(0x7f000001);
    expect(decodeLegacyIpv4Host('2130706433')).toBe(2130706433);
    expect(decodeLegacyIpv4Host('0x7f.1')).toBe(0x7f000001);
    expect(decodeLegacyIpv4Host('0177.0.0.1')).toBe(0x7f000001);
    expect(decodeLegacyIpv4Host('127.1')).toBe(0x7f000001);
    // A small bare decimal is an ambiguous legacy port: rejected.
    expect(decodeLegacyIpv4Host('127')).toBeNull();
    expect(decodeLegacyIpv4Host('1.2.3.4.5')).toBeNull();
    expect(decodeLegacyIpv4Host('0xzz')).toBeNull();
    expect(decodeLegacyIpv4Host('0190.1')).toBeNull();
    expect(decodeLegacyIpv4Host('256.1')).toBeNull();
    expect(decodeLegacyIpv4Host('1.2.3.256')).toBeNull();
  });

  it('blocks matches into private and loopback ranges', () => {
    const build = (host: string): RegExpExecArray | null =>
      findMatch(
        '://(?:[^/@\\s]*@)?((?:0[xX][0-9a-fA-F]+|0[0-7]+|[1-9]\\d*|0)(?:\\.(?:0[xX][0-9a-fA-F]+|0[0-7]+|[1-9]\\d*|0)){0,3})(?=[:/\\s]|$)',
        `http://${host}/`,
      );
    const loopback = build('2130706433');
    expect(loopback).not.toBeNull();
    expect(_legacy_ipv4_match_is_blocked(loopback as RegExpExecArray)).toBe(true);
    const public_ = build('134744072'); // 8.8.8.8
    expect(public_).not.toBeNull();
    expect(_legacy_ipv4_match_is_blocked(public_ as RegExpExecArray)).toBe(false);
    expect(_legacy_ipv4_match_is_blocked({ 1: 'not-an-ip', index: 0, input: '', 0: '' } as unknown as RegExpExecArray)).toBe(false);
  });
});

describe('scan-window matchers', () => {
  it('finds LOAD_FILE calls', () => {
    const compiled = compilePythonPattern(_SQLI_LOAD_FILE_RE, true);
    const matches = _load_file_scan_matches('SELECT LOAD_FILE("/etc/passwd")', compiled);
    expect(matches).toHaveLength(1);
  });

  it('finds dollar substitutions of both shapes', () => {
    const compiled = compilePythonPattern(_CMD_INJECTION_DOLLAR_SUBSTITUTION_RE);
    const matches = _cmd_injection_dollar_scan_matches('x; $(whoami) and y; ${HOME} end', compiled);
    expect(matches.map((m) => m[0])).toEqual(['; $(whoami)', '; ${HOME}']);
  });

  it('finds newline shell -c chains', () => {
    const matches = _cmd_injection_shell_dash_c_finditer('\n x=1 /bin/bash -c id');
    expect(matches).toHaveLength(1);
    expect(_cmd_injection_shell_dash_c_finditer('no newline')).toEqual([]);
  });

  it('finds quote splice candidates', () => {
    const matches = _quote_splice_finditer("ab'cd'ef");
    expect(matches).toHaveLength(1);
    expect(_quote_splice_finditer('nothing here')).toEqual([]);
  });

  it('runs each template scan matcher', () => {
    const curly = compilePythonPattern(_TEMPLATE_CURLY_KEYWORD_RE, true);
    expect(_template_curly_keyword_scan_matches('{{ system }}', curly)).toHaveLength(1);
    expect(_template_curly_keyword_scan_matches('{{ system() }}', curly)).toEqual([]);
    expect(_template_curly_keyword_scan_matches('{{ nothing }}', curly)).toEqual([]);
    expect(_template_percent_keyword_scan_matches('{% system %}', compilePythonPattern(_TEMPLATE_PERCENT_KEYWORD_RE, true))).toHaveLength(1);
    const dollar = compilePythonPattern(_TEMPLATE_DOLLAR_BRACE_CALL_RE);
    expect(_template_dollar_brace_scan_matches('${eval(1)}', dollar)).toHaveLength(1);
    expect(_template_curly_call_scan_matches('{{eval()}}', compilePythonPattern(_TEMPLATE_CURLY_CALL_RE))).toHaveLength(1);
    expect(_template_asp_keyword_scan_matches('<%eval(1)%>', compilePythonPattern(_TEMPLATE_ASP_KEYWORD_RE, true))).toHaveLength(1);
  });

  it('classifies brace expansions', () => {
    const asMatch = (text: string): RegExpExecArray =>
      ({ 0: text } as unknown as RegExpExecArray);
    expect(_brace_expansion_is_dangerous_command(asMatch('{a,b}c'))).toBe(true);
    expect(_brace_expansion_is_dangerous_command(asMatch('{1,2}'))).toBe(false);
    expect(_brace_expansion_is_dangerous_command(asMatch('no braces'))).toBe(false);
    expect(_brace_expansion_is_dangerous_command(asMatch('{a'))).toBe(false);
    expect(_brace_expansion_is_dangerous_command(asMatch('{a}b}'))).toBe(false);
  });

  it('drives the generic pickle global finder through chained dots', () => {
    const text = 'x\ncos\nsystem\n(R\n';
    expect(_pickle_global_generic_finditer(text)).toHaveLength(1);
    // A chain with dotted segments still resolves.
    const chained = 'x\ncos.sub\nsys\n(R\n';
    expect(_pickle_global_generic_finditer(chained)).toHaveLength(1);
  });
});

describe('ldap null byte scanners', () => {
  const raw = compilePythonPattern(_LDAP_NULL_BYTE_ATTR_RE, true);
  const decoded = compilePythonPattern(_LDAP_NULL_BYTE_DECODED_ATTR_RE, true);

  it('finds null byte attributes in raw form', () => {
    const matches = _ldap_null_byte_attr_finditer('x=(uid=a*))%00 rest', raw);
    expect(matches).toHaveLength(1);
  });

  it('finds decoded null byte attributes', () => {
    const matches = _ldap_null_byte_attr_finditer('x=(uid=a*))\u0000 rest', decoded);
    expect(matches).toHaveLength(1);
  });

  it('returns nothing without stars or parens', () => {
    expect(_ldap_null_byte_attr_finditer('plain text', raw)).toEqual([]);
    expect(_ldap_null_byte_attr_finditer('a* text', raw)).toEqual([]);
    expect(_ldap_null_byte_attr_finditer('(uid=*) no star', raw)).toEqual([]);
  });
});

describe('file upload matchers', () => {
  const dangerous = compilePythonPattern(_FILE_UPLOAD_DANGEROUS_EXTENSION_RE, true);
  const doubleExt = compilePythonPattern(_FILE_UPLOAD_DOUBLE_EXTENSION_RE, true);
  const truncation = compilePythonPattern(_FILE_UPLOAD_TRUNCATION_RE, true);
  const decodedTruncation = compilePythonPattern(_FILE_UPLOAD_DECODED_TRUNCATION_RE, true);

  it('flags dangerous terminal extensions', () => {
    const matches = _file_upload_scan_matches('filename="shell.php"', dangerous);
    expect(matches).toHaveLength(1);
    // Benign terminal extension is not flagged.
    expect(_file_upload_scan_matches('filename="photo.png"', dangerous)).toEqual([]);
    // Double extension: benign terminal + dangerous inner.
    expect(_file_upload_scan_matches('filename="shell.php.png"', doubleExt)).toHaveLength(1);
    expect(_file_upload_scan_matches('filename="photo.png"', doubleExt)).toEqual([]);
    // Truncation markers.
    expect(_file_upload_scan_matches('filename="shell.php%00.jpg"', truncation)).toHaveLength(1);
    expect(_file_upload_scan_matches('filename="shell.php;.jpg"', truncation)).toHaveLength(1);
    expect(_file_upload_scan_matches('filename="shell.php\u0000.jpg"', decodedTruncation)).toHaveLength(1);
    // Unknown kinds are rejected.
    expect(_file_upload_scan_matches('filename="shell.php"', compilePythonPattern('UNKNOWN', true))).toEqual([]);
    // A filename token at position 0 with no preceding boundary is skipped.
    expect(_file_upload_scan_matches('filename="x.php', dangerous)).toEqual([]);
  });

  it('rejects malformed filename candidates', () => {
    expect(_file_upload_scan_matches('filename no-equals "x.php"', dangerous)).toEqual([]);
    expect(_file_upload_scan_matches('filename=noquote.php', dangerous)).toEqual([]);
    expect(_file_upload_scan_matches('filename="unterminated.php', dangerous)).toEqual([]);
  });

  it('bounds the double-extension scan windows', () => {
    const matches = _file_upload_double_extension_scan_matches('filename="shell.php.png"', doubleExt);
    expect(matches).toHaveLength(1);
    expect(_file_upload_double_extension_scan_matches('filename="photo.png"', doubleExt)).toEqual([]);
  });
});

describe('shell validators', () => {
  it('validates glued backtick pairs', () => {
    // Glued on both sides with an ambiguous context: injection.
    const glued = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'x`whoami`y');
    expect(glued).not.toBeNull();
    expect(_glued_backtick_pair_is_injection(glued as RegExpExecArray, 'query_param')).toBe(true);
    // Same shape in a plain body context without metacharacters: rejected.
    expect(_glued_backtick_pair_is_injection(glued as RegExpExecArray, 'request_body')).toBe(false);
    // A strong SQL keyword around the pair is rejected outright.
    const sql = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, '`select`');
    expect(_glued_backtick_pair_is_injection(sql as RegExpExecArray, 'query_param')).toBe(false);
    // Chained shell operators inside the token: injection anywhere.
    const chained = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'x`a; rm -rf`b');
    expect(_glued_backtick_pair_is_injection(chained as RegExpExecArray, 'request_body')).toBe(true);
    // An appended clause after a clause boundary is an injection.
    const appended = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, '. `a b c`');
    expect(_glued_backtick_pair_is_injection(appended as RegExpExecArray, 'url_path')).toBe(true);
  });

  it('validates dollar substitution pairs', () => {
    // $(IFS) is a special parameter: implausible.
    const ifs = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'x;$(IFS)');
    expect(_dollar_substitution_pair_is_injection(ifs as RegExpExecArray, 'request_body')).toBe(true);
    // Backtick-quoted pairs are skipped.
    const quoted = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, '`${id}`');
    expect(_dollar_substitution_pair_is_injection(quoted as RegExpExecArray, 'request_body')).toBe(false);
    // A brace-delimited token that is not a bare parameter name: implausible.
    const weird = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'x;${1abc}');
    expect(_dollar_substitution_pair_is_injection(weird as RegExpExecArray, 'request_body')).toBe(true);
    // A named parameter without an ambiguous context: rejected.
    const named = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'x;${PATH}');
    expect(_dollar_substitution_pair_is_injection(named as RegExpExecArray, 'request_body')).toBe(false);
    // A paren token with path characters: implausible.
    const dotted = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'x;$(a.b/c)');
    expect(_dollar_substitution_pair_is_injection(dotted as RegExpExecArray, 'request_body')).toBe(true);
  });

  it('scores quote splice runs and glob wildcards', () => {
    const asMatch = (text: string): RegExpExecArray => ({ 0: text } as unknown as RegExpExecArray);
    expect(_quote_splice_token_is_dangerous_command(asMatch("a'b'c'd"))).toBe(true);
    expect(_quote_splice_token_is_dangerous_command(asMatch("ab'cd'ef"))).toBe(false);
    // A lone wildcard is not word shaped: rejected everywhere.
    const lone = findMatch(_GLOB_WILDCARD_ATOM_RE, '; rm *');
    expect(_glob_wildcard_token_is_dangerous_command(lone as RegExpExecArray, 'request_body')).toBe(false);
    // A request_body value starting with a wildcard at value start: dangerous.
    const start = findMatch(_GLOB_WILDCARD_ATOM_RE, '*abc');
    expect(_glob_wildcard_token_is_dangerous_command(start as RegExpExecArray, 'request_body')).toBe(true);
    expect(_glob_wildcard_token_is_dangerous_command(start as RegExpExecArray, 'url_path')).toBe(false);
    // A word-shaped wildcard elsewhere is only dangerous right after a
    // command boundary.
    const mid = findMatch(_GLOB_WILDCARD_ATOM_RE, 'ab*cd');
    expect(_glob_wildcard_token_is_dangerous_command(mid as RegExpExecArray, 'request_body')).toBe(true);
  });
});

describe('template regions and recon probes', () => {
  it('handles unterminated and malformed template regions', () => {
    const keyword = compilePythonPattern(_TEMPLATE_CURLY_KEYWORD_RE, true);
    expect(template_keyword_matches('{{ system', keyword)).toEqual([]);
    expect(template_keyword_matches('{{ }}', keyword)).toEqual([]);
    // An unknown kind raises.
    expect(() => template_expression_matches('{{ }}', keyword, 'nope')).toThrow('unknown template kind nope');
    // Date-aware curly/hash scans.
    const curlyCall = compilePythonPattern(_TEMPLATE_CURLY_CALL_RE);
    expect(template_expression_matches('{{eval()}}', curlyCall, 'curly')).toHaveLength(1);
  });

  it('classifies recon path probes', () => {
    expect(reconPathValueIsProbe('/etc/passwd', 'query_param')).toBe(true);
    expect(reconPathValueIsProbe('etc', 'url_path')).toBe(true);
    expect(reconPathValueIsProbe('etc', 'request_body')).toBe(false);
    expect(reconPathValueIsProbe('\\windows', 'request_body')).toBe(true);
    expect(reconPathValueIsProbe('etc', 'unknown:embedded_json')).toBe(true);
  });
});

describe('span helpers', () => {
  it('searchSpan truncates and matchSpan validates', () => {
    const digits = compilePythonPattern('\\d+');
    expect(searchSpan(digits, 'a12b34', 0, 4)?.[0]).toBe('12');
    expect(matchSpan(digits, 'a12', 1, 3)?.[0]).toBe('12');
    expect(matchSpan(digits, 'a1234', 1, 3)?.[0]).toBe('12');
  });
});
