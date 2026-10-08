---
editUrl: false
next: false
prev: false
title: "GeoIPHandler"
---

Defined in: [core/src/protocols/geo-ip.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L4)

## Properties

### isInitialized

> `readonly` **isInitialized**: `boolean`

Defined in: [core/src/protocols/geo-ip.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L5)

## Methods

### getCountry()

> **getCountry**(`ip`): `string` \| `null`

Defined in: [core/src/protocols/geo-ip.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L9)

#### Parameters

##### ip

`string`

#### Returns

`string` \| `null`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [core/src/protocols/geo-ip.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L6)

#### Returns

`Promise`\<`void`\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [core/src/protocols/geo-ip.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L8)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [core/src/protocols/geo-ip.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/geo-ip.ts#L7)

#### Parameters

##### redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>
