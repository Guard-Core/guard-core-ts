---
editUrl: false
next: false
prev: false
title: "FastifyGuardResponse"
---

Defined in: [fastify/src/adapters.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L28)

## Implements

- [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

## Constructors

### Constructor

> **new FastifyGuardResponse**(`statusCode`, `content`): `FastifyGuardResponse`

Defined in: [fastify/src/adapters.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L32)

#### Parameters

##### statusCode

`number`

##### content

`string`

#### Returns

`FastifyGuardResponse`

## Properties

### statusCode

> `readonly` **statusCode**: `number`

Defined in: [fastify/src/adapters.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L32)

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`statusCode`](/guard-core-ts/api/core/src/interfaces/guardresponse/#statuscode)

## Accessors

### body

#### Get Signature

> **get** **body**(): `Uint8Array`\<`ArrayBufferLike`\> \| `null`

Defined in: [fastify/src/adapters.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L39)

##### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`body`](/guard-core-ts/api/core/src/interfaces/guardresponse/#body)

***

### bodyText

#### Get Signature

> **get** **bodyText**(): `string` \| `null`

Defined in: [fastify/src/adapters.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L40)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`bodyText`](/guard-core-ts/api/core/src/interfaces/guardresponse/#bodytext)

***

### headers

#### Get Signature

> **get** **headers**(): `Record`\<`string`, `string`\>

Defined in: [fastify/src/adapters.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L37)

##### Returns

`Record`\<`string`, `string`\>

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardresponse/#headers)

## Methods

### setHeader()

> **setHeader**(`name`, `value`): `void`

Defined in: [fastify/src/adapters.ts:38](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/fastify/src/adapters.ts#L38)

#### Parameters

##### name

`string`

##### value

`string`

#### Returns

`void`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`setHeader`](/guard-core-ts/api/core/src/interfaces/guardresponse/#setheader)
