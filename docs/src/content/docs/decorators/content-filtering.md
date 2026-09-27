---
title: "Content Filtering Decorators"
description: "Per-route user agent blocking, content type filtering, size limits, referrer checks, and custom validation"
---

## `blockUserAgents(patterns)`

Block requests with User-Agent headers matching any of the provided substring patterns.

```typescript
const handler = guard.blockUserAgents([
  'curl',
  'wget',
  'python-requests',
  'scrapy',
])(async (req, res) => {
  res.json({ data: 'browser-only' });
});

app.get('/api/premium', handler);
```

Matching is case-sensitive substring matching against the full `User-Agent` header value. This is in addition to the global `blockedUserAgents` in `SecurityConfig`.

## `contentTypeFilter(allowedTypes)`

Restrict which `Content-Type` values are accepted for requests to this route.

```typescript
const handler = guard.contentTypeFilter([
  'application/json',
  'application/xml',
])(async (req, res) => {
  res.json({ accepted: true });
});

app.post('/api/data', handler);
```

Requests with a `Content-Type` not in the list receive a 415 (Unsupported Media Type) response.

## `maxRequestSize(sizeBytes)`

Limit the request body size for a specific route.

```typescript
const handler = guard.maxRequestSize(1024 * 100)(async (req, res) => {
  res.json({ uploaded: true });
});

app.post('/api/upload', handler);
```

This limits the body to 100KB. Requests exceeding the limit receive a 413 (Payload Too Large) response.

## `requireReferrer(allowedDomains)`

Require that requests include a `Referer` header from an allowed domain.

```typescript
const handler = guard.requireReferrer([
  'example.com',
  'app.example.com',
])(async (req, res) => {
  res.json({ data: 'referrer-verified' });
});

app.post('/api/form-submit', handler);
```

Requests without a `Referer` header or with a `Referer` not matching any allowed domain are blocked with a 403.

## `customValidation(validator)`

Add a custom validation function that runs during the security pipeline. The function receives a `GuardRequest` and returns either `null` (pass) or a `GuardResponse` (block).

```typescript
const handler = guard.customValidation(async (request) => {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey) return null;

  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    return {
      statusCode: 401,
      headers: { 'content-type': 'application/json' },
      setHeader() {},
      body: new TextEncoder().encode(JSON.stringify({ error: 'Invalid API key' })),
      bodyText: JSON.stringify({ error: 'Invalid API key' }),
    };
  }
  return null;
})(async (req, res) => {
  res.json({ data: 'validated' });
});

app.get('/api/resource', handler);
```

Multiple `customValidation` calls on the same route stack -- all validators run in order and the first non-null response blocks the request.

## `detectionExclusion(options)`

Configure per-route detection exclusions, the port of the reference `detection_exclusion` decorator (guard_core/decorators/content_filtering.py). Each given surface replaces the global `SecurityConfig` value for that route; an omitted surface keeps inheriting the global config. `headers` always merges with the hardcoded proxy-identity defaults and the global `excludedDetectionHeaders` (an excluded header keeps scanning every category except the ssrf skip, so an attack payload in it still detects). Entries are matched case-insensitively.

```typescript
const handler = guard.detectionExclusion({
  params: new Set(['q']),            // skip this query param entirely
  bodyFields: new Set(['comment']),  // skip this body field / JSON subtree
  categories: new Set(['sqli']),     // only these categories scan
  scanBody: false,                   // skip the body surface (query/headers still scan)
})(async (req, res) => {
  res.json({ data: 'ok' });
});
```

| Option | Type | Effect |
|--------|------|--------|
| `headers` | `Set<string>` | Merge into the excluded-header routing set (ssrf-skip semantics) |
| `params` | `Set<string>` | Replace the global `excludedDetectionParams` for this route |
| `bodyFields` | `Set<string>` | Replace the global `excludedDetectionBodyFields` for this route |
| `categories` | `Set<string>` | Replace the global `enabledDetectionCategories` for this route (empty set disables every category) |
| `scanBody` | `boolean` | Override the global `detectionScanBody` for this route |

Decorator-registered route configs resolve through `request.state.guardRouteId`. The adapter middlewares do not populate that field today, so prefer the adapter-level `routeConfigs` option (or fastify's `config.guardRouteConfig` route option) to attach per-route configs to live traffic.

## Combining Content Filters

```typescript
const uploadHandler = guard.maxRequestSize(5 * 1024 * 1024)(
  guard.contentTypeFilter(['multipart/form-data'])(
    guard.blockUserAgents(['curl', 'wget'])(
      guard.requireReferrer(['app.example.com'])(async (req, res) => {
        res.json({ uploaded: true });
      })
    )
  )
);

app.post('/api/upload', uploadHandler);
```

This route:
- Limits body to 5MB
- Only accepts `multipart/form-data`
- Blocks CLI tools
- Requires referrer from `app.example.com`
