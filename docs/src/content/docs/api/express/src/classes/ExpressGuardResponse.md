---
editUrl: false
next: false
prev: false
title: "ExpressGuardResponse"
---

Defined in: [packages/express/src/adapters.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L65)

## Implements

- [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

## Constructors

### Constructor

> **new ExpressGuardResponse**(`statusCode`, `content`): `ExpressGuardResponse`

Defined in: [packages/express/src/adapters.ts:69](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L69)

#### Parameters

##### statusCode

`number`

##### content

`string`

#### Returns

`ExpressGuardResponse`

## Properties

### statusCode

> `readonly` **statusCode**: `number`

Defined in: [packages/express/src/adapters.ts:70](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L70)

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`statusCode`](/guard-core-ts/api/core/src/interfaces/guardresponse/#statuscode)

## Accessors

### body

#### Get Signature

> **get** **body**(): `Uint8Array`\<`ArrayBufferLike`\> \| `null`

Defined in: [packages/express/src/adapters.ts:82](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L82)

##### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`body`](/guard-core-ts/api/core/src/interfaces/guardresponse/#body)

***

### bodyText

#### Get Signature

> **get** **bodyText**(): `string` \| `null`

Defined in: [packages/express/src/adapters.ts:86](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L86)

##### Returns

`string` \| `null`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`bodyText`](/guard-core-ts/api/core/src/interfaces/guardresponse/#bodytext)

***

### headers

#### Get Signature

> **get** **headers**(): `Record`\<`string`, `string`\>

Defined in: [packages/express/src/adapters.ts:80](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L80)

##### Returns

`Record`\<`string`, `string`\>

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`headers`](/guard-core-ts/api/core/src/interfaces/guardresponse/#headers)

## Methods

### setHeader()

> **setHeader**(`name`, `value`): `void`

Defined in: [packages/express/src/adapters.ts:81](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L81)

#### Parameters

##### name

`string`

##### value

`string`

#### Returns

`void`

#### Implementation of

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/).[`setHeader`](/guard-core-ts/api/core/src/interfaces/guardresponse/#setheader)
