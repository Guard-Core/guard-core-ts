---
editUrl: false
next: false
prev: false
title: "RedisCloudIpStore"
---

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:74](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L74)

## Implements

- [`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/)

## Constructors

### Constructor

> **new RedisCloudIpStore**(`redis`, `keyPrefix?`): `RedisCloudIpStore`

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:75](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L75)

#### Parameters

##### redis

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

##### keyPrefix?

`string` = `'cloud_ip_v2'`

#### Returns

`RedisCloudIpStore`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:100](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L100)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/).[`clear`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/#clear)

***

### get()

> **get**(`provider`): `Promise`\<`Set`\<`string`\> \| `null`\>

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:80](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L80)

#### Parameters

##### provider

`string`

#### Returns

`Promise`\<`Set`\<`string`\> \| `null`\>

#### Implementation of

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/).[`get`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/#get)

***

### set()

> **set**(`provider`, `ranges`, `ttl?`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:93](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L93)

#### Parameters

##### provider

`string`

##### ranges

`Set`\<`string`\>

##### ttl?

`number` \| `null`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/).[`set`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/#set)
