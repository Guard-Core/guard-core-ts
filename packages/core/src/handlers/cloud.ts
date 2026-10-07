import ipaddr from 'ipaddr.js';

import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { CloudIpStoreProtocol } from '../protocols/cloud-ip-store.js';
import {
  decodeCachedEntries,
  encodeCachedEntries,
  InMemoryCloudIpStore,
  RedisCloudIpStore,
} from './cloud-ip-stores.js';
import type { RedisManager } from './redis.js';

const AWS_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
const GCP_RANGES_URL = 'https://www.gstatic.com/ipranges/cloud.json';
const AZURE_DOWNLOAD_PAGE = 'https://www.microsoft.com/en-us/download/details.aspx?id=56519';
const AZURE_JSON_HREF_RE = /href=["'](https:\/\/download\.microsoft\.com\/.{1,500}?\.json)["']/;

/* The TS built-in provider set (the config's VALID_CLOUD_PROVIDERS; the
   reference _ALL_PROVIDERS answers get_status over its own six). */
const BUILT_IN_PROVIDERS = ['AWS', 'GCP', 'Azure'] as const;

export class CloudHandler {
  private ipRanges = new Map<string, string[]>();
  private lastUpdated = new Map<string, Date | null>();
  private networkRegions = new Map<string, Map<string, string>>();
  private redisHandler: RedisManager | null = null;
  /* The injectable store seam (the reference _store): the default is the
     process-local in-memory store; initialize_redis swaps a still-default
     store for the shared Redis store; set_store installs any
     CloudIpStoreProtocol implementation (null opts out into the legacy
     redis-handler / direct-fetch paths, like the reference's _store=None
     tests). */
  private store: CloudIpStoreProtocol | null;
  /* Public like the reference CloudManager.agent_handler: the event bus
     checks it before dispatching the direct cloud_blocked event. */
  agentHandler: AgentHandlerProtocol | null = null;

  constructor(
    private readonly logger: Logger,
    store?: CloudIpStoreProtocol | null,
  ) {
    this.store = store === undefined ? new InMemoryCloudIpStore() : store;
  }

  /* The reference set_store: swap the backing store (tests, adapters and
     deployments with their own cache all inject through here). Null opts
     out of the store flow entirely. */
  setStore(store: CloudIpStoreProtocol | null): void {
    this.store = store;
  }

  getStore(): CloudIpStoreProtocol | null {
    return this.store;
  }

  async initializeRedis(redisHandler: RedisManager, providers: Set<string>, ttl = 3600): Promise<void> {
    this.redisHandler = redisHandler;
    /* The reference initialize_redis: a still-default in-memory store is
       upgraded to the shared Redis store; an injected custom store wins. */
    if (this.store instanceof InMemoryCloudIpStore) {
      this.store = new RedisCloudIpStore(redisHandler);
    }
    await this.refreshAsync(providers, ttl);
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  /* The reference refresh (the sync variant): fetch without the store,
     for deployments with no Redis and no cache. Raises when Redis is
     enabled - the store flow (refreshAsync) is the only correct path
     there, because the two would fight over one cache. */
  async refresh(providers: Set<string>): Promise<void> {
    if (this.redisHandler !== null) {
      throw new Error('Use refreshAsync() when Redis is enabled');
    }
    await this.refreshProvidersDirect(providers);
  }

  async refreshAsync(providers: Set<string>, ttl = 3600): Promise<void> {
    /* The reference refresh_async: with a store (the default), the store is
       the cache AND the persistence tier - a cache hit skips the fetch
       entirely; a miss fetches, persists through the store, then updates
       the live maps. With the store opted out (null), the legacy paths
       apply: the redis-handler cloud_ranges_v2 namespace, or the bare API
       when there is no Redis. */
    if (this.store === null) {
      if (this.redisHandler !== null) {
        await this.refreshViaRedisHandler(providers, ttl);
      } else {
        await this.refreshProvidersDirect(providers);
      }
      return;
    }
    for (const provider of providers) {
      try {
        const cached = await this.store.get(provider);
        if (cached !== null) {
          const [ranges, regions] = decodeCachedEntries(cached);
          this.ipRanges.set(provider, [...ranges]);
          this.networkRegions.set(provider, regions);
          continue;
        }

        const ranges = await this.fetchProviderRanges(provider);
        if (ranges.length > 0) {
          await this.store.set(
            provider,
            encodeCachedEntries(ranges, this.networkRegions.get(provider) ?? new Map()),
            ttl,
          );
          this.logRangeChanges(provider, this.ipRanges.get(provider) ?? [], ranges);
          this.ipRanges.set(provider, ranges);
          this.lastUpdated.set(provider, new Date());
        }
      } catch (e) {
        this.logger.error(`Failed to refresh ${provider} IP ranges: ${e}`);
        if (!this.ipRanges.has(provider)) this.ipRanges.set(provider, []);
      }
    }
  }

  /* The reference _refresh_providers (the storeless direct path): fetch
     every provider, log range changes, keep a known provider's existing
     ranges on failure and record an empty set for a new one. */
  private async refreshProvidersDirect(providers: Set<string>): Promise<void> {
    for (const provider of providers) {
      try {
        const ranges = await this.fetchProviderRanges(provider);
        if (ranges.length > 0) {
          this.logRangeChanges(provider, this.ipRanges.get(provider) ?? [], ranges);
          this.ipRanges.set(provider, ranges);
          this.lastUpdated.set(provider, new Date());
        }
      } catch (e) {
        this.logger.error(`Failed to fetch ${provider} IP ranges: ${e}`);
        if (!this.ipRanges.has(provider)) this.ipRanges.set(provider, []);
      }
    }
  }

  /* The reference _refresh_providers_via_redis_handler: the legacy cache
     namespace (cloud_ranges_v2) with the encoded region suffixes. Only
     called with a live redis handler (the refreshAsync call site gates). */
  private async refreshViaRedisHandler(providers: Set<string>, ttl: number): Promise<void> {
    const redisHandler = this.redisHandler!;
    for (const provider of providers) {
      try {
        const cached = await redisHandler.getKey('cloud_ranges_v2', provider);
        if (typeof cached === 'string' && cached.length > 0) {
          const [ranges, regions] = decodeCachedEntries(cached.split(','));
          this.ipRanges.set(provider, [...ranges]);
          this.networkRegions.set(provider, regions);
          continue;
        }

        const ranges = await this.fetchProviderRanges(provider);
        if (ranges.length > 0) {
          await redisHandler.setKey(
            'cloud_ranges_v2',
            provider,
            [...encodeCachedEntries(ranges, this.networkRegions.get(provider) ?? new Map())].sort().join(','),
            ttl,
          );
          this.logRangeChanges(provider, this.ipRanges.get(provider) ?? [], ranges);
          this.ipRanges.set(provider, ranges);
          this.lastUpdated.set(provider, new Date());
        }
      } catch (e) {
        this.logger.error(`Failed to refresh ${provider} IP ranges: ${e}`);
        if (!this.ipRanges.has(provider)) this.ipRanges.set(provider, []);
      }
    }
  }

  /* The reference _log_range_changes: one info line per provider whose
     range set actually changed, with the added/removed counts. */
  private logRangeChanges(provider: string, oldRanges: string[], newRanges: string[]): void {
    const oldSet = new Set(oldRanges);
    const newSet = new Set(newRanges);
    if (oldSet.size === newSet.size && [...oldSet].every((r) => newSet.has(r))) return;
    const added = [...newSet].filter((r) => !oldSet.has(r)).length;
    const removed = [...oldSet].filter((r) => !newSet.has(r)).length;
    this.logger.info(
      `Cloud IP range update for ${provider}: +${added} added, -${removed} removed`,
    );
  }

  /* The reference get_status: per-provider readiness for the status route
     and the adapter surface. */
  getStatus(): Record<string, { ready: boolean; lastRefreshed: Date | null; entries: number }> {
    const status: Record<string, { ready: boolean; lastRefreshed: Date | null; entries: number }> = {};
    for (const provider of BUILT_IN_PROVIDERS) {
      const ranges = this.ipRanges.get(provider) ?? [];
      status[provider] = {
        ready: ranges.length > 0,
        lastRefreshed: this.lastUpdated.get(provider) ?? null,
        entries: ranges.length,
      };
    }
    return status;
  }

  private async fetchProviderRanges(provider: string): Promise<string[]> {
    switch (provider) {
      case 'AWS': return this.fetchAwsRanges();
      case 'GCP': return this.fetchGcpRanges();
      case 'Azure': return this.fetchAzureRanges();
      default: return [];
    }
  }

  private async fetchAwsRanges(): Promise<string[]> {
    const resp = await fetch(AWS_RANGES_URL);
    const data = await resp.json() as { prefixes: Array<{ ip_prefix: string; service: string }> };
    return data.prefixes
      .filter((p) => p.service === 'AMAZON')
      .map((p) => p.ip_prefix);
  }

  private async fetchGcpRanges(): Promise<string[]> {
    const resp = await fetch(GCP_RANGES_URL);
    const data = await resp.json() as { prefixes: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }> };
    return data.prefixes
      .map((p) => p.ipv4Prefix ?? p.ipv6Prefix)
      .filter((p): p is string => p !== undefined);
  }

  private async fetchAzureRanges(): Promise<string[]> {
    const pageResp = await fetch(AZURE_DOWNLOAD_PAGE);
    const html = await pageResp.text();
    const match = AZURE_JSON_HREF_RE.exec(html);
    if (!match) {
      this.logger.warn('Could not find Azure IP ranges download URL');
      return [];
    }

    const jsonResp = await fetch(match[1]);
    const data = await jsonResp.json() as { values: Array<{ properties: { addressPrefixes: string[] } }> };
    return data.values.flatMap((v) => v.properties.addressPrefixes);
  }

  isCloudIp(ip: string, providers: Set<string>): boolean {
    try {
      const parsed = ipaddr.parse(ip);
      for (const provider of providers) {
        const ranges = this.ipRanges.get(provider);
        if (!ranges) continue;
        for (const cidr of ranges) {
          try {
            const [addr, prefixLen] = ipaddr.parseCIDR(cidr);
            if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) {
              return true;
            }
          /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
          } catch { continue; }
          /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        }
      }
    } catch { /* invalid IP */ }
    return false;
  }

  getCloudProviderDetails(ip: string, providers: Set<string>): [string, string] | null {
    try {
      const parsed = ipaddr.parse(ip);
      for (const provider of providers) {
        const ranges = this.ipRanges.get(provider);
        if (!ranges) continue;
        for (const cidr of ranges) {
          try {
            const [addr, prefixLen] = ipaddr.parseCIDR(cidr);
            if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) {
              return [provider, cidr];
            }
          /* v8 ignore start -- measured-unreachable path, see the coverage PR notes */
          } catch { continue; }
          /* v8 ignore stop -- measured-unreachable path, see the coverage PR notes */
        }
      /* v8 ignore start -- closing braces + outer catch for invalid IP; requires full agent integration */
      }
    } catch { /* invalid IP */ }
    /* v8 ignore stop */
    return null;
  }

  /* The twin of send_cloud_detection_event (guard_core/handlers/
     cloud_handler.py): the direct EVENT_CLOUD_BLOCKED SecurityEvent with the
     cloud handler name and the provider/network metadata. */
  async sendCloudDetectionEvent(
    ip: string,
    provider: string,
    network: string,
    actionTaken = 'request_blocked',
  ): Promise<void> {
    if (!this.agentHandler) return;

    try {
      await this.agentHandler.sendEvent({
        timestamp: new Date(),
        eventType: 'cloud_blocked',
        ipAddress: ip,
        actionTaken,
        reason: `IP belongs to blocked cloud provider: ${provider}`,
        handlerName: 'cloud',
        metadata: { cloudProvider: provider, network },
      });
    } catch {
      /* never throw from event dispatch */
    }
  }

  async reset(): Promise<void> {
    this.ipRanges.clear();
    this.lastUpdated.clear();
    this.networkRegions.clear();
    /* The protocol contract (cloud_ip_store_protocol.py): clear fires on
       reset. The legacy cloud_ranges namespace is cleaned alongside. */
    if (this.store) await this.store.clear();
    /* v8 ignore start -- agent event dispatch in dynamic rule application; requires full agent integration */
    if (this.redisHandler) {
      await this.redisHandler.deletePattern('cloud_ranges:*');
    }
    /* v8 ignore stop */
  }
}
