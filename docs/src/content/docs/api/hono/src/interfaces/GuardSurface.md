---
editUrl: false
next: false
prev: false
title: "GuardSurface"
---

Defined in: [packages/hono/src/middleware.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L44)

## Properties

### agentStats

> `readonly` **agentStats**: `object` & `Record`\<`string`, `unknown`\>

Defined in: [packages/hono/src/middleware.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L53)

#### Type Declaration

##### degraded

> **degraded**: `boolean`

##### enabled

> **enabled**: `boolean`

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `message`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/hono/src/middleware.ts:54](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L54)

#### Parameters

##### statusCode

`number`

##### message

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### getInitializationStatus()

> **getInitializationStatus**(): `object`

Defined in: [packages/hono/src/middleware.ts:47](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L47)

#### Returns

`object`

##### agent

> **agent**: `object`

###### agent.degraded

> **degraded**: `boolean`

###### agent.enabled

> **enabled**: `boolean`

##### initialized

> **initialized**: `boolean`

##### redis

> **redis**: `boolean`

***

### markInitialized()

> **markInitialized**(): `void`

Defined in: [packages/hono/src/middleware.ts:46](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L46)

#### Returns

`void`

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/hono/src/middleware.ts:52](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L52)

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/hono/src/middleware.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/middleware.ts#L45)

#### Returns

`Promise`\<`void`\>
