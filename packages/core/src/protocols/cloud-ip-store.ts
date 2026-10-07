import type { RedisHandlerProtocol } from './redis.js';

/* The TS port of CloudIpStoreProtocol
   (guard_core/protocols/cloud_ip_store_protocol.py): the injectable cache
   of cloud-provider IP ranges consulted by the cloud-IP check.

   get is hit on the request hot path for every configured provider; set is
   populated by the range refresh, clear on reset. get returns null on a
   miss (distinct from an empty set, which means "known, no ranges") so the
   caller can decide whether to trigger a refresh. */
export interface CloudIpStoreProtocol {
  get(provider: string): Promise<Set<string> | null>;
  set(provider: string, ranges: Set<string>, ttl?: number | null): Promise<void>;
  clear(): Promise<void>;
}

/* The reference CloudIpStoreFactory: a store built over the shared Redis
   handler once it exists. */
export type CloudIpStoreFactory = (
  redisHandler: RedisHandlerProtocol,
) => CloudIpStoreProtocol;
