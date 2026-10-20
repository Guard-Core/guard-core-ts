---
editUrl: false
next: false
prev: false
title: "GuardSurface"
---

Defined in: [packages/fastify/src/plugin.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L22)

## Properties

### agentStats

> `readonly` **agentStats**: `object` & `Record`\<`string`, `unknown`\>

Defined in: [packages/fastify/src/plugin.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L31)

#### Type Declaration

##### degraded

> **degraded**: `boolean`

##### enabled

> **enabled**: `boolean`

## Methods

### addStatusRoute()

> **addStatusRoute**(`path?`): `void`

Defined in: [packages/fastify/src/plugin.ts:33](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L33)

#### Parameters

##### path?

`string`

#### Returns

`void`

***

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `message`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/fastify/src/plugin.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L32)

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

Defined in: [packages/fastify/src/plugin.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L25)

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

Defined in: [packages/fastify/src/plugin.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L24)

#### Returns

`void`

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/fastify/src/plugin.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L30)

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/fastify/src/plugin.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/plugin.ts#L23)

#### Returns

`Promise`\<`void`\>
