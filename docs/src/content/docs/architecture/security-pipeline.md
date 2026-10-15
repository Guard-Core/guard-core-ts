---
title: "Security Pipeline"
description: "The 17 checks in order, Chain of Responsibility pattern, and pipeline customization"
---

The security pipeline uses the Chain of Responsibility pattern. Each check runs in sequence -- the first check that returns a non-null `GuardResponse` stops the pipeline and that response is sent to the client.

## The 17 Checks

| # | Check | What It Does |
|---|-------|-------------|
| 1 | **RouteConfig** | Extracts per-route configuration from decorators. Sets `guardRouteId` and `guardEndpointId` on the request state. Never blocks. |
| 2 | **EmergencyMode** | If `emergencyMode` is `true`, blocks all requests except those from `emergencyWhitelist` IPs. Returns 503. |
| 3 | **HttpsEnforcement** | If `enforceHttps` is `true` or `requireHttps` is set on the route, redirects HTTP to HTTPS or returns 403. |
| 4 | **RequestLogging** | Logs the request if `logRequestLevel` is configured. Never blocks. |
| 5 | **RequestSizeContent** | Checks `maxRequestSize` and `allowedContentTypes` from route config. Returns 413 or 415. |
| 6 | **RequiredHeaders** | Checks `requiredHeaders` from route config. Returns 400 if any required header is missing or has wrong value. |
| 7 | **Authentication** | Checks `authRequired` and `apiKeyRequired` from route config. Returns 401 if auth header is missing. |
| 8 | **Referrer** | Checks `requireReferrer` from route config. Returns 403 if referrer does not match allowed domains. |
| 9 | **CustomValidators** | Runs all `customValidators` from route config in order. Returns the first non-null response. |
| 10 | **TimeWindow** | Checks `timeRestrictions` from route config. Returns 403 if current time is outside the window. |
| 11 | **CloudIpRefresh** | Periodically refreshes cloud provider IP ranges. Never blocks. |
| 12 | **IpSecurity** | Checks global and per-route whitelists/blacklists, country filters, and IP ban status. Returns 403. |
| 13 | **CloudProvider** | Checks if the client IP belongs to a blocked cloud provider. Returns 403. |
| 14 | **UserAgent** | Checks global and per-route blocked user agents. Returns 403. |
| 15 | **RateLimit** | Checks global, per-endpoint, per-route, and geo-based rate limits. Returns 429. |
| 16 | **SuspiciousActivity** | Runs the detection engine against URL path, query params, headers, and body. Auto-bans on threshold. Returns 403. |
| 17 | **CustomRequest** | Runs `customRequestCheck` from config if provided. Returns its response. |

## Execution

```typescript
class SecurityCheckPipeline {
  async execute(request: GuardRequest): Promise<GuardResponse | null> {
    for (const check of this.checks) {
      const response = await check.check(request);
      if (response !== null) return response;
    }
    return null;
  }
}
```

If a check throws an error, it is caught and logged. The pipeline continues to the next check. This is fail-open behavior for individual check errors -- the pipeline itself is fail-secure (unknown errors in the pipeline runner would block the request at the adapter level).

## Pipeline Customization

### Add a check

```typescript
pipeline.add(new MyCustomCheck(middlewareProtocol));
```

Adds the check at the end of the pipeline.

### Insert at a specific position

```typescript
pipeline.insert(5, new MyCustomCheck(middlewareProtocol));
```

Inserts the check at index 5 (after RequestSizeContent, before RequiredHeaders).

### Remove a check

```typescript
pipeline.remove('rate_limit');
```

Removes the check by name. Returns `true` if found and removed.

### List check names

```typescript
const names = pipeline.getCheckNames();
// ['route_config', 'emergency_mode', 'https_enforcement', ...]
```

## Creating a Custom Check

Extend the `SecurityCheck` base class:

```typescript
import type { GuardRequest } from '@guardcore/core';
import type { GuardResponse } from '@guardcore/core';

class GeoFencingCheck extends SecurityCheck {
  get checkName(): string {
    return 'geo_fencing';
  }

  async check(request: GuardRequest): Promise<GuardResponse | null> {
    const geoIp = this.middleware.geoIpHandler;
    if (!geoIp) return null;

    const clientIp = resolvedClientIp(request);
    if (!clientIp) return null;

    const country = geoIp.getCountry(clientIp);
    if (country === 'SANCTIONED_COUNTRY') {
      await this.sendEvent(
        'geo_fence_blocked', request, 'request_blocked',
        `Blocked country: ${country}`,
      );
      return this.createErrorResponse(403, 'Access denied');
    }

    return null;
  }
}
```

The base class provides:
- `this.config` -- The resolved security config
- `this.logger` -- The configured logger
- `this.middleware` -- The full middleware protocol (access to handlers)
- `this.sendEvent()` -- Send events through the event bus
- `this.createErrorResponse()` -- Create formatted error responses
- `this.isPassiveMode()` -- Check if passive mode is enabled

## Passive Mode

When `passiveMode: true`, checks log violations but return `null` instead of blocking responses. This is useful for testing a new configuration before enforcing it.
