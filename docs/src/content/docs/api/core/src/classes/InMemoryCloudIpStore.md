---
editUrl: false
next: false
prev: false
title: "InMemoryCloudIpStore"
---

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L40)

## Implements

- [`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/)

## Constructors

### Constructor

> **new InMemoryCloudIpStore**(): `InMemoryCloudIpStore`

#### Returns

`InMemoryCloudIpStore`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L65)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/).[`clear`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/#clear)

***

### get()

> **get**(`provider`): `Promise`\<`Set`\<`string`\> \| `null`\>

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L44)

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

Defined in: [packages/core/src/handlers/cloud-ip-stores.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud-ip-stores.ts#L56)

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
