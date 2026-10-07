import type { RedisHandlerProtocol } from '../protocols/redis.js';
import type { CloudIpStoreProtocol } from '../protocols/cloud-ip-store.js';

/* The TS port of guard_core/handlers/cloud_ip_stores.py: the two reference
   stores behind the CloudIpStoreProtocol seam. Encoded entries carry an
   optional "|region" suffix (the reference _encode_cached/_decode_cached
   wire), so a store round-trips region annotations with the ranges. */

/* Encode (network, region) pairs into the store's entry strings. */
export function encodeCachedEntries(
  ranges: Iterable<string>,
  regions: Map<string, string>,
): Set<string> {
  const encoded = new Set<string>();
  for (const network of ranges) {
    const region = regions.get(network);
    encoded.add(region ? `${network}|${region}` : network);
  }
  return encoded;
}

/* Decode store entries back into ranges plus the region map. */
export function decodeCachedEntries(
  entries: Iterable<string>,
): [Set<string>, Map<string, string>] {
  const networks = new Set<string>();
  const regions = new Map<string, string>();
  for (const entry of entries) {
    const separator = entry.indexOf('|');
    const prefix = separator === -1 ? entry : entry.slice(0, separator);
    const region = separator === -1 ? '' : entry.slice(separator + 1);
    networks.add(prefix);
    if (separator !== -1 && region) regions.set(prefix, region);
  }
  return [networks, regions];
}

/* Process-local default store (the reference InMemoryCloudIpStore):
   monotonic-clock TTL expiry, entries kept verbatim. */
export class InMemoryCloudIpStore implements CloudIpStoreProtocol {
  private readonly data = new Map<string, Set<string>>();
  private readonly expiresAt = new Map<string, number>();

  async get(provider: string): Promise<Set<string> | null> {
    const expiresAt = this.expiresAt.get(provider);
    if (expiresAt !== undefined && Date.now() >= expiresAt) {
      this.data.delete(provider);
      this.expiresAt.delete(provider);
      return null;
    }
    const ranges = this.data.get(provider);
    if (ranges === undefined) return null;
    return new Set(ranges);
  }

  async set(provider: string, ranges: Set<string>, ttl?: number | null): Promise<void> {
    this.data.set(provider, new Set(ranges));
    if (ttl == null) {
      this.expiresAt.delete(provider);
    } else {
      this.expiresAt.set(provider, Date.now() + ttl * 1000);
    }
  }

  async clear(): Promise<void> {
    this.data.clear();
    this.expiresAt.clear();
  }
}

/* Shared-store implementation over Redis (the reference RedisCloudIpStore):
   per-provider JSON arrays under "{prefix}:" namespace keys, so all workers
   share one cache. */
export class RedisCloudIpStore implements CloudIpStoreProtocol {
  constructor(
    private readonly redis: RedisHandlerProtocol,
    private readonly keyPrefix = 'cloud_ip_v2',
  ) {}

  async get(provider: string): Promise<Set<string> | null> {
    const raw: unknown = await this.redis.getKey(this.keyPrefix, provider);
    if (raw === null || raw === undefined) return null;
    let decoded: unknown;
    try {
      decoded = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    if (!Array.isArray(decoded)) return null;
    return new Set(decoded.map(String));
  }

  async set(provider: string, ranges: Set<string>, ttl?: number | null): Promise<void> {
    /* The reference payload is json.dumps(sorted(ranges)): Python's default
       ", " separator. The redis interop corpus pins these bytes. */
    const payload = '[' + [...ranges].sort().map((r) => JSON.stringify(r)).join(', ') + ']';
    await this.redis.setKey(this.keyPrefix, provider, payload, ttl ?? null);
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}:*`);
    if (keys === null || keys.length === 0) return;
    for (const key of keys) {
      const provider = key.slice(key.indexOf(`${this.keyPrefix}:`) + this.keyPrefix.length + 1);
      if (provider) await this.redis.delete(this.keyPrefix, provider);
    }
  }
}
