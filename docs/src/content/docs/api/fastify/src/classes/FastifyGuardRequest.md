---
editUrl: false
next: false
prev: false
title: "FastifyGuardRequest"
---

Defined in: [packages/fastify/src/adapters.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L31)

## Implements

- [`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

## Constructors

### Constructor

> **new FastifyGuardRequest**(`req`): `FastifyGuardRequest`

Defined in: [packages/fastify/src/adapters.ts:36](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L36)

#### Parameters

##### req

`FastifyRequest`

#### Returns

`FastifyGuardRequest`

## Accessors

### clientHost

#### Get Signature

> **get** **clientHost**(): `string` \| `null`

Defined in: [packages/fastify/src/adapters.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L49)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`clientHost`](/guard-core-ts/api/core/src/interfaces/guardrequest/#clienthost)

***

### headers

#### Get Signature

> **get** **headers**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/fastify/src/adapters.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L55)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardrequest/#headers)

***

### method

#### Get Signature

> **get** **method**(): `string`

Defined in: [packages/fastify/src/adapters.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L45)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`method`](/guard-core-ts/api/core/src/interfaces/guardrequest/#method)

***

### queryParams

#### Get Signature

> **get** **queryParams**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/fastify/src/adapters.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L56)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`queryParams`](/guard-core-ts/api/core/src/interfaces/guardrequest/#queryparams)

***

### scope

#### Get Signature

> **get** **scope**(): `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/fastify/src/adapters.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L65)

##### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`scope`](/guard-core-ts/api/core/src/interfaces/guardrequest/#scope)

***

### state

#### Get Signature

> **get** **state**(): [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [packages/fastify/src/adapters.ts:64](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L64)

##### Returns

[`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`state`](/guard-core-ts/api/core/src/interfaces/guardrequest/#state)

***

### urlFull

#### Get Signature

> **get** **urlFull**(): `string`

Defined in: [packages/fastify/src/adapters.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L43)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlFull`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlfull)

***

### urlPath

#### Get Signature

> **get** **urlPath**(): `string`

Defined in: [packages/fastify/src/adapters.ts:41](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L41)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlPath`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlpath)

***

### urlScheme

#### Get Signature

> **get** **urlScheme**(): `string`

Defined in: [packages/fastify/src/adapters.ts:42](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L42)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlscheme)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [packages/fastify/src/adapters.ts:57](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L57)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`body`](/guard-core-ts/api/core/src/interfaces/guardrequest/#body)

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [packages/fastify/src/adapters.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/fastify/src/adapters.ts#L44)

#### Parameters

##### scheme

`string`

#### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlReplaceScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlreplacescheme)
