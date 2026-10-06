/* Bounded body reader, the TS port of guard_core/_utils/body_reader.py.

   Reads for detection are capped by detectionMaxBodyInspectBytes, bounded by
   bodyReadTimeout, and limited by bodyReadMaxConcurrent in-flight reads.
   Outcomes mirror the reference: a read that times out, exceeds the
   concurrency budget, raises, or returns a non-Uint8Array value treats the
   body as unavailable (fail-closed, detection simply skips the body).

   Adapters that can read a byte cap natively implement the optional
   GuardRequest.readBodyPrefix(maxBytes); when absent the reader falls back to
   request.body() (which may over-fetch - the framework parser owns that
   memory, mirroring the reference's unbounded-reader warning path). */

import type { Logger } from '../models/logger.js';
import type { GuardRequest } from '../protocols/request.js';
import type { ResolvedSecurityConfig } from '../models/config.js';

const CONTENT_LENGTH_RE = /^\d+$/;

const DEFAULT_BODY_READ_TIMEOUT = 3.0;
const DEFAULT_BODY_READ_MAX_CONCURRENT = 64;
const MAX_STRADDLE_OVERLAP_BYTES = 256;

export function parseContentLength(value: string): number | null {
  const stripped = value.trim();
  if (!CONTENT_LENGTH_RE.test(stripped)) return null;
  const parsed = Number.parseInt(stripped, 10);
  return parsed > 0 ? parsed : null;
}

/* Process-wide in-flight budget for bounded reads. Reads beyond the budget
   queue until a slot frees, then give up when their own deadline has passed
   (the reference's sync-tree daemon-thread budget, applied in-process). */
const acquire: Array<() => void> = [];
let inFlight = 0;
let maxConcurrentLimit = DEFAULT_BODY_READ_MAX_CONCURRENT;

/** Update the process-wide in-flight read budget. Called from readCappedBody
 *  with the resolved config's bodyReadMaxConcurrent: the last config seen
 *  wins, which is deterministic for the single-config-per-process case the
 *  family ships. */
export function setBodyReadConcurrencyLimit(limit: number): void {
  maxConcurrentLimit = limit;
}

/** Test-only: reset the budget to the default and release queued waiters. */
export function resetBodyReadConcurrency(): void {
  maxConcurrentLimit = DEFAULT_BODY_READ_MAX_CONCURRENT;
  inFlight = 0;
  for (const release of acquire.splice(0)) release();
}

function acquireSlot(): Promise<void> {
  if (inFlight < maxConcurrentLimit) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => acquire.push(() => {
    inFlight++;
    resolve();
  }));
}

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = acquire.shift();
  if (next) next();
}

/* Runs a read under the concurrency budget and the timeout. The timer starts
   when the slot is granted: a queued read that waits past its deadline gives
   up without ever calling the reader. */
async function safeRead(
  read: () => Promise<Uint8Array> | Uint8Array,
  timeoutSeconds: number,
  logger: Logger,
): Promise<Uint8Array | null> {
  await acquireSlot();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutSeconds * 1000);
    });
    let bytes: Uint8Array | null = null;
    try {
      bytes = await Promise.race([Promise.resolve(read()), deadline]);
    } catch {
      return null;
    }
    if (bytes === null) return null;
    if (!(bytes instanceof Uint8Array)) {
      logger.warn(
        `the request body reader returned ${Object.prototype.toString.call(bytes)}, `
        + 'not bytes; treating the body as unavailable for detection',
      );
      return null;
    }
    return bytes;
  } finally {
    /* clearTimeout tolerates undefined, which is the state on the queued
       give-up path (the deadline for a never-granted slot). */
    clearTimeout(timer);
    releaseSlot();
  }
}

/* Longest compiled detection pattern, capped: a capped prefix read may cut a
   pattern occurrence at the boundary, so the reference over-reads by the
   longest pattern length (<= 256) to keep boundary-spanning matches
   decidable. Returns 0 when the caller cannot supply patterns. */
export async function straddleOverlapBytes(
  longestPatternLength: number | null | undefined,
): Promise<number> {
  if (longestPatternLength === null || longestPatternLength === undefined) return 0;
  if (longestPatternLength <= 0) return 0;
  return Math.min(longestPatternLength, MAX_STRADDLE_OVERLAP_BYTES);
}

interface BodyPrefixCache {
  request: GuardRequest;
  maxBytes: number;
  bytes: Uint8Array;
}

const BODY_PREFIX_CACHE_KEY = '_guardCappedBodyPrefixCache';

/* Per-request cache: consumers that ask for different caps share one read
   (the reference's _guard_capped_body_prefix_cache state attr). */
function cachedPrefix(request: GuardRequest, maxBytes: number): Uint8Array | null {
  const cached = (request.state as Record<string, unknown>)[BODY_PREFIX_CACHE_KEY] as BodyPrefixCache | undefined;
  if (cached && cached.request === request && cached.maxBytes >= maxBytes) {
    return cached.bytes.slice(0, maxBytes);
  }
  return null;
}

function storePrefix(request: GuardRequest, maxBytes: number, bytes: Uint8Array): void {
  (request.state as Record<string, unknown>)[BODY_PREFIX_CACHE_KEY] = {
    request, maxBytes, bytes,
  } satisfies BodyPrefixCache;
}

async function readAndCacheBody(
  request: GuardRequest,
  maxBytes: number,
  timeoutSeconds: number,
  read: () => Promise<Uint8Array> | Uint8Array,
  logger: Logger,
): Promise<Uint8Array | null> {
  const cached = cachedPrefix(request, maxBytes);
  if (cached !== null) return cached;

  const prefix = await safeRead(read, timeoutSeconds, logger);
  if (prefix === null) return null;
  const capped = prefix.slice(0, maxBytes);
  storePrefix(request, maxBytes, capped);
  return capped;
}

function warnBodyInspectBytesCapReached(logger: Logger, maxBytes: number, clientIp: string): void {
  logger.warn(
    `detectionMaxBodyInspectBytes (${maxBytes}) reached for client ${clientIp}; only the `
    + `first ${maxBytes} bytes of the request body are scanned`,
  );
}

function warnNoBoundedReader(logger: Logger, maxBytes: number, clientIp: string): void {
  logger.warn(
    `detectionMaxBodyInspectBytes (${maxBytes}) reached for client ${clientIp}; the `
    + 'request body is not read because the adapter does not implement a '
    + 'bounded reader (readBodyPrefix)',
  );
}

export interface BoundedBodyReaderDeps {
  config?: ResolvedSecurityConfig;
  logger: Logger;
  /** Longest compiled detection pattern length (for the prefix over-read);
   *  null when unavailable, which disables the over-read. */
  longestPatternLength?: number | null;
}

/** Read the request body under the detection caps. Returns null when the
 *  body is unavailable (timeout, budget exhaustion, read error, or an
 *  oversized body without a bounded reader on the request). */
export async function readCappedBody(
  request: GuardRequest,
  deps: BoundedBodyReaderDeps,
  clientIp = '',
): Promise<Uint8Array | null> {
  const { config, logger } = deps;
  if (config !== undefined && config.bodyReadMaxConcurrent > 0) {
    setBodyReadConcurrencyLimit(config.bodyReadMaxConcurrent);
  }
  const maxBytes = config?.detectionMaxBodyInspectBytes ?? 262144;
  const timeoutSeconds = config?.bodyReadTimeout ?? DEFAULT_BODY_READ_TIMEOUT;

  const contentLength = request.headers['content-length'];
  if (contentLength !== undefined && contentLength !== null) {
    const parsed = parseContentLength(contentLength);
    if (parsed !== null) {
      if (parsed > maxBytes) {
        return readOversizedDeclaredBody(request, deps, maxBytes, timeoutSeconds, clientIp);
      }
      return readAndCacheBody(
        request, maxBytes, timeoutSeconds,
        () => request.body(), logger,
      );
    }
  }

  /* No (usable) declared size: a bounded reader caps the fetch itself;
     otherwise the framework parser owns the read and the cap only trims. */
  const hasBoundedReader = typeof (request as Partial<GuardRequest>).readBodyPrefix === 'function';
  if (!hasBoundedReader) {
    return readAndCacheBody(
      request, maxBytes, timeoutSeconds,
      () => request.body(), logger,
    );
  }

  const overlap = await straddleOverlapBytes(deps.longestPatternLength);
  const fetchBytes = maxBytes + overlap;
  return readAndCacheBody(
    request, fetchBytes, timeoutSeconds,
    () => (request as GuardRequest & { readBodyPrefix(maxBytes: number): Promise<Uint8Array> }).readBodyPrefix(fetchBytes),
    logger,
  );
}

async function readOversizedDeclaredBody(
  request: GuardRequest,
  deps: BoundedBodyReaderDeps,
  maxBytes: number,
  timeoutSeconds: number,
  clientIp: string,
): Promise<Uint8Array | null> {
  const { config, logger } = deps;
  const hasBoundedReader = typeof (request as Partial<GuardRequest>).readBodyPrefix === 'function';
  if (!hasBoundedReader) {
    warnNoBoundedReader(logger, maxBytes, clientIp);
    return null;
  }

  warnBodyInspectBytesCapReached(logger, maxBytes, clientIp);
  const overlap = await straddleOverlapBytes(deps.longestPatternLength);
  const fetchBytes = maxBytes + overlap;
  return readAndCacheBody(
    request, fetchBytes, timeoutSeconds,
    () => (request as GuardRequest & { readBodyPrefix(maxBytes: number): Promise<Uint8Array> }).readBodyPrefix(fetchBytes),
    logger,
  );
}
