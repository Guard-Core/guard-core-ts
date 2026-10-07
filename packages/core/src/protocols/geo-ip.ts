import type { AgentHandlerProtocol } from './agent.js';
import type { RedisHandlerProtocol } from './redis.js';

export interface GeoIPHandler {
  readonly isInitialized: boolean;
  initialize(): Promise<void>;
  initializeRedis(redisHandler: RedisHandlerProtocol): Promise<void>;
  initializeAgent(agentHandler: AgentHandlerProtocol): Promise<void>;
  getCountry(ip: string): string | null;
  /** The reference refresh: re-download and swap the reader. */
  refresh(): Promise<void>;
  /** The reference close: release the reader. */
  close(): void;
}
