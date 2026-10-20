---
editUrl: false
next: false
prev: false
title: "GeoIPHandler"
---

Defined in: [packages/core/src/protocols/geo-ip.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L4)

## Properties

### isInitialized

> `readonly` **isInitialized**: `boolean`

Defined in: [packages/core/src/protocols/geo-ip.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L5)

## Methods

### close()

> **close**(): `void`

Defined in: [packages/core/src/protocols/geo-ip.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L13)

The reference close: release the reader.

#### Returns

`void`

***

### getCountry()

> **getCountry**(`ip`): `string` \| `null`

Defined in: [packages/core/src/protocols/geo-ip.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L9)

#### Parameters

##### ip

`string`

#### Returns

`string` \| `null`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/geo-ip.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L6)

#### Returns

`Promise`\<`void`\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/geo-ip.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L8)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/geo-ip.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L7)

#### Parameters

##### redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### refresh()

> **refresh**(): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/geo-ip.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/geo-ip.ts#L11)

The reference refresh: re-download and swap the reader.

#### Returns

`Promise`\<`void`\>
