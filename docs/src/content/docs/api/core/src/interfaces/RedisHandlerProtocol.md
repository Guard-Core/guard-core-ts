---
editUrl: false
next: false
prev: false
title: "RedisHandlerProtocol"
---

Defined in: [core/src/protocols/redis.ts:1](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L1)

## Methods

### delete()

> **delete**(`namespace`, `key`): `Promise`\<`number` \| `null`\>

Defined in: [core/src/protocols/redis.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L4)

#### Parameters

##### namespace

`string`

##### key

`string`

#### Returns

`Promise`\<`number` \| `null`\>

***

### getConnection()

> **getConnection**(): `AsyncDisposable`

Defined in: [core/src/protocols/redis.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L7)

#### Returns

`AsyncDisposable`

***

### getKey()

> **getKey**(`namespace`, `key`): `Promise`\<`unknown`\>

Defined in: [core/src/protocols/redis.ts:2](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L2)

#### Parameters

##### namespace

`string`

##### key

`string`

#### Returns

`Promise`\<`unknown`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [core/src/protocols/redis.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L6)

#### Returns

`Promise`\<`void`\>

***

### keys()

> **keys**(`pattern`): `Promise`\<`string`[] \| `null`\>

Defined in: [core/src/protocols/redis.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L5)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`string`[] \| `null`\>

***

### setKey()

> **setKey**(`namespace`, `key`, `value`, `ttl?`): `Promise`\<`boolean` \| `null`\>

Defined in: [core/src/protocols/redis.ts:3](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/redis.ts#L3)

#### Parameters

##### namespace

`string`

##### key

`string`

##### value

`unknown`

##### ttl?

`number` \| `null`

#### Returns

`Promise`\<`boolean` \| `null`\>
