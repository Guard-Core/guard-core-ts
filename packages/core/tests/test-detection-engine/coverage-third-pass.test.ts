/**
 * Third-pass coverage: opcode-stream, shell-validator, ldap, file-upload,
 * matcher, and xml/xxe tails.
 */
import { describe, expect, it } from 'vitest';

import {
  picklePrefixIsOpcodeStream,
  pickleSuffixReachesReduceOrBuild,
} from '../../src/detection-engine/patterns/pickle.js';
import {
  _dollar_substitution_pair_is_injection,
  _glued_backtick_pair_is_injection,
} from '../../src/detection-engine/patterns/shell-validators.js';
import {
  decodeLegacyIpv4Host,
  _ldap_paren_conjunction_is_injection,
  _ldap_wildcard_chain_is_injection,
} from '../../src/detection-engine/patterns/ldap-ipv4.js';
import {
  _file_upload_double_extension_scan_matches,
  _file_upload_scan_matches,
} from '../../src/detection-engine/patterns/file-upload.js';
import {
  _cmd_injection_shell_dash_c_finditer,
  _ldap_null_byte_attr_finditer,
  _ldap_null_byte_bare_finditer,
  _load_file_scan_matches,
  _pickle_global_generic_finditer,
  _quote_splice_finditer,
} from '../../src/detection-engine/patterns/matchers.js';
import {
  _xml_internal_entity_finditer,
  _xml_system_finditer,
  _xml_xxe_public_external_dtd_finditer,
} from '../../src/detection-engine/patterns/xml-xxe.js';
import { compilePythonPattern } from '../../src/detection-engine/regex-compat.js';
import { _GLUED_BACKTICK_CANDIDATE_RE, _GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE } from '../../src/detection-engine/patterns/shell-sources.js';
import {
  _CMD_INJECTION_NEWLINE_SHELL_DASH_C_RE,
  _DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE,
  _FILE_UPLOAD_DANGEROUS_EXTENSION_RE,
  _FILE_UPLOAD_DOUBLE_EXTENSION_RE,
  _LDAP_NULL_BYTE_ATTR_RE,
  _LDAP_NULL_BYTE_DECODED_ATTR_RE,
  _LDAP_PAREN_CONJUNCTION_RE,
  _LDAP_WILDCARD_CHAIN_RE,
  _QUOTE_SPLICE_CANDIDATE_RE,
  _SQLI_LOAD_FILE_RE,
} from '../../src/detection-engine/patterns/canonical-sources.generated.js';

function findMatch(source: string, text: string): RegExpExecArray | null {
  return new RegExp(source, 'g').exec(text);
}

describe('pickle opcode tails', () => {
  it('covers the remaining dispatch arms', () => {
    // readline short read inside a complete window fails.
    expect(picklePrefixIsOpcodeStream('V abc')).toBe(false);
    // POP and DUP on a non-empty stack walk fine.
    expect(picklePrefixIsOpcodeStream('NN0')).toBe(true);
    expect(picklePrefixIsOpcodeStream('N2')).toBe(true);
    // STRING without quotes is rejected.
    expect(picklePrefixIsOpcodeStream("Sab\nN")).toBe(false);
    // BINUNICODE with a valid length prefix.
    expect(picklePrefixIsOpcodeStream('X\u0003\u0000\u0000\u0000abc')).toBe(true);
    // LONG_BINPUT with an item, then LONG_BINGET of the same slot.
    expect(picklePrefixIsOpcodeStream('Nr\u0001\u0000\u0000\u0000j\u0001\u0000\u0000\u0000')).toBe(true);
    // An item, MEMOIZE (key 0), then GET '0'.
    expect(picklePrefixIsOpcodeStream('N\u0094g0\nN')).toBe(true);
    // A suffix that is not byte-safe fails.
    expect(pickleSuffixReachesReduceOrBuild('\u1234R')).toBe(false);
    // A complete suffix that never reaches REDUCE/BUILD fails.
    expect(pickleSuffixReachesReduceOrBuild('\u0080\u0004')).toBe(false);
  });
});

describe('shell validator tails', () => {
  it('rejects appended clauses without a whitespace boundary', () => {
    // Tail anchored but glued on the prefix: ambiguous context decides.
    const pair = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'x`a b c`');
    expect(pair).not.toBeNull();
    expect(_glued_backtick_pair_is_injection(pair as RegExpExecArray, 'query_param')).toBe(true);
    // Neither glued nor clause-initial: rejected even in an ambiguous context.
    const spaced = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, ' `a b c`');
    expect(_glued_backtick_pair_is_injection(spaced as RegExpExecArray, 'url_path')).toBe(false);
  });

  it('flags implausible tokens, metacharacter windows, and glued sql', () => {
    // A token with an implausible identifier char is an injection outright.
    const implausible = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'x`a.b c`y');
    expect(_glued_backtick_pair_is_injection(implausible as RegExpExecArray, 'request_body')).toBe(true);
    // A metacharacter inside the surrounding window is an injection.
    const window = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'a; b`c`d');
    expect(_glued_backtick_pair_is_injection(window as RegExpExecArray, 'request_body')).toBe(true);
    // A strong SQL keyword glued before the pair rejects the candidate.
    const sql = findMatch(_GLUED_BACKTICK_CANDIDATE_RE, 'select`abc`d');
    expect(_glued_backtick_pair_is_injection(sql as RegExpExecArray, 'query_param')).toBe(false);
    // Dollar substitution glued after a strong SQL keyword is rejected.
    const sqlDollar = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'select${PATH}');
    expect(_dollar_substitution_pair_is_injection(sqlDollar as RegExpExecArray, 'query_param')).toBe(false);
    // A special parameter name is implausible regardless of context.
    const ifs = findMatch(_GLUED_DOLLAR_SUBSTITUTION_CANDIDATE_RE, 'select${IFS}');
    expect(_dollar_substitution_pair_is_injection(ifs as RegExpExecArray, 'url_path')).toBe(true);
  });
});

describe('ldap tails', () => {
  it('decodes the remaining legacy host shapes', () => {
    expect(decodeLegacyIpv4Host('0x')).toBeNull();
    // A single bare decimal below 2^24 is an ambiguous legacy port.
    expect(decodeLegacyIpv4Host('256')).toBeNull();
    // Multi-part hosts tolerate an oversized final octet via the bit shift.
    expect(decodeLegacyIpv4Host('25.1')).toBe(419430401);
  });

  it('scores wildcard-chain and paren-conjunction candidates', () => {
    const chain = findMatch(_LDAP_WILDCARD_CHAIN_RE, 'y=*)|(name=');
    expect(chain).not.toBeNull();
    expect(_ldap_wildcard_chain_is_injection(chain as RegExpExecArray, _LDAP_WILDCARD_CHAIN_RE)).toBe(true);
    // No closing paren inside the match: not an injection.
    const plain = findMatch('\\*', '(uid=*)');
    expect(_ldap_wildcard_chain_is_injection(plain as RegExpExecArray, '\\*')).toBe(false);
    // Paren conjunction with an operator right after the tail.
    const conj = findMatch(_LDAP_PAREN_CONJUNCTION_RE, '(x=1)(&(a=b))');
    expect(conj).not.toBeNull();
    expect(_ldap_paren_conjunction_is_injection(conj as RegExpExecArray, _LDAP_PAREN_CONJUNCTION_RE)).toBe(true);
    // A tail without = and without a follow-up symbol is benign.
    const benign = findMatch(_LDAP_PAREN_CONJUNCTION_RE, '(x=1)(&abc');
    expect(benign).not.toBeNull();
    expect(_ldap_paren_conjunction_is_injection(benign as RegExpExecArray, _LDAP_PAREN_CONJUNCTION_RE)).toBe(false);
  });
});

describe('file upload tails', () => {
  const dangerous = compilePythonPattern(_FILE_UPLOAD_DANGEROUS_EXTENSION_RE, true);
  const doubleExt = compilePythonPattern(_FILE_UPLOAD_DOUBLE_EXTENSION_RE, true);

  it('rejects candidates whose match start cannot be resolved', () => {
    // filename preceded by a non-boundary character: no match start.
    expect(_file_upload_scan_matches('x filename="shell.php"', dangerous)).toEqual([]);
    // A newline boundary resolves the start.
    expect(_file_upload_scan_matches('\nfilename="shell.php"', dangerous)).toHaveLength(1);
  });

  it('bounds double-extension windows with quotes', () => {
    expect(_file_upload_double_extension_scan_matches('filename="a.php.png" filename="b.php.png"', doubleExt)).toHaveLength(1);
  });
});

describe('matcher tails', () => {
  it('scans newline shell -c chains with repeated assignments', () => {
    const matches = _cmd_injection_shell_dash_c_finditer('\n a=1 b=2 bash -c id');
    expect(matches).toHaveLength(1);
    // A candidate that fails the anchored pattern still advances the scan.
    expect(_cmd_injection_shell_dash_c_finditer('\n a=1')).toEqual([]);
  });

  it('scans load-file windows and rejects mid-token candidates', () => {
    const compiled = compilePythonPattern(_SQLI_LOAD_FILE_RE, true);
    expect(_load_file_scan_matches('LOAD_FILE(1) then LOAD_FILE(2)', compiled)).toHaveLength(2);
  });

  it('scans quote splices with overlapping runs', () => {
    const matches = _quote_splice_finditer("x'a'b'c'd");
    expect(matches.length).toBeGreaterThan(0);
    expect(_quote_splice_finditer("'abc")).toEqual([]);
  });

  it('scans ldap null byte attributes in bare and decoded forms', () => {
    const raw = compilePythonPattern(_LDAP_NULL_BYTE_ATTR_RE, true);
    const decoded = compilePythonPattern(_LDAP_NULL_BYTE_DECODED_ATTR_RE, true);
    expect(_ldap_null_byte_bare_finditer('=(uid=x*))%00', raw)).toHaveLength(1);
    expect(_ldap_null_byte_attr_finditer('name=(uid=x*))\u0000', decoded)).toHaveLength(1);
    // A star without a closing paren is skipped.
    expect(_ldap_null_byte_attr_finditer('(uid=x*', raw)).toEqual([]);
    // A candidate whose value does not follow '=' is skipped.
    expect(_ldap_null_byte_attr_finditer('x*9)rest', raw)).toEqual([]);
  });

  it('drives the generic pickle global finder over long chains', () => {
    const match = findMatch(
      _DESERIALIZATION_PICKLE_GLOBAL_GENERIC_RE,
      'junk\ncos\nsystem\n(R\ntrailing',
    );
    expect(match).not.toBeNull();
    expect(_pickle_global_generic_finditer('junk\ncos\nsystem\n(R\ntrailing')).toHaveLength(1);
  });
});

describe('xml/xxe structural tails', () => {
  it('skips overlapping and unterminated declarations', () => {
    expect(_xml_system_finditer('<!DOCTYPE SYSTEM')).toEqual([]);
    expect(_xml_internal_entity_finditer('<!DOCTYPE')).toEqual([]);
    expect(_xml_xxe_public_external_dtd_finditer('<!DOCTYPE x')).toEqual([]);
    expect(_xml_xxe_public_external_dtd_finditer('PUBLIC alone')).toEqual([]);
  });
});
