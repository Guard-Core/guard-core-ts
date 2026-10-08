---
editUrl: false
next: false
prev: false
title: "GuardRequest"
---

Defined in: [core/src/protocols/request.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L8)

## Properties

### clientHost

> `readonly` **clientHost**: `string` \| `null`

Defined in: [core/src/protocols/request.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L14)

***

### headers

> `readonly` **headers**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [core/src/protocols/request.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L15)

***

### method

> `readonly` **method**: `string`

Defined in: [core/src/protocols/request.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L13)

***

### queryParams

> `readonly` **queryParams**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [core/src/protocols/request.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L16)

***

### scope

> `readonly` **scope**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [core/src/protocols/request.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L19)

***

### state

> `readonly` **state**: [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [core/src/protocols/request.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L18)

***

### urlFull

> `readonly` **urlFull**: `string`

Defined in: [core/src/protocols/request.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L11)

***

### urlPath

> `readonly` **urlPath**: `string`

Defined in: [core/src/protocols/request.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L9)

***

### urlScheme

> `readonly` **urlScheme**: `string`

Defined in: [core/src/protocols/request.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L10)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [core/src/protocols/request.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L17)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [core/src/protocols/request.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/request.ts#L12)

#### Parameters

##### scheme

`string`

#### Returns

`string`
