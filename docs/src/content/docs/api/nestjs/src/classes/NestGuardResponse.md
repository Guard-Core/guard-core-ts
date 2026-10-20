---
editUrl: false
next: false
prev: false
title: "NestGuardResponse"
---

Defined in: [packages/nestjs/src/adapters.ts:63](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L63)

## Implements

- [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

## Constructors

### Constructor

> **new NestGuardResponse**(`statusCode`, `content`): `NestGuardResponse`

Defined in: [packages/nestjs/src/adapters.ts:67](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L67)

#### Parameters

##### statusCode

`number`

##### content

`string`

#### Returns

`NestGuardResponse`

## Properties

### statusCode

> `readonly` **statusCode**: `number`

Defined in: [packages/nestjs/src/adapters.ts:67](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L67)

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`statusCode`](/guard-core-ts/api/core/src/interfaces/guardresponse/#statuscode)

## Accessors

### body

#### Get Signature

> **get** **body**(): `Uint8Array`\<`ArrayBufferLike`\> \| `null`

Defined in: [packages/nestjs/src/adapters.ts:77](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L77)

##### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`body`](/guard-core-ts/api/core/src/interfaces/guardresponse/#body)

***

### bodyText

#### Get Signature

> **get** **bodyText**(): `string` \| `null`

Defined in: [packages/nestjs/src/adapters.ts:78](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L78)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`bodyText`](/guard-core-ts/api/core/src/interfaces/guardresponse/#bodytext)

***

### headers

#### Get Signature

> **get** **headers**(): `Record`\<`string`, `string`\>

Defined in: [packages/nestjs/src/adapters.ts:75](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L75)

##### Returns

`Record`\<`string`, `string`\>

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardresponse/#headers)

## Methods

### setHeader()

> **setHeader**(`name`, `value`): `void`

Defined in: [packages/nestjs/src/adapters.ts:76](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L76)

#### Parameters

##### name

`string`

##### value

`string`

#### Returns

`void`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`setHeader`](/guard-core-ts/api/core/src/interfaces/guardresponse/#setheader)
