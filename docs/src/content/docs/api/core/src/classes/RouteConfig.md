---
editUrl: false
next: false
prev: false
title: "RouteConfig"
---

Defined in: [core/src/models/route-config.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L5)

## Constructors

### Constructor

> **new RouteConfig**(): `RouteConfig`

#### Returns

`RouteConfig`

## Properties

### allowedContentTypes

> **allowedContentTypes**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L21)

***

### apiKeyRequired

> **apiKeyRequired**: `boolean` = `false`

Defined in: [core/src/models/route-config.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L25)

***

### authRequired

> **authRequired**: `string` \| `null` = `null`

Defined in: [core/src/models/route-config.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L14)

***

### behaviorRules

> **behaviorRules**: [`BehaviorRule`](/guard-core-ts/api/core/src/classes/behaviorrule/)[] = `[]`

Defined in: [core/src/models/route-config.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L18)

***

### blockCloudProviders

> **blockCloudProviders**: `Set`\<`string`\>

Defined in: [core/src/models/route-config.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L19)

***

### blockedCountries

> **blockedCountries**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L10)

***

### blockedUserAgents

> **blockedUserAgents**: `string`[] = `[]`

Defined in: [core/src/models/route-config.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L16)

***

### bypassedChecks

> **bypassedChecks**: `Set`\<`string`\>

Defined in: [core/src/models/route-config.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L12)

***

### customValidators

> **customValidators**: (`request`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>[] = `[]`

Defined in: [core/src/models/route-config.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L15)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

***

### enableSuspiciousDetection

> **enableSuspiciousDetection**: `boolean` = `true`

Defined in: [core/src/models/route-config.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L23)

***

### geoRateLimits

> **geoRateLimits**: `Record`\<`string`, \[`number`, `number`\]\> \| `null` = `null`

Defined in: [core/src/models/route-config.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L27)

***

### ipBlacklist

> **ipBlacklist**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L9)

***

### ipWhitelist

> **ipWhitelist**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L8)

***

### maxRequestSize

> **maxRequestSize**: `number` \| `null` = `null`

Defined in: [core/src/models/route-config.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L20)

***

### rateLimit

> **rateLimit**: `number` \| `null` = `null`

Defined in: [core/src/models/route-config.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L6)

***

### rateLimitWindow

> **rateLimitWindow**: `number` \| `null` = `null`

Defined in: [core/src/models/route-config.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L7)

***

### requiredHeaders

> **requiredHeaders**: `Record`\<`string`, `string`\> = `{}`

Defined in: [core/src/models/route-config.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L17)

***

### requireHttps

> **requireHttps**: `boolean` = `false`

Defined in: [core/src/models/route-config.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L13)

***

### requireReferrer

> **requireReferrer**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L24)

***

### sessionLimits

> **sessionLimits**: `Record`\<`string`, `number`\> \| `null` = `null`

Defined in: [core/src/models/route-config.ts:26](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L26)

***

### timeRestrictions

> **timeRestrictions**: \{ `end`: `string`; `start`: `string`; \} \| `null` = `null`

Defined in: [core/src/models/route-config.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L22)

***

### whitelistCountries

> **whitelistCountries**: `string`[] \| `null` = `null`

Defined in: [core/src/models/route-config.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/route-config.ts#L11)
