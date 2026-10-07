import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { GeoIPHandler } from '../protocols/geo-ip.js';
import type { RedisHandlerProtocol } from '../protocols/redis.js';

export class IPInfoManager implements GeoIPHandler {
  private reader: unknown = null;
  private _isInitialized = false;
  private agentHandler: AgentHandlerProtocol | null = null;

  constructor(private readonly logger: Logger) {}

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    try {
      const maxmind = await import('maxmind');
      /* v8 ignore start -- successful maxmind.open() requires actual .mmdb database file on disk */
      this.reader = await maxmind.open('data/ipinfo/country_asn.mmdb');
      this._isInitialized = true;
      this.logger.info('GeoIP database initialized');
      /* v8 ignore stop */
    } catch (e) {
      this.logger.warn(`GeoIP initialization failed: ${e}`);

      /* Reference EVENT_GEO_LOOKUP_FAILED on the database download failure
         (ipinfo_handler.py initialize + _describe_download_error). */
      await this.sendGeoEvent(
        'geo_lookup_failed', 'system', 'database_download_failed',
        `Failed to download IPInfo database: ${e instanceof Error ? e.constructor.name : 'Error'}`,
      );
    }
  }

  async initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void> {
    // Cache DB in Redis for shared access
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  getCountry(ip: string): string | null {
    if (!this.reader) return null;
    try {
      const result = (this.reader as { get(ip: string): { country?: { iso_code?: string } } | null }).get(ip);
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
        handlerName: 'ipinfo',
        metadata,
      });
    } catch {
      /* never throw from event dispatch */
    }
  }
}
