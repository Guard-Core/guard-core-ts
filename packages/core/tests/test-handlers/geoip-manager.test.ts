import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Controllable maxmind open: the default rejects (garbage bytes), tests
   flip the switch to hand back a fake reader. */
const maxmindState = vi.hoisted(() => ({
  succeed: false,
  reader: null as unknown,
}));

vi.mock('maxmind', () => ({
  open: async () => {
    if (!maxmindState.succeed) {
      throw new Error('invalid database metadata');
    }
    return maxmindState.reader;
  },
}));
import { mkdtempSync, writeFileSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IPInfoManager } from '../../src/handlers/geoip.js';
import { SecurityConfigSchema } from '../../src/models/config.js';
import { defaultLogger } from '../../src/models/logger.js';
import type { RedisHandlerProtocol } from '../../src/protocols/redis.js';

function makeManager(options: Parameters<typeof IPInfoManager.prototype.getStatus> extends never ? never : ConstructorParameters<typeof IPInfoManager>[1] = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'geoip-test-'));
  const dbPath = join(dir, 'country_asn.mmdb');
  return { manager: new IPInfoManager(defaultLogger, { ...options, dbPath }), dbPath, dir };
}

function fakeRedis(cached: string | null = null): RedisHandlerProtocol & { setKeySpy: ReturnType<typeof vi.fn> } {
  const setKeySpy = vi.fn(async () => true);
  return {
    getKey: vi.fn(async () => cached),
    setKey: setKeySpy,
    incr: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    keys: vi.fn(),
    deletePattern: vi.fn(),
    setKeySpy,
  } as never;
}

const REAL_MMDB = Buffer.from('real-mmdb-bytes');

describe('IPInfoManager lifecycle (reference ipinfo_handler.py)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('carries the config surface with the reference defaults', () => {
    const config = SecurityConfigSchema.parse({});
    expect(config.ipinfoToken).toBeNull();
    expect(config.ipinfoDbPath).toBe('data/ipinfo/country_asn.mmdb');
    expect(config.geoIpDbMaxAge).toBe(86400);
  });

  it('answers a fresh status before any initialization', () => {
    const { manager, dir } = makeManager();
    expect(manager.getStatus()).toEqual({ ready: false, lastRefreshed: null, entries: 0 });
    expect(manager.isInitialized).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws the token-required error on download without a token and emits geo_lookup_failed', async () => {
    const { manager, dir } = makeManager();
    const events: Array<Record<string, unknown>> = [];
    manager.initializeAgent({
      sendEvent: async (event: unknown) => { events.push(event as Record<string, unknown>); },
    } as never);
    await manager.initialize();
    expect(existsSync(join(dir, 'country_asn.mmdb'))).toBe(false);
    expect(events[0]).toMatchObject({
      eventType: 'geo_lookup_failed',
      ipAddress: 'system',
      actionTaken: 'database_download_failed',
      reason: 'Failed to download IPInfo database: Error',
    });
    // The getCountry warning flips to the post-init wording.
    expect(manager.getCountry('1.2.3.4')).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('downloads with retries and backoff, writes atomically and caches in Redis', async () => {
    vi.useFakeTimers();
    const { manager, dbPath, dir } = makeManager({ token: 'tok', maxAge: 3600 });
    const redis = fakeRedis();
    // Hold the handler without running initialize (the explicit initialize
    // below drives the download path).
    manager['redisHandler'] = redis;
    // Fail twice, succeed on the third attempt.
    let calls = 0;
    fetchSpy.mockImplementation(async () => {
      calls++;
      if (calls <= 2) return { ok: false, status: 500 };
      return { ok: true, arrayBuffer: async () => REAL_MMDB.buffer.slice(REAL_MMDB.byteOffset, REAL_MMDB.byteOffset + REAL_MMDB.byteLength) };
    });

    const init = manager.initialize();
    while (calls < 3) {
      await vi.advanceTimersByTimeAsync(1100);
    }
    await init;

    expect(calls).toBe(3);
    // The snapshot landed in Redis with the max-age TTL.
    expect(redis.setKeySpy).toHaveBeenCalledWith('ipinfo', 'database', expect.any(String), 3600);
    // The downloaded bytes are not a valid MMDB, so the reader open fails
    // and the corrupted file is removed (the reference
    // _open_database_or_none).
    expect(manager.isInitialized).toBe(false);
    expect(existsSync(dbPath)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('short-circuits the download from the Redis snapshot', async () => {
    const { manager, dbPath, dir } = makeManager({ token: 'tok' });
    // The snapshot bytes are not a valid MMDB: the open fails and the file
    // is removed, proving the cache arm ran instead of the download.
    const redis = fakeRedis('cached-latin1-bytes');
    await manager.initializeRedis(redis);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(dbPath)).toBe(false);
    expect(manager.isInitialized).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('treats a file older than max age as outdated', async () => {
    const { manager, dbPath, dir } = makeManager({ token: 'tok', maxAge: 1 });
    writeFileSync(dbPath, 'stale');
    // Backdate the mtime past the 1-second max age.
    utimesSync(dbPath, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    fetchSpy.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => REAL_MMDB.buffer.slice(REAL_MMDB.byteOffset, REAL_MMDB.byteOffset + REAL_MMDB.byteLength),
    });
    await manager.initialize();
    // The stale file triggers the download arm; the downloaded bytes are not
    // a valid MMDB, so the corrupted-file cleanup removes it again.
    expect(fetchSpy).toHaveBeenCalled();
    expect(manager.isInitialized).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('refresh keeps the current reader on download failure and logs the error', async () => {
    const { manager, dir } = makeManager({ token: 'tok' });
    fetchSpy.mockRejectedValue(new Error('network down'));
    await manager.refresh();
    expect(manager.isInitialized).toBe(false);
    expect(manager.getStatus().lastRefreshed).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('initializes from the Redis snapshot when the reader opens cleanly', async () => {
    maxmindState.succeed = true;
    maxmindState.reader = {
      get: () => ({ country: { iso_code: 'DE' } }),
      close: vi.fn(),
      metadata: { node_count: 42 },
    };
    try {
      const { manager, dir } = makeManager({ token: 'tok' });
      const redis = fakeRedis('snapshot-bytes');
      await manager.initializeRedis(redis);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(manager.isInitialized).toBe(true);
      expect(manager.entryCount).toBe(42);
      expect(manager.getStatus().ready).toBe(true);
      expect(manager.getStatus().lastRefreshed).not.toBeNull();
      expect(manager.getCountry('1.2.3.4')).toBe('DE');
      manager.close();
      expect(manager.isInitialized).toBe(false);
    } finally {
      maxmindState.succeed = false;
    }
  });

  it('refresh swaps in the reopened reader on a successful download', async () => {
    const closeSpy = vi.fn();
    try {
      const { manager, dbPath, dir } = makeManager({ token: 'tok' });
      writeFileSync(dbPath, 'stale');
      manager['reader'] = { get: () => null, close: closeSpy, metadata: { node_count: 1 } } as never;
      maxmindState.succeed = true;
      maxmindState.reader = {
        get: () => ({ country: { iso_code: 'FR' } }),
        close: vi.fn(),
        metadata: { node_count: 99 },
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => REAL_MMDB.buffer.slice(REAL_MMDB.byteOffset, REAL_MMDB.byteOffset + REAL_MMDB.byteLength),
      });

      await manager.refresh();

      expect(closeSpy).toHaveBeenCalled();
      expect(manager.entryCount).toBe(99);
      expect(manager.getStatus().lastRefreshed).not.toBeNull();
      rmSync(dir, { recursive: true, force: true });
    } finally {
      maxmindState.succeed = false;
    }
  });

  it('warns and continues when the Redis snapshot write fails', async () => {
    try {
      const { manager, dir } = makeManager({ token: 'tok' });
      const redis = fakeRedis(null);
      redis.setKeySpy.mockRejectedValue(new Error('redis down'));
      manager['redisHandler'] = redis;
      fetchSpy.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => REAL_MMDB.buffer.slice(REAL_MMDB.byteOffset, REAL_MMDB.byteOffset + REAL_MMDB.byteLength),
      });

      await manager.initialize();

      expect(fetchSpy).toHaveBeenCalled();
      expect(manager.isInitialized).toBe(false);
      rmSync(dir, { recursive: true, force: true });
    } finally {
      maxmindState.succeed = false;
    }
  });

  it('refresh keeps the current reader when the reopened database fails to open', async () => {
    const closeSpy = vi.fn();
    const { manager, dbPath, dir } = makeManager({ token: 'tok' });
    manager['reader'] = { get: () => null, close: closeSpy, metadata: { node_count: 1 } } as never;
    // maxmindState.succeed stays false: the reopen fails like a corrupted
    // download, so the current reader stays in place (reference refresh).
    fetchSpy.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => REAL_MMDB.buffer.slice(REAL_MMDB.byteOffset, REAL_MMDB.byteOffset + REAL_MMDB.byteLength),
    });

    await manager.refresh();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(manager.entryCount).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('close releases the reader and getStatus flips to not ready', async () => {
    const { manager, dir } = makeManager();
    manager['reader'] = { get: () => null, close: vi.fn(), metadata: { node_count: 42 } } as never;
    expect(manager.isInitialized).toBe(true);
    expect(manager.entryCount).toBe(42);
    expect(manager.getStatus()).toMatchObject({ ready: true, entries: 42 });
    manager.close();
    expect(manager.isInitialized).toBe(false);
    expect(manager.getStatus().entries).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
