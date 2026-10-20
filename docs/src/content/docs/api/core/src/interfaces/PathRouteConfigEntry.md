---
editUrl: false
next: false
prev: false
title: "PathRouteConfigEntry"
---

Defined in: [packages/core/src/core/routing/resolver.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L9)

One adapter-registered per-route config: a framework route identity
 (optionally method-scoped) bound to a RouteConfig. Path matching is exact
 against the request path, or a prefix match when the entry path ends with
 `/*` (matching the prefix itself and everything under it).

## Properties

### config

> **config**: [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

Defined in: [packages/core/src/core/routing/resolver.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L12)

***

### method?

> `optional` **method?**: `string`

Defined in: [packages/core/src/core/routing/resolver.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L10)

***

### path

> **path**: `string`

Defined in: [packages/core/src/core/routing/resolver.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L11)
