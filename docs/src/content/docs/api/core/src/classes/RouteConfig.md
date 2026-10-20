---
editUrl: false
next: false
prev: false
title: "RouteConfig"
---

Defined in: [packages/core/src/models/route-config.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L5)

## Constructors

### Constructor

> **new RouteConfig**(): `RouteConfig`

#### Returns

`RouteConfig`

## Properties

### allowedContentTypes

> **allowedContentTypes**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L32)

***

### apiKeyHeader

> **apiKeyHeader**: `string` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L24)

***

### apiKeyRequired

> **apiKeyRequired**: `boolean` = `false`

Defined in: [packages/core/src/models/route-config.ts:36](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L36)

***

### apiKeyVerifier

> **apiKeyVerifier**: ((`request`, `credential`) => `unknown`) \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L23)

***

### authorizationHeaderRequired

> **authorizationHeaderRequired**: `string` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L25)

***

### authRequired

> **authRequired**: `string` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L14)

***

### authVerifier

> **authVerifier**: ((`request`, `credential`) => `unknown`) \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L22)

***

### behaviorRules

> **behaviorRules**: [`BehaviorRule`](/guard-core-ts/api/core/src/classes/behaviorrule/)[] = `[]`

Defined in: [packages/core/src/models/route-config.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L29)

***

### blockCloudProviders

> **blockCloudProviders**: `Set`\<`string`\>

Defined in: [packages/core/src/models/route-config.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L30)

***

### blockedCountries

> **blockedCountries**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L10)

***

### blockedUserAgents

> **blockedUserAgents**: `string`[] = `[]`

Defined in: [packages/core/src/models/route-config.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L27)

***

### bypassedChecks

> **bypassedChecks**: `Set`\<`string`\>

Defined in: [packages/core/src/models/route-config.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L12)

***

### customValidators

> **customValidators**: (`request`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>[] = `[]`

Defined in: [packages/core/src/models/route-config.ts:26](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L26)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

***

### detectionScanBody

> **detectionScanBody**: `boolean` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:63](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L63)

***

### enabledDetectionCategories

> **enabledDetectionCategories**: `Set`\<`string`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:59](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L59)

***

### enableSuspiciousDetection

> **enableSuspiciousDetection**: `boolean` = `true`

Defined in: [packages/core/src/models/route-config.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L34)

***

### excludedDetectionBodyFields

> **excludedDetectionBodyFields**: `Set`\<`string`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L55)

***

### excludedDetectionHeaders

> **excludedDetectionHeaders**: `Set`\<`string`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L49)

***

### excludedDetectionParams

> **excludedDetectionParams**: `Set`\<`string`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:54](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L54)

***

### excludedSemanticDetectionHeaders

> **excludedSemanticDetectionHeaders**: `Set`\<`string`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L53)

***

### geoRateLimits

> **geoRateLimits**: `Record`\<`string`, \[`number`, `number`\]\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:38](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L38)

***

### ipBlacklist

> **ipBlacklist**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L9)

***

### ipWhitelist

> **ipWhitelist**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L8)

***

### maxRequestSize

> **maxRequestSize**: `number` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L31)

***

### rateLimit

> **rateLimit**: `number` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L6)

***

### rateLimitWindow

> **rateLimitWindow**: `number` \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L7)

***

### requiredHeaders

> **requiredHeaders**: `Record`\<`string`, `string`\> = `{}`

Defined in: [packages/core/src/models/route-config.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L28)

***

### requireHttps

> **requireHttps**: `boolean` = `false`

Defined in: [packages/core/src/models/route-config.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L13)

***

### requireReferrer

> **requireReferrer**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:35](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L35)

***

### sessionLimits

> **sessionLimits**: `Record`\<`string`, `number`\> \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L37)

***

### timeRestrictions

> **timeRestrictions**: \{ `end`: `string`; `start`: `string`; \} \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:33](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L33)

***

### whitelistCountries

> **whitelistCountries**: `string`[] \| `null` = `null`

Defined in: [packages/core/src/models/route-config.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/route-config.ts#L11)
