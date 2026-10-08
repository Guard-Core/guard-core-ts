---
editUrl: false
next: false
prev: false
title: "FastifyGuardRequest"
---

Defined in: [fastify/src/adapters.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L4)

## Implements

- [`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

## Constructors

### Constructor

> **new FastifyGuardRequest**(`req`): `FastifyGuardRequest`

Defined in: [fastify/src/adapters.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L7)

#### Parameters

##### req

`FastifyRequest`

#### Returns

`FastifyGuardRequest`

## Accessors

### clientHost

#### Get Signature

> **get** **clientHost**(): `string` \| `null`

Defined in: [fastify/src/adapters.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L14)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`clientHost`](/guard-core-ts/api/core/src/interfaces/guardrequest/#clienthost)

***

### headers

#### Get Signature

> **get** **headers**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [fastify/src/adapters.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L15)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardrequest/#headers)

***

### method

#### Get Signature

> **get** **method**(): `string`

Defined in: [fastify/src/adapters.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L13)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`method`](/guard-core-ts/api/core/src/interfaces/guardrequest/#method)

***

### queryParams

#### Get Signature

> **get** **queryParams**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [fastify/src/adapters.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L16)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`queryParams`](/guard-core-ts/api/core/src/interfaces/guardrequest/#queryparams)

***

### scope

#### Get Signature

> **get** **scope**(): `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [fastify/src/adapters.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L25)

##### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`scope`](/guard-core-ts/api/core/src/interfaces/guardrequest/#scope)

***

### state

#### Get Signature

> **get** **state**(): [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [fastify/src/adapters.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L24)

##### Returns

[`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`state`](/guard-core-ts/api/core/src/interfaces/guardrequest/#state)

***

### urlFull

#### Get Signature

> **get** **urlFull**(): `string`

Defined in: [fastify/src/adapters.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L11)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlFull`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlfull)

***

### urlPath

#### Get Signature

> **get** **urlPath**(): `string`

Defined in: [fastify/src/adapters.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L9)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlPath`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlpath)

***

### urlScheme

#### Get Signature

> **get** **urlScheme**(): `string`

Defined in: [fastify/src/adapters.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L10)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlscheme)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [fastify/src/adapters.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L17)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`body`](/guard-core-ts/api/core/src/interfaces/guardrequest/#body)

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [fastify/src/adapters.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L12)

#### Parameters

##### scheme

`string`

#### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlReplaceScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlreplacescheme)
