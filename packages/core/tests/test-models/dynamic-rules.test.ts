import { describe, it, expect } from 'vitest';
import { DynamicRulesSchema } from '../../src/models/dynamic-rules.js';

describe('DynamicRulesSchema', () => {
  it('parses minimal required fields', () => {
    const rules = DynamicRulesSchema.parse({
      ruleId: 'rule-001',
      version: 1,
      timestamp: '2024-01-01T00:00:00Z',
    });

    expect(rules.ruleId).toBe('rule-001');
    expect(rules.version).toBe(1);
    expect(rules.ttl).toBe(300);
    expect(rules.ipBlacklist).toEqual([]);
    expect(rules.ipWhitelist).toEqual([]);
    expect(rules.ipBanDuration).toBe(3600);
    expect(rules.blockedCountries).toEqual([]);
    expect(rules.whitelistCountries).toEqual([]);
    expect(rules.globalRateLimit).toBeNull();
    expect(rules.globalRateWindow).toBeNull();
    expect(rules.endpointRateLimits).toEqual({});
    expect(rules.blockedCloudProviders).toEqual(new Set());
    expect(rules.blockedUserAgents).toEqual([]);
    expect(rules.suspiciousPatterns).toEqual([]);
    expect(rules.enablePenetrationDetection).toBeNull();
    expect(rules.enableIpBanning).toBeNull();
    expect(rules.enableRateLimiting).toBeNull();
    expect(rules.emergencyMode).toBe(false);
    expect(rules.emergencyWhitelist).toEqual([]);
  });

  it('parses full rule set', () => {
    const rules = DynamicRulesSchema.parse({
      ruleId: 'rule-002',
      version: 5,
      timestamp: '2024-06-15T12:00:00Z',
      expiresAt: '2024-06-16T12:00:00Z',
      ttl: 600,
      ipBlacklist: ['1.2.3.4', '5.6.7.8'],
      ipWhitelist: ['10.0.0.1'],
      ipBanDuration: 7200,
      blockedCountries: ['CN', 'RU'],
      whitelistCountries: ['US', 'GB'],
      globalRateLimit: 50,
      globalRateWindow: 120,
      endpointRateLimits: { '/api/login': [3, 60] },
      blockedCloudProviders: ['AWS', 'GCP'],
      blockedUserAgents: ['badbot'],
      suspiciousPatterns: ['custom-pattern-\\d+'],
      enablePenetrationDetection: true,
      enableIpBanning: false,
      enableRateLimiting: true,
      emergencyMode: true,
      emergencyWhitelist: ['10.0.0.1'],
    });

    expect(rules.ipBlacklist).toHaveLength(2);
    expect(rules.ipBanDuration).toBe(7200);
    expect(rules.globalRateLimit).toBe(50);
    expect(rules.globalRateWindow).toBe(120);
    expect(rules.blockedCloudProviders).toEqual(new Set(['AWS', 'GCP']));
    expect(rules.blockedUserAgents).toEqual(['badbot']);
    expect(rules.suspiciousPatterns).toEqual(['custom-pattern-\\d+']);
    expect(rules.emergencyMode).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(() => DynamicRulesSchema.parse({})).toThrow();
    expect(() => DynamicRulesSchema.parse({ ruleId: 'x' })).toThrow();
  });

  it('validates country codes length', () => {
    expect(() => DynamicRulesSchema.parse({
      ruleId: 'r', version: 1, timestamp: '2024-01-01T00:00:00Z',
      blockedCountries: ['USA'],
    })).toThrow();
  });

  it('has 24 fields total', () => {
    const rules = DynamicRulesSchema.parse({
      ruleId: 'r', version: 1, timestamp: '2024-01-01T00:00:00Z',
    });
    expect(Object.keys(rules).length).toBe(24);
  });
});
