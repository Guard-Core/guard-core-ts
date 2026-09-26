import { describe, it, expect } from 'vitest';
import { RouteConfig } from '../../src/models/route-config.js';

describe('RouteConfig', () => {
  it('creates with all defaults', () => {
    const rc = new RouteConfig();

    expect(rc.rateLimit).toBeNull();
    expect(rc.rateLimitWindow).toBeNull();
    expect(rc.ipWhitelist).toBeNull();
    expect(rc.ipBlacklist).toBeNull();
    expect(rc.blockedCountries).toBeNull();
    expect(rc.whitelistCountries).toBeNull();
    expect(rc.bypassedChecks).toEqual(new Set());
    expect(rc.requireHttps).toBe(false);
    expect(rc.authRequired).toBeNull();
    expect(rc.customValidators).toEqual([]);
    expect(rc.blockedUserAgents).toEqual([]);
    expect(rc.requiredHeaders).toEqual({});
    expect(rc.behaviorRules).toEqual([]);
    expect(rc.blockCloudProviders).toEqual(new Set());
    expect(rc.maxRequestSize).toBeNull();
    expect(rc.allowedContentTypes).toBeNull();
    expect(rc.timeRestrictions).toBeNull();
    expect(rc.enableSuspiciousDetection).toBe(true);
    expect(rc.requireReferrer).toBeNull();
    expect(rc.apiKeyRequired).toBe(false);
    expect(rc.sessionLimits).toBeNull();
    expect(rc.geoRateLimits).toBeNull();
  });

  it('has 26 properties', () => {
    const rc = new RouteConfig();
    const keys = Object.keys(rc);
    expect(keys.length).toBe(26);
  });

  it('allows mutation of all fields', () => {
    const rc = new RouteConfig();
    rc.rateLimit = 100;
    rc.rateLimitWindow = 60;
    rc.ipWhitelist = ['10.0.0.1'];
    rc.ipBlacklist = ['192.168.1.1'];
    rc.blockedCountries = ['CN'];
    rc.whitelistCountries = ['US'];
    rc.bypassedChecks.add('rate_limit');
    rc.requireHttps = true;
    rc.authRequired = 'bearer';
    rc.blockedUserAgents = ['badbot'];
    rc.requiredHeaders = { 'X-Custom': 'value' };
    rc.blockCloudProviders.add('AWS');
    rc.maxRequestSize = 1024;
    rc.allowedContentTypes = ['application/json'];
    rc.timeRestrictions = { start: '09:00', end: '17:00' };
    rc.enableSuspiciousDetection = false;
    rc.requireReferrer = ['example.com'];
    rc.apiKeyRequired = true;
    rc.sessionLimits = { default: 100 };
    rc.geoRateLimits = { US: [100, 60] };

    expect(rc.rateLimit).toBe(100);
    expect(rc.bypassedChecks.has('rate_limit')).toBe(true);
    expect(rc.blockCloudProviders.has('AWS')).toBe(true);
    expect(rc.sessionLimits).toEqual({ default: 100 });
    expect(rc.geoRateLimits).toEqual({ US: [100, 60] });
  });
});
