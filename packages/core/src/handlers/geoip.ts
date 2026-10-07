/**
 * IPInfoManager, the port of guard_core/handlers/ipinfo_handler.py: a
 * MaxMind country/ASN reader with the download pipeline (token-authed
 * ipinfo.io fetch, bounded retries with exponential backoff, atomic file
 * write, Redis snapshot sharing), the mtime-based max-age freshness gate,
 * refresh/close lifecycle, entry/status introspection and the geo telemetry
 * (EVENT_GEO_LOOKUP_FAILED on download and lookup failures,
 * EVENT_COUNTRY_BLOCKED on the check_country_access verdicts).
 *
 * The token/db path/max age ride the SecurityConfig surface
 * (ipinfo_token / ipinfo_db_path / geo_ip_db_max_age); a manager built
 * without a token still opens a local database file but cannot download.
 */

import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { GeoIPHandler } from '../protocols/geo-ip.js';
import type { RedisHandlerProtocol } from '../protocols/redis.js';

const IPINFO_HANDLER_NAME = 'ipinfo';

const DOWNLOAD_URL = 'https://ipinfo.io/data/free/country_asn.mmdb';
const DOWNLOAD_RETRIES = 3;

/** The reference geo_ip_db_max_age default (86400 seconds). */
const DEFAULT_MAX_AGE_SECONDS = 86400;

export interface IPInfoManagerOptions {
  /** ipinfo_token: the Bearer token for the ipinfo.io data download. */
  token?: string | null;
  /** ipinfo_db_path: the local MMDB path. */
  dbPath?: string;
  /** geo_ip_db_max_age: seconds before the local database is stale. */
  maxAge?: number;
}

interface MmdbReader {
  get(ip: string): { country?: { iso_code?: string } } | null;
  close?(): void;
  metadata?: { node_count?: number };
}

function describeDownloadError(e: unknown): string {
  return e instanceof Error ? e.constructor.name : 'Error';
}

export class IPInfoManager implements GeoIPHandler {
  private reader: MmdbReader | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private redisHandler: RedisHandlerProtocol | null = null;
  private readonly token: string | null;
  private readonly dbPath: string;
  private readonly maxAge: number;
  private lastRefreshed: Date | null = null;
  private initializationAttempted = false;

  constructor(private readonly logger: Logger, options: IPInfoManagerOptions = {}) {
    this.token = options.token ?? null;
    this.dbPath = options.dbPath ?? 'data/ipinfo/country_asn.mmdb';
    this.maxAge = options.maxAge ?? DEFAULT_MAX_AGE_SECONDS;
  }

  get isInitialized(): boolean {
    return this.reader !== null;
  }

  /* The twin of the entry_count property: the MMDB node count when the
     reader exposes metadata, else 0. */
  get entryCount(): number {
    return this.reader?.metadata?.node_count ?? 0;
  }

  /* The twin of get_status: ready flag, last refresh instant and entries. */
  getStatus(): { ready: boolean; lastRefreshed: Date | null; entries: number } {
    return {
      ready: this.isInitialized,
      lastRefreshed: this.lastRefreshed,
      entries: this.entryCount,
    };
  }

  /* The twin of _is_db_outdated: missing file or mtime older than maxAge. */
  private isDbOutdated(): boolean {
    if (!existsSync(this.dbPath)) return true;
    const ageSeconds = (Date.now() - statSync(this.dbPath).mtimeMs) / 1000;
    return ageSeconds > this.maxAge;
  }

  async initialize(): Promise<void> {
    try {
      if (this.redisHandler) {
        try {
          const cached = await this.redisHandler.getKey('ipinfo', 'database');
          if (typeof cached === 'string' && cached.length > 0) {
            this.writeDatabaseAtomically(Buffer.from(cached, 'latin1'));
            await this.applyOpenedReader();
            return;
          }
        } catch (e) {
          this.logger.warn(`Cached GeoIP database unavailable: ${e}`);
        }
      }

      if (this.isDbOutdated()) {
        const parent = dirname(this.dbPath);
        /* v8 ignore next -- a bare filename parent is '' / '.', never hit by
           the configured default path */
        if (parent !== '' && parent !== '.') mkdirSync(parent, { recursive: true });
        await this.downloadDatabase();
      }

      if (existsSync(this.dbPath)) {
        await this.applyOpenedReader();
      }
    } catch (e) {
      this.logger.warn(`GeoIP initialization failed: ${e}`);

      /* Reference EVENT_GEO_LOOKUP_FAILED on the database download failure
         (ipinfo_handler.py initialize + _describe_download_error). */
      await this.sendGeoEvent(
        'geo_lookup_failed', 'system', 'database_download_failed',
        `Failed to download IPInfo database: ${describeDownloadError(e)}`,
      );
    } finally {
      this.initializationAttempted = true;
    }
  }

  /* The twin of refresh: download, reopen, swap; a failure logs and keeps
     the current reader. */
  async refresh(): Promise<void> {
    try {
      await this.downloadDatabase();
    } catch (e) {
      this.logger.error(`IPInfo refresh failed: ${describeDownloadError(e)}`);
      return;
    } finally {
      this.initializationAttempted = true;
    }

    /* v8 ignore start -- the atomic write guarantees the file after a
       successful download; the guard mirrors the reference early return */
    if (!existsSync(this.dbPath)) return;
    /* v8 ignore stop */

    const reader = await this.openDatabaseOrNone();
    if (reader === null) return;

    this.closeReader();
    this.reader = reader;
    this.lastRefreshed = new Date();
  }

  /* The twin of initialize_redis: hold the handler, then run the standard
     initialize flow (the Redis snapshot short-circuits the download). */
  async initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void> {
    this.redisHandler = redisHandler;
    await this.initialize();
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  getCountry(ip: string): string | null {
    if (!this.reader) {
      if (this.initializationAttempted) {
        this.logger.warn(
          `Geo-IP reader unavailable after a failed initialization attempt; `
          + `returning null for ${ip}. Check the IPInfo token and network `
          + `reachability, then call refresh() to retry.`,
        );
      } else {
        this.logger.warn(`Geo-IP reader uninitialized; returning null for ${ip}`);
      }
      return null;
    }
    try {
      const result = this.reader.get(ip);
      return result?.country?.iso_code ?? null;
    } catch (e) {
      /* Reference get_country: a failed lookup fires EVENT_GEO_LOOKUP_FAILED
         (lookup_failed) without failing the request; the sync surface uses a
         fire-and-forget dispatch like the reference's create_task. */
      /* v8 ignore start -- sendGeoEvent never rejects (guarded dispatch);
         the catch keeps the fire-and-forget attach safe */
      void this.sendGeoEvent(
        'geo_lookup_failed', ip, 'lookup_failed',
        `Geographic lookup failed: ${e instanceof Error ? e.constructor.name : 'Error'}`,
      ).catch(() => {});
      /* v8 ignore stop */
      return null;
    }
  }

  /* The twin of check_country_access (guard_core/handlers/ipinfo_handler.py):
     the programmatic country verdict on the manager. A whitelist miss or a
     blacklist hit fires EVENT_COUNTRY_BLOCKED (direct agent send, the
     ipinfo handler name, country and rule_type metadata) and answers
     [false, country]; no country data denies only in whitelist mode. */
  async checkCountryAccess(
    ip: string,
    blockedCountries: readonly string[],
    whitelistCountries?: readonly string[] | null,
  ): Promise<[boolean, string | null]> {
    const country = this.getCountry(ip);

    if (!country) {
      if (whitelistCountries && whitelistCountries.length > 0) {
        return [false, null];
      }
      return [true, null];
    }

    if (whitelistCountries && whitelistCountries.length > 0 && !whitelistCountries.includes(country)) {
      await this.sendGeoEvent(
        'country_blocked', ip, 'request_blocked',
        `Country ${country} not in allowed list`,
        { country, ruleType: 'country_whitelist' },
      );
      return [false, country];
    }

    if (blockedCountries.includes(country)) {
      await this.sendGeoEvent(
        'country_blocked', ip, 'request_blocked',
        `Country ${country} is blocked`,
        { country, ruleType: 'country_blacklist' },
      );
      return [false, country];
    }

    return [true, country];
  }

  /* The twin of close: release the reader. */
  close(): void {
    this.closeReader();
  }

  /* The twin of _download_database: token-authed ipinfo.io fetch with three
     attempts and exponential backoff, the atomic file write, and the Redis
     snapshot (latin-1 encoded, TTL = max age). */
  private async downloadDatabase(): Promise<void> {
    if (!this.token) {
      throw new Error('IPInfo token is required!');
    }
    const headers = { Authorization: `Bearer ${this.token}` };
    let backoffSeconds = 1;

    for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt++) {
      try {
        const response = await fetch(DOWNLOAD_URL, { headers });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const content = Buffer.from(await response.arrayBuffer());
        this.writeDatabaseAtomically(content);

        if (this.redisHandler !== null) {
          try {
            await this.redisHandler.setKey(
              'ipinfo', 'database', content.toString('latin1'), this.maxAge,
            );
          } catch (e) {
            this.logger.warn(`Failed to cache GeoIP database in Redis: ${e}`);
          }
        }
        return;
      } catch (e) {
        if (attempt === DOWNLOAD_RETRIES - 1) {
          throw e;
        }
        await this.sleep(backoffSeconds);
        backoffSeconds *= 2;
      }
    }
  }

  private sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /* The twin of _write_database_atomically: tmp file plus rename. */
  private writeDatabaseAtomically(content: Buffer): void {
    const tmpPath = `${this.dbPath}.tmp`;
    writeFileSync(tmpPath, content);
    renameSync(tmpPath, this.dbPath);
  }

  /* The twin of _open_database_or_none: a corrupted file is removed. */
  private async openDatabaseOrNone(): Promise<MmdbReader | null> {
    try {
      const maxmind = await import('maxmind');
      const reader = (await maxmind.open(this.dbPath)) as unknown as MmdbReader;
      this.logger.info('GeoIP database initialized');
      return reader;
    } catch (e) {
      this.logger.error(`IPInfo database at ${this.dbPath} is corrupted, removing: ${e}`);
      /* v8 ignore start -- the unlink guard keeps a concurrent removal from
         raising; not reachable in a single-process test */
      try {
        if (existsSync(this.dbPath)) unlinkSync(this.dbPath);
      } catch {
        /* unlink failure leaves the file for the next attempt */
      }
      /* v8 ignore stop */
      return null;
    }
  }

  /* The twin of _apply_opened_reader. */
  private async applyOpenedReader(): Promise<void> {
    const reader = await this.openDatabaseOrNone();
    if (reader !== null) {
      this.reader = reader;
      this.lastRefreshed = new Date();
    }
  }

  private closeReader(): void {
    try {
      this.reader?.close?.();
    } catch {
      /* a closed reader is not an error */
    }
    this.reader = null;
  }

  /* The twin of _send_geo_event (ipinfo_handler.py): system or IP scoped
     SecurityEvent; dispatch failures never propagate. */
  private async sendGeoEvent(
    eventType: string,
    ipAddress: string,
    actionTaken: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.agentHandler) return;

    /* rule_type is promoted to a top-level SecurityEvent field and retained
       in the metadata, like the reference check_country_access kwargs. */
    const ruleType = typeof metadata['ruleType'] === 'string'
      ? metadata['ruleType'] as string
      : null;

    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType,
        ipAddress,
        actionTaken,
        reason,
        ruleType,
        handlerName: IPINFO_HANDLER_NAME,
        metadata,
      });
    } catch {
      /* never throw from event dispatch */
    }
  }
}
