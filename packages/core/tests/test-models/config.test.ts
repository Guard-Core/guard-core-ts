import { describe, it, expect } from 'vitest';
import { SecurityConfigSchema } from '../../src/models/config.js';

describe('SecurityConfigSchema', () => {
  it('parses minimal config with all defaults', () => {
    const config = SecurityConfigSchema.parse({});

    expect(config.trustedProxies).toEqual([]);
    expect(config.trustedProxyDepth).toBe(1);
    expect(config.trustXForwardedProto).toBe(false);
    expect(config.passiveMode).toBe(false);
    expect(config.enableRedis).toBe(true);
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.redisPrefix).toBe('guard_core:');
    expect(config.whitelist).toBeNull();
    expect(config.blacklist).toEqual([]);
    expect(config.whitelistCountries).toEqual([]);
    expect(config.blockedCountries).toEqual([]);
    expect(config.blockedUserAgents).toEqual([]);
    expect(config.autoBanThreshold).toBe(10);
    expect(config.autoBanDuration).toBe(3600);
    expect(config.logSuspiciousLevel).toBe('WARNING');
    expect(config.logRequestLevel).toBeNull();
    expect(config.logFormat).toBe('text');
    expect(config.rateLimit).toBe(10);
    expect(config.rateLimitWindow).toBe(60);
    expect(config.enforceHttps).toBe(false);
    expect(config.enableCors).toBe(false);
    expect(config.corsAllowOrigins).toEqual(['*']);
    expect(config.corsAllowMethods).toContain('GET');
    expect(config.corsAllowMethods).toContain('POST');
    expect(config.blockCloudProviders).toEqual(new Set());
    expect(config.cloudIpRefreshInterval).toBe(3600);
    expect(config.excludePaths).toEqual([]);
    expect(config.enableIpBanning).toBe(true);
    expect(config.enableRateLimiting).toBe(true);
    expect(config.enablePenetrationDetection).toBe(true);
    expect(config.emergencyMode).toBe(false);
    expect(config.enableAgent).toBe(false);
    expect(config.agentApiKey).toBeNull();
    expect(config.enableDynamicRules).toBe(false);
  });

  it('parses security headers defaults', () => {
    const config = SecurityConfigSchema.parse({});

    expect(config.securityHeaders).not.toBeNull();
    expect(config.securityHeaders!.enabled).toBe(true);
    expect(config.securityHeaders!.frameOptions).toBe('SAMEORIGIN');
    expect(config.securityHeaders!.contentTypeOptions).toBe('nosniff');
    expect(config.securityHeaders!.xssProtection).toBe('1; mode=block');
    expect(config.securityHeaders!.referrerPolicy).toBe('strict-origin-when-cross-origin');
  });

  it('validates IP addresses in whitelist', () => {
    const config = SecurityConfigSchema.parse({
      whitelist: ['192.168.1.1', '10.0.0.0/8'],
    });
    expect(config.whitelist).toEqual(['192.168.1.1', '10.0.0.0/8']);
  });

  it('rejects invalid IP addresses', () => {
    expect(() => SecurityConfigSchema.parse({
      whitelist: ['not-an-ip'],
    })).toThrow();
  });

  it('validates CIDR ranges in blacklist', () => {
    const config = SecurityConfigSchema.parse({
      blacklist: ['192.168.100.0/24', '10.0.0.1'],
    });
    expect(config.blacklist).toEqual(['192.168.100.0/24', '10.0.0.1']);
  });

  it('rejects invalid CIDR ranges', () => {
    expect(() => SecurityConfigSchema.parse({
      blacklist: ['192.168.1.1/99'],
    })).toThrow();
  });

  it('validates trusted proxies', () => {
    const config = SecurityConfigSchema.parse({
      trustedProxies: ['172.16.0.0/12', '10.0.0.1'],
    });
    expect(config.trustedProxies).toEqual(['172.16.0.0/12', '10.0.0.1']);
  });

  it('rejects proxy depth less than 1', () => {
    expect(() => SecurityConfigSchema.parse({
      trustedProxyDepth: 0,
    })).toThrow();
  });

  it('transforms blockCloudProviders array to Set', () => {
    const config = SecurityConfigSchema.parse({
      blockCloudProviders: ['AWS', 'GCP'],
    });
    expect(config.blockCloudProviders).toBeInstanceOf(Set);
    expect(config.blockCloudProviders.has('AWS')).toBe(true);
    expect(config.blockCloudProviders.has('GCP')).toBe(true);
    expect(config.blockCloudProviders.has('Azure')).toBe(false);
  });

  it('rejects invalid cloud providers', () => {
    expect(() => SecurityConfigSchema.parse({
      blockCloudProviders: ['DigitalOcean'],
    })).toThrow();
  });

  it('validates country codes are 2 characters', () => {
    const config = SecurityConfigSchema.parse({
      blockedCountries: ['US', 'CN'],
      whitelistCountries: ['GB'],
      geoResolver: (ip: string) => 'US',
    });
    expect(config.blockedCountries).toEqual(['US', 'CN']);
    expect(config.whitelistCountries).toEqual(['GB']);
  });

  it('rejects country codes that are not 2 characters', () => {
    expect(() => SecurityConfigSchema.parse({
      blockedCountries: ['USA'],
      geoResolver: () => null,
    })).toThrow();
  });

  it('requires agentApiKey when enableAgent is true', () => {
    expect(() => SecurityConfigSchema.parse({
      enableAgent: true,
    })).toThrow(/agentApiKey/);
  });

  it('requires enableAgent when enableDynamicRules is true', () => {
    expect(() => SecurityConfigSchema.parse({
      enableDynamicRules: true,
    })).toThrow(/enableAgent/);
  });

  it('requires geoIpHandler or geoResolver when country filtering is used', () => {
    expect(() => SecurityConfigSchema.parse({
      blockedCountries: ['CN'],
    })).toThrow(/geoIpHandler/);
  });

  it('accepts geoResolver for country filtering', () => {
    const config = SecurityConfigSchema.parse({
      blockedCountries: ['CN'],
      geoResolver: (_ip: string) => 'US',
    });
    expect(config.blockedCountries).toEqual(['CN']);
    expect(config.geoResolver).toBeDefined();
  });

  it('validates detection engine tuning ranges', () => {
    expect(() => SecurityConfigSchema.parse({
      detectionCompilerTimeout: 0.05,
    })).toThrow();

    expect(() => SecurityConfigSchema.parse({
      detectionSemanticThreshold: 1.5,
    })).toThrow();

    const config = SecurityConfigSchema.parse({
      detectionCompilerTimeout: 5.0,
      detectionSemanticThreshold: 0.8,
      detectionAnomalyThreshold: 2.0,
    });
    expect(config.detectionCompilerTimeout).toBe(5.0);
    expect(config.detectionSemanticThreshold).toBe(0.8);
    expect(config.detectionAnomalyThreshold).toBe(2.0);
  });

  it('validates cloudIpRefreshInterval range', () => {
    expect(() => SecurityConfigSchema.parse({
      cloudIpRefreshInterval: 30,
    })).toThrow();

    expect(() => SecurityConfigSchema.parse({
      cloudIpRefreshInterval: 100000,
    })).toThrow();

    const config = SecurityConfigSchema.parse({
      cloudIpRefreshInterval: 7200,
    });
    expect(config.cloudIpRefreshInterval).toBe(7200);
  });

  it('parses custom error responses', () => {
    const config = SecurityConfigSchema.parse({
      customErrorResponses: { 403: 'Forbidden by policy', 429: 'Slow down' },
    });
    expect(config.customErrorResponses[403]).toBe('Forbidden by policy');
    expect(config.customErrorResponses[429]).toBe('Slow down');
  });

  it('accepts custom request check and response modifier functions', () => {
    const config = SecurityConfigSchema.parse({
      customRequestCheck: async () => null,
      customResponseModifier: async (res: unknown) => res,
    });
    expect(config.customRequestCheck).toBeDefined();
    expect(config.customResponseModifier).toBeDefined();
  });

  it('validates endpoint rate limits as tuples', () => {
    const config = SecurityConfigSchema.parse({
      endpointRateLimits: {
        '/api/login': [5, 60],
        '/api/data': [100, 3600],
      },
    });
    expect(config.endpointRateLimits['/api/login']).toEqual([5, 60]);
    expect(config.endpointRateLimits['/api/data']).toEqual([100, 3600]);
  });

  it('parses full production config', () => {
    const config = SecurityConfigSchema.parse({
      trustedProxies: ['172.16.0.0/12', '10.0.0.0/8'],
      trustedProxyDepth: 2,
      trustXForwardedProto: true,
      blacklist: ['192.168.100.0/24'],
      blockedUserAgents: ['badbot', 'scrapy'],
      enableRateLimiting: true,
      rateLimit: 30,
      rateLimitWindow: 60,
      enableIpBanning: true,
      autoBanThreshold: 5,
      autoBanDuration: 300,
      enableRedis: true,
      redisUrl: 'redis://redis:6379',
      logFormat: 'json',
      enableCors: true,
      corsAllowOrigins: ['https://example.com'],
      corsAllowCredentials: true,
      enforceHttps: true,
      excludePaths: ['/health', '/metrics'],
    });

    expect(config.trustedProxies).toHaveLength(2);
    expect(config.trustedProxyDepth).toBe(2);
    expect(config.rateLimit).toBe(30);
    expect(config.enableCors).toBe(true);
    expect(config.corsAllowCredentials).toBe(true);
    expect(config.enforceHttps).toBe(true);
    expect(config.excludePaths).toEqual(['/health', '/metrics']);
  });
});

describe('SecurityConfigSchema failure-policy and redaction knobs', () => {
  it('defaults failSecure to true and the opt-out knobs to false', () => {
    const config = SecurityConfigSchema.parse({});
    expect(config.failSecure).toBe(true);
    expect(config.redisFailOpen).toBe(false);
    expect(config.routeResolutionStrict).toBe(false);
  });

  it('defaults the log redaction sets to empty and the hooks to undefined', () => {
    const config = SecurityConfigSchema.parse({});
    expect(config.logSensitiveHeaders).toEqual([]);
    expect(config.logSensitiveParams).toEqual([]);
    expect(config.logSensitiveBodyFields).toEqual([]);
    expect(config.onBlock).toBeUndefined();
    expect(config.onError).toBeUndefined();
  });

  it('accepts explicitly set failure-policy and redaction values', () => {
    const onBlock = () => undefined;
    const onError = () => undefined;
    const config = SecurityConfigSchema.parse({
      failSecure: false,
      redisFailOpen: true,
      routeResolutionStrict: true,
      onBlock,
      onError,
      logSensitiveHeaders: ['X-Custom-Secret'],
      logSensitiveParams: ['ssn'],
      logSensitiveBodyFields: ['card_number'],
    });
    expect(config.failSecure).toBe(false);
    expect(config.redisFailOpen).toBe(true);
    expect(config.routeResolutionStrict).toBe(true);
    expect(config.onBlock).toBe(onBlock);
    expect(config.onError).toBe(onError);
    expect(config.logSensitiveHeaders).toEqual(['X-Custom-Secret']);
    expect(config.logSensitiveParams).toEqual(['ssn']);
    expect(config.logSensitiveBodyFields).toEqual(['card_number']);
  });

  it('rejects invalid failure-policy values (fail-closed validation)', () => {
    expect(() => SecurityConfigSchema.parse({ failSecure: 'yes' })).toThrow();
    expect(() => SecurityConfigSchema.parse({ redisFailOpen: 1 })).toThrow();
    expect(() => SecurityConfigSchema.parse({ routeResolutionStrict: null })).toThrow();
    expect(() => SecurityConfigSchema.parse({ logSensitiveHeaders: 'authorization' })).toThrow();
    expect(() => SecurityConfigSchema.parse({ logSensitiveParams: [42] })).toThrow();
    expect(() => SecurityConfigSchema.parse({ logSensitiveBodyFields: [null] })).toThrow();
  });
});
