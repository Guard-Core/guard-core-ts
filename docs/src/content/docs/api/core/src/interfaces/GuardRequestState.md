---
editUrl: false
next: false
prev: false
title: "GuardRequestState"
---

Defined in: [packages/core/src/protocols/request.ts:1](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L1)

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### guardDecorator?

> `optional` **guardDecorator?**: `unknown`

Defined in: [packages/core/src/protocols/request.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L4)

***

### guardEndpointId?

> `optional` **guardEndpointId?**: `string`

Defined in: [packages/core/src/protocols/request.ts:3](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L3)

***

### guardExclusionScoped?

> `optional` **guardExclusionScoped?**: `boolean`

Defined in: [packages/core/src/protocols/request.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L10)

Set by BypassHandler.handlePassthrough for an excluded path: only the checks with enforcedOnExcludedPaths run.

***

### guardRouteId?

> `optional` **guardRouteId?**: `string`

Defined in: [packages/core/src/protocols/request.ts:2](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L2)

***

### isExempt?

> `optional` **isExempt?**: `boolean`

Defined in: [packages/core/src/protocols/request.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L8)

Set by IpSecurityCheck: the client IP matched the config exemptIps list.

***

### isWhitelisted?

> `optional` **isWhitelisted?**: `boolean`

Defined in: [packages/core/src/protocols/request.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L6)

Set by IpSecurityCheck: the client IP matched the config whitelist.
