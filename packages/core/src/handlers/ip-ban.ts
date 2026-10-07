import ipaddr from 'ipaddr.js';

import type { Logger } from '../models/logger.js';
import type { AgentHandlerProtocol } from '../protocols/agent.js';
import type { RedisManager } from './redis.js';

interface BanEntry {
  expiresAt: number;
  reason: string;
  bannedAt: number;
}

/* The twin of _canonicalize_ip (guard_core/_utils/ip_extraction.py): strip
   brackets, parse, map an IPv4-mapped IPv6 to its IPv4 text, otherwise the
   normalized compressed text; unparseable input answers unchanged (the
   legacy key survives migration untouched). */
export function canonicalizeIp(value: string): string {
  const stripped = value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value;
  try {
    const addr = ipaddr.parse(stripped);
    if (addr.kind() === 'ipv6') {
      const v6 = addr as ipaddr.IPv6;
      if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().toString();
    }
    return addr.toString();
  } catch {
    return value;
  }
}

export class IPBanManager {
  private bannedIps = new Map<string, BanEntry>();
  private redisHandler: RedisManager | null = null;
  private agentHandler: AgentHandlerProtocol | null = null;
  private readonly maxSize = 10000;

  constructor(private readonly logger: Logger) {}

  async initializeRedis(redisHandler: RedisManager): Promise<void> {
    this.redisHandler = redisHandler;
    await this.migrateLegacyBanKeys(redisHandler);
  }

  /* The twin of _migrate_legacy_ban_keys
     (guard_core/handlers/_ipban_migration.py): bans stored under a
     non-canonical IP key (bracketed IPv6, non-compressed text, an
     IPv4-mapped form) move to the canonical key with the greater remaining
     TTL preserved, the legacy key is deleted, and every failure mode is a
     warning that leaves the store untouched. */
  private async migrateLegacyBanKeys(redisHandler: RedisManager): Promise<void> {
    try {
      const prefix = `${(redisHandler as unknown as { prefix: string }).prefix}banned_ips:`;
      const client = redisHandler.getRawClient();
      if (!client) return;
      const keys = await client.keys(`${prefix}*`);
      for (const key of keys ?? []) {
        await this.migrateOneBanKey(client, key as string, prefix);
      }
    } catch (e) {
      this.logger.warn(`Legacy ban-key migration skipped: ${String(e)}`);
    }
  }

  /* The twin of _migrate_one_ban_key: a key whose raw IP already is
     canonical stays; an expired legacy key is deleted; the canonical key
     keeps the longer of the two TTLs; the legacy key always goes. */
  private async migrateOneBanKey(
    client: NonNullable<ReturnType<RedisManager['getRawClient']>>,
    key: string,
    prefix: string,
  ): Promise<void> {
    const rawIp = key.slice(prefix.length);
    const canonicalIp = canonicalizeIp(rawIp);
    if (canonicalIp === rawIp) return;

    const value = await client.get(key);
    const oldPttl = await (client as unknown as { pttl(k: string): Promise<number> }).pttl(key);
    if (oldPttl <= 0) {
      await client.del(key);
      return;
    }

    const canonicalKey = `${prefix}${canonicalIp}`;
    const newPttl = await (client as unknown as { pttl(k: string): Promise<number> }).pttl(canonicalKey);
    if (newPttl < oldPttl) {
      await client.set(canonicalKey, value ?? '', 'PX', oldPttl);
    }
    await client.del(key);
    this.logger.info(
      `Migrated legacy ban key ${rawIp} to canonical ${canonicalIp}`,
    );
  }

  async initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void> {
    this.agentHandler = agentHandler;
  }

  /* Returns true when the ban was stored, mirroring the reference ban_ip
     (guard_core/handlers/_ipban_bans.py) whose boolean lets the autoban
     engine distinguish an applied ban from a refused one. The success path
     reports EVENT_IP_BANNED through _send_ban_event (_ipban_events.py):
     action "banned", the ip_ban handler name, duration-only metadata. */
  async banIp(ip: string, duration: number, reason: string): Promise<boolean> {
    const now = Date.now() / 1000;
    const expiresAt = now + duration;

    if (this.bannedIps.size >= this.maxSize) {
      const oldestKey = this.bannedIps.keys().next().value;
      /* v8 ignore next -- oldestKey is undefined only for an empty map, which the size guard excludes */
      if (oldestKey) this.bannedIps.delete(oldestKey);
    }

    this.bannedIps.set(ip, { expiresAt, reason, bannedAt: now });

    if (this.redisHandler) {
      await this.redisHandler.setKey('banned_ips', ip, String(expiresAt), duration);
    }

    if (this.agentHandler) {
      try {
        await this.agentHandler.sendEvent({
          timestamp: new Date(),
          eventType: 'ip_banned',
          ipAddress: ip,
          actionTaken: 'banned',
          reason,
          handlerName: 'ip_ban',
          metadata: { duration },
        });
      } catch { /* never throw from event dispatch */ }
    }

    this.logger.info(`IP banned: ${ip} for ${duration}s - ${reason}`);
    return true;
  }

  async isIpBanned(ip: string): Promise<boolean> {
    const now = Date.now() / 1000;

    const entry = this.bannedIps.get(ip);
    if (entry) {
      if (now <= entry.expiresAt) return true;
      this.bannedIps.delete(ip);
    }

    if (this.redisHandler) {
      const expiryStr = await this.redisHandler.getKey('banned_ips', ip);
      if (typeof expiryStr === 'string') {
        const expiresAt = parseFloat(expiryStr);
        if (now <= expiresAt) {
          this.bannedIps.set(ip, {
            expiresAt,
            reason: 'restored_from_redis',
            bannedAt: now,
          });
          return true;
        }
        await this.redisHandler.delete('banned_ips', ip);
      }
    }

    return false;
  }

  async unbanIp(ip: string): Promise<void> {
    this.bannedIps.delete(ip);

    if (this.redisHandler) {
      await this.redisHandler.delete('banned_ips', ip);
    }

    if (this.agentHandler) {
      try {
        await this.agentHandler.sendEvent({
          timestamp: new Date(),
          eventType: 'ip_unbanned',
          ipAddress: ip,
          actionTaken: 'unbanned',
          reason: 'dynamic_rule_whitelist',
          handlerName: 'ip_ban',
          metadata: { action: 'unban' },
        });
      } catch { /* never throw */ }
    }

    this.logger.info(`IP unbanned: ${ip}`);
  }

  async reset(): Promise<void> {
    this.bannedIps.clear();
    if (this.redisHandler) {
      await this.redisHandler.deletePattern('banned_ips:*');
    }
  }
}
