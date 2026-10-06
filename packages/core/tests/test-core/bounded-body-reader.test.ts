import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseContentLength,
  readCappedBody,
  resetBodyReadConcurrency,
  setBodyReadConcurrencyLimit,
  straddleOverlapBytes,
} from '../../src/core/bounded-body-reader.js';
import { createTestConfig, createMockRequest } from '../helpers.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { GuardRequest } from '../../src/index.js';

const encoder = new TextEncoder();

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

describe('parseContentLength', () => {
  it('parses a positive integer', () => {
    expect(parseContentLength('128')).toBe(128);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseContentLength(' 64 ')).toBe(64);
  });

  it('rejects zero, negatives, non-numeric and signed values', () => {
    expect(parseContentLength('0')).toBeNull();
    expect(parseContentLength('-5')).toBeNull();
    expect(parseContentLength('+5')).toBeNull();
    expect(parseContentLength('12ab')).toBeNull();
    expect(parseContentLength('')).toBeNull();
  });
});

describe('straddleOverlapBytes', () => {
  it('caps the over-read at 256 bytes', async () => {
    expect(await straddleOverlapBytes(100)).toBe(100);
    expect(await straddleOverlapBytes(1000)).toBe(256);
  });

  it('returns 0 without pattern information', async () => {
    expect(await straddleOverlapBytes(null)).toBe(0);
    expect(await straddleOverlapBytes(undefined)).toBe(0);
    expect(await straddleOverlapBytes(0)).toBe(0);
  });
});

describe('readCappedBody', () => {
  beforeEach(() => {
    resetBodyReadConcurrency();
  });

  it('reads the body through request.body when content-length is within the cap', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const request = createMockRequest({
      headers: { 'content-length': '5' },
      body: async () => bytes('hello'),
    });
    const result = await readCappedBody(request, { config, logger: defaultLogger }, '1.2.3.4');
    expect(new TextDecoder().decode(result!)).toBe('hello');
  });

  it('trims an over-fetched body to the cap without a bounded reader', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const request = createMockRequest({
      headers: {},
      body: async () => bytes('a'.repeat(2000)),
    });
    const result = await readCappedBody(request, { config, logger: defaultLogger });
    expect(result!.length).toBe(1024);
  });

  it('skips an unusable content-length and reads through the body', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    let bodyReads = 0;
    const request = createMockRequest({
      headers: { 'content-length': 'not-a-number' },
      body: async () => {
        bodyReads++;
        return bytes('hello');
      },
    });
    const result = await readCappedBody(request, { config, logger: defaultLogger });
    expect(bodyReads).toBe(1);
    expect(new TextDecoder().decode(result!)).toBe('hello');
  });

  it('warns and returns null for an oversized declared body without a bounded reader', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    let bodyReads = 0;
    const request = createMockRequest({
      headers: { 'content-length': '2000' },
      body: async () => {
        bodyReads++;
        return bytes('x'.repeat(2000));
      },
    });
    const result = await readCappedBody(request, { config, logger });
    expect(result).toBeNull();
    expect(bodyReads).toBe(0);
    expect(warns.some((w) => w.includes('does not implement a bounded reader'))).toBe(true);
  });

  it('caps an oversized declared body through readBodyPrefix with the straddle over-read', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const fetched: number[] = [];
    const request = createMockRequest({
      headers: { 'content-length': '2000' },
    }) as GuardRequest & { readBodyPrefix(max: number): Promise<Uint8Array> };
    request.readBodyPrefix = async (max: number) => {
      fetched.push(max);
      return bytes('a'.repeat(Math.min(max, 2000)));
    };
    const result = await readCappedBody(
      request,
      { config, logger, longestPatternLength: 20 },
      '9.9.9.9',
    );
    /* The straddle over-read is retained in the result, like the reference:
       cap + overlap keeps boundary-spanning pattern matches decidable. */
    expect(result!.length).toBe(1044);
    /* fetch = cap (1024) + straddle overlap (20) */
    expect(fetched).toEqual([1044]);
    expect(warns.some((w) => w.includes('detectionMaxBodyInspectBytes (1024) reached'))).toBe(true);
  });

  it('uses readBodyPrefix when no content-length is declared', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const request = createMockRequest({ headers: {} }) as GuardRequest & {
      readBodyPrefix(max: number): Promise<Uint8Array>;
    };
    request.readBodyPrefix = async () => bytes('0123456789');
    const result = await readCappedBody(request, { config, logger: defaultLogger });
    expect(new TextDecoder().decode(result!)).toBe('0123456789');
  });

  it('caches the prefix on the request state across consumers', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    let reads = 0;
    const request = createMockRequest({ headers: {} }) as GuardRequest & {
      readBodyPrefix(max: number): Promise<Uint8Array>;
    };
    request.readBodyPrefix = async (max: number) => {
      reads++;
      return bytes('z'.repeat(max));
    };
    await readCappedBody(request, { config, logger: defaultLogger });
    await readCappedBody(request, { config, logger: defaultLogger });
    expect(reads).toBe(1);
  });

  it('returns null when the read times out', async () => {
    vi.useFakeTimers();
    try {
      const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024, bodyReadTimeout: 0.05 });
      const request = createMockRequest({ headers: {} }) as GuardRequest & {
        readBodyPrefix(max: number): Promise<Uint8Array>;
      };
      request.readBodyPrefix = () => new Promise<Uint8Array>(() => { /* never settles */ });
      const pending = readCappedBody(request, { config, logger: defaultLogger });
      const assertion = expect(pending).resolves.toBeNull();
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when the reader raises', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const request = createMockRequest({
      headers: { 'content-length': '10' },
      body: async () => {
        throw new Error('stream gone');
      },
    });
    const result = await readCappedBody(request, { config, logger: defaultLogger });
    expect(result).toBeNull();
  });

  it('returns null when the reader returns a non-Uint8Array value and warns', async () => {
    const config = createTestConfig({ detectionMaxBodyInspectBytes: 1024 });
    const warns: string[] = [];
    const logger = { ...defaultLogger, warn: (m: string) => warns.push(m) };
    const request = createMockRequest({
      headers: { 'content-length': '10' },
      body: async () => 'not bytes' as unknown as Uint8Array,
    });
    const result = await readCappedBody(request, { config, logger });
    expect(result).toBeNull();
    expect(warns.some((w) => w.includes('not bytes; treating the body as unavailable'))).toBe(true);
  });

  it('queues reads beyond the concurrency budget and times them out', async () => {
    setBodyReadConcurrencyLimit(1);
    const request = createMockRequest({ headers: {} }) as GuardRequest & {
      readBodyPrefix(max: number): Promise<Uint8Array>;
    };

    /* The first read holds the only slot until released. */
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const holder = createMockRequest({ headers: {} }) as GuardRequest & {
      readBodyPrefix(max: number): Promise<Uint8Array>;
    };
    holder.readBodyPrefix = async (max: number) => {
      await firstGate;
      return bytes('h'.repeat(max));
    };
    const firstConfig = createTestConfig({ detectionMaxBodyInspectBytes: 1024, bodyReadTimeout: 5, bodyReadMaxConcurrent: 1 });
    const first = readCappedBody(holder, { config: firstConfig, logger: defaultLogger });

    /* The second read queues for the slot (freed at 100ms), then its own
       50ms deadline expires before its slow 300ms read completes. */
    setTimeout(releaseFirst, 100);
    const queuedConfig = createTestConfig({ detectionMaxBodyInspectBytes: 1024, bodyReadTimeout: 0.05, bodyReadMaxConcurrent: 1 });
    request.readBodyPrefix = async (max: number) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return bytes('y'.repeat(max));
    };
    const secondResult = await readCappedBody(request, { config: queuedConfig, logger: defaultLogger });

    expect(secondResult).toBeNull();
    releaseFirst();
    expect((await first)!.length).toBe(1024);
  });
});
