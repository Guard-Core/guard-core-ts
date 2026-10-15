import { z } from 'zod';

const VALID_CLOUD_PROVIDERS = ['AWS', 'GCP', 'Azure'] as const;

export const DynamicRulesSchema = z.object({
  ruleId: z.string(),
  version: z.number().int(),
  timestamp: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().default(null),
  ttl: z.number().int().default(300),
  ipBlacklist: z.array(z.string()).default([]),
  ipWhitelist: z.array(z.string()).default([]),
  ipBanDuration: z.number().int().default(3600),
  blockedCountries: z.array(z.string().length(2)).default([]),
  whitelistCountries: z.array(z.string().length(2)).default([]),
  globalRateLimit: z.number().int().nullable().default(null),
  globalRateWindow: z.number().int().nullable().default(null),
  endpointRateLimits: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),
  blockedCloudProviders: z
    .array(z.enum(VALID_CLOUD_PROVIDERS))
    .default([])
    .transform((arr) => new Set(arr)),
  blockedUserAgents: z.array(z.string()).default([]),
  suspiciousPatterns: z.array(z.string()).default([]),
  enablePenetrationDetection: z.boolean().nullable().default(null),
  enableIpBanning: z.boolean().nullable().default(null),
  enableRateLimiting: z.boolean().nullable().default(null),
  autoBanThreshold: z.number().int().min(1).nullable().default(null),
  autoBanDuration: z.number().int().min(1).nullable().default(null),
  enableRateLimitAutoBan: z.boolean().nullable().default(null),
  emergencyMode: z.boolean().default(false),
  emergencyWhitelist: z.array(z.string()).default([]),
});

export type DynamicRules = z.output<typeof DynamicRulesSchema>;
