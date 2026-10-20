---
editUrl: false
next: false
prev: false
title: "GuardRequest"
---

Defined in: [packages/core/src/protocols/request.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L14)

## Properties

### clientHost

> `readonly` **clientHost**: `string` \| `null`

Defined in: [packages/core/src/protocols/request.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L20)

***

### headers

> `readonly` **headers**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/core/src/protocols/request.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L21)

***

### method

> `readonly` **method**: `string`

Defined in: [packages/core/src/protocols/request.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L19)

***

### queryParams

> `readonly` **queryParams**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/core/src/protocols/request.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L22)

***

### scope

> `readonly` **scope**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/core/src/protocols/request.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L30)

***

### state

> `readonly` **state**: [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [packages/core/src/protocols/request.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L29)

***

### urlFull

> `readonly` **urlFull**: `string`

Defined in: [packages/core/src/protocols/request.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L17)

***

### urlPath

> `readonly` **urlPath**: `string`

Defined in: [packages/core/src/protocols/request.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L15)

***

### urlScheme

> `readonly` **urlScheme**: `string`

Defined in: [packages/core/src/protocols/request.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L16)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [packages/core/src/protocols/request.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L23)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### readBodyPrefix()?

> `optional` **readBodyPrefix**(`maxBytes`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [packages/core/src/protocols/request.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L28)

Optional bounded read: return at most maxBytes of the body without
 consuming the whole stream. Adapters that implement it let the bounded
 body reader cap the fetch itself instead of trimming after the fact
 (the reference's read_body_prefix protocol).

#### Parameters

##### maxBytes

`number`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [packages/core/src/protocols/request.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/request.ts#L18)

#### Parameters

##### scheme

`string`

#### Returns

`string`
