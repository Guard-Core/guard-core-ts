---
editUrl: false
next: false
prev: false
title: "ExpressGuardRequest"
---

Defined in: [express/src/adapters.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L4)

## Implements

- [`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

## Constructors

### Constructor

> **new ExpressGuardRequest**(`req`): `ExpressGuardRequest`

Defined in: [express/src/adapters.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L8)

#### Parameters

##### req

`Request`

#### Returns

`ExpressGuardRequest`

## Accessors

### clientHost

#### Get Signature

> **get** **clientHost**(): `string` \| `null`

Defined in: [express/src/adapters.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L22)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`clientHost`](/guard-core-ts/api/core/src/interfaces/guardrequest/#clienthost)

***

### headers

#### Get Signature

> **get** **headers**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [express/src/adapters.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L23)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardrequest/#headers)

***

### method

#### Get Signature

> **get** **method**(): `string`

Defined in: [express/src/adapters.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L21)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`method`](/guard-core-ts/api/core/src/interfaces/guardrequest/#method)

***

### queryParams

#### Get Signature

> **get** **queryParams**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [express/src/adapters.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L24)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`queryParams`](/guard-core-ts/api/core/src/interfaces/guardrequest/#queryparams)

***

### scope

#### Get Signature

> **get** **scope**(): `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [express/src/adapters.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L27)

##### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`scope`](/guard-core-ts/api/core/src/interfaces/guardrequest/#scope)

***

### state

#### Get Signature

> **get** **state**(): [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [express/src/adapters.ts:26](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L26)

##### Returns

[`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`state`](/guard-core-ts/api/core/src/interfaces/guardrequest/#state)

***

### urlFull

#### Get Signature

> **get** **urlFull**(): `string`

Defined in: [express/src/adapters.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L19)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlFull`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlfull)

***

### urlPath

#### Get Signature

> **get** **urlPath**(): `string`

Defined in: [express/src/adapters.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L17)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlPath`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlpath)

***

### urlScheme

#### Get Signature

> **get** **urlScheme**(): `string`

Defined in: [express/src/adapters.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L18)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlscheme)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [express/src/adapters.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L25)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`body`](/guard-core-ts/api/core/src/interfaces/guardrequest/#body)

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [express/src/adapters.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L20)

#### Parameters

##### scheme

`string`

#### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlReplaceScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlreplacescheme)
