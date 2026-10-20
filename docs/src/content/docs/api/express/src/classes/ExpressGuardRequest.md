---
editUrl: false
next: false
prev: false
title: "ExpressGuardRequest"
---

Defined in: [packages/express/src/adapters.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L31)

## Implements

- [`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

## Constructors

### Constructor

> **new ExpressGuardRequest**(`req`): `ExpressGuardRequest`

Defined in: [packages/express/src/adapters.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L37)

#### Parameters

##### req

`Request`

#### Returns

`ExpressGuardRequest`

## Accessors

### clientHost

#### Get Signature

> **get** **clientHost**(): `string` \| `null`

Defined in: [packages/express/src/adapters.ts:57](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L57)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`clientHost`](/guard-core-ts/api/core/src/interfaces/guardrequest/#clienthost)

***

### headers

#### Get Signature

> **get** **headers**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/express/src/adapters.ts:58](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L58)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardrequest/#headers)

***

### method

#### Get Signature

> **get** **method**(): `string`

Defined in: [packages/express/src/adapters.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L56)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`method`](/guard-core-ts/api/core/src/interfaces/guardrequest/#method)

***

### queryParams

#### Get Signature

> **get** **queryParams**(): `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/express/src/adapters.ts:59](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L59)

##### Returns

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`queryParams`](/guard-core-ts/api/core/src/interfaces/guardrequest/#queryparams)

***

### scope

#### Get Signature

> **get** **scope**(): `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/express/src/adapters.ts:62](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L62)

##### Returns

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`scope`](/guard-core-ts/api/core/src/interfaces/guardrequest/#scope)

***

### state

#### Get Signature

> **get** **state**(): [`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

Defined in: [packages/express/src/adapters.ts:61](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L61)

##### Returns

[`GuardRequestState`](/guard-core-ts/api/core/src/interfaces/guardrequeststate/)

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`state`](/guard-core-ts/api/core/src/interfaces/guardrequest/#state)

***

### urlFull

#### Get Signature

> **get** **urlFull**(): `string`

Defined in: [packages/express/src/adapters.ts:54](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L54)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlFull`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlfull)

***

### urlPath

#### Get Signature

> **get** **urlPath**(): `string`

Defined in: [packages/express/src/adapters.ts:52](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L52)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlPath`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlpath)

***

### urlScheme

#### Get Signature

> **get** **urlScheme**(): `string`

Defined in: [packages/express/src/adapters.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L53)

##### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlscheme)

## Methods

### body()

> **body**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [packages/express/src/adapters.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L60)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`body`](/guard-core-ts/api/core/src/interfaces/guardrequest/#body)

***

### urlReplaceScheme()

> **urlReplaceScheme**(`scheme`): `string`

Defined in: [packages/express/src/adapters.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L55)

#### Parameters

##### scheme

`string`

#### Returns

`string`

#### Implementation of

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/).[`urlReplaceScheme`](/guard-core-ts/api/core/src/interfaces/guardrequest/#urlreplacescheme)
