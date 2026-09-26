import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SENSITIVE_LOG_HEADERS,
  DEFAULT_SENSITIVE_LOG_FIELDS,
  mergeSensitiveNames,
  redactPairsInText,
  redactBlobForDisplay,
  redactUrlForDisplay,
  redactHeaderValueForDisplay,
} from '../../src/redaction.js';

describe('redaction defaults', () => {
  it('exposes the reference default sensitive sets', () => {
    expect([...DEFAULT_SENSITIVE_LOG_HEADERS].sort()).toEqual(
      ['authorization', 'cookie', 'proxy-authorization', 'x-api-key'],
    );
    expect([...DEFAULT_SENSITIVE_LOG_FIELDS].sort()).toEqual([
      'access_token', 'api_key', 'apikey', 'client_secret', 'password',
      'refresh_token', 'secret', 'signature', 'token',
    ].sort());
  });

  it('merges extra names case-insensitively without dropping defaults', () => {
    const merged = mergeSensitiveNames(DEFAULT_SENSITIVE_LOG_FIELDS, ['SSN', 'Card-Number']);
    expect(merged.has('ssn')).toBe(true);
    expect(merged.has('card-number')).toBe(true);
    expect(merged.has('password')).toBe(true);
  });
});

describe('redactPairsInText', () => {
  it('masks bare key=value pairs for sensitive names', () => {
    expect(redactPairsInText('token=abc123 user=bob', new Set(['token'])))
      .toBe('token=[REDACTED] user=bob');
  });

  it('masks key: value pairs and quoted names case-insensitively', () => {
    const sensitive = new Set(['password']);
    expect(redactPairsInText('Password: hunter2', sensitive)).toBe('Password: [REDACTED]');
    expect(redactPairsInText('"password":"hunter2"', sensitive)).toBe('"password":[REDACTED]');
  });

  it('percent-decodes names once before matching', () => {
    expect(redactPairsInText('access%5Ftoken=xyz', new Set(['access_token'])))
      .toBe('access%5Ftoken=[REDACTED]');
  });

  it('leaves non-sensitive pairs alone', () => {
    expect(redactPairsInText('user=bob', new Set(['token']))).toBe('user=bob');
  });
});

describe('redactBlobForDisplay', () => {
  it('masks sensitive JSON keys at any depth', () => {
    const out = redactBlobForDisplay(
      '{"user":{"nested":{"api_key":"k"}},"name":"bob"}', [], [], [],
    );
    expect(JSON.parse(out)).toEqual({ user: { nested: { api_key: '[REDACTED]' } }, name: 'bob' });
  });

  it('merges configured names over the defaults', () => {
    const out = redactBlobForDisplay('{"ssn":"123"}', [], ['ssn'], []);
    expect(JSON.parse(out)).toEqual({ ssn: '[REDACTED]' });
  });

  it('falls back to pair scanning for non-JSON text', () => {
    expect(redactBlobForDisplay('password=hunter2', [], [], []))
      .toBe('password=[REDACTED]');
  });

  it('masks default sensitive fields without any config', () => {
    const out = redactBlobForDisplay('{"token":"t","keep":"k"}', [], [], []);
    expect(JSON.parse(out)).toEqual({ token: '[REDACTED]', keep: 'k' });
  });

  it('returns non-object JSON and plain text unchanged', () => {
    expect(redactBlobForDisplay('"just a string"', [], [], [])).toBe('"just a string"');
    expect(redactBlobForDisplay('nothing here', [], [], [])).toBe('nothing here');
  });
});

describe('redactUrlForDisplay', () => {
  it('masks sensitive query parameter values, defaults and configured', () => {
    const out = redactUrlForDisplay(
      '/api/data?token=abc&q=ok', [], [], [],
    );
    expect(out).toBe('/api/data?token=[REDACTED]&q=ok');
    const out2 = redactUrlForDisplay(
      '/api/data?ssn=123&q=ok', ['ssn'], [], [],
    );
    expect(out2).toBe('/api/data?ssn=[REDACTED]&q=ok');
  });

  it('masks netloc passwords', () => {
    expect(redactUrlForDisplay('https://user:secretpw@host/path', [], [], []))
      .toBe('https://user:[REDACTED]@host/path');
  });

  it('masks fragment pairs and leaves plain URLs unchanged', () => {
    expect(redactUrlForDisplay('/a#token=x', [], [], [])).toBe('/a#token=[REDACTED]');
    expect(redactUrlForDisplay('/plain/path', [], [], [])).toBe('/plain/path');
  });
});

describe('redactHeaderValueForDisplay', () => {
  it('applies blob redaction to header-like error text', () => {
    expect(redactHeaderValueForDisplay('api_key=abcd sent', [], [], []))
      .toBe('api_key=[REDACTED] sent');
  });

  it('passes through empty values', () => {
    expect(redactHeaderValueForDisplay('', [], [], [])).toBe('');
  });
});
