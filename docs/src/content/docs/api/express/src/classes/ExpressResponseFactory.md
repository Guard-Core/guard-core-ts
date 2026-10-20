---
editUrl: false
next: false
prev: false
title: "ExpressResponseFactory"
---

Defined in: [packages/express/src/adapters.ts:91](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L91)

## Implements

- [`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

## Constructors

### Constructor

> **new ExpressResponseFactory**(): `ExpressResponseFactory`

#### Returns

`ExpressResponseFactory`

## Methods

### createRedirectResponse()

> **createRedirectResponse**(`url`, `statusCode`): [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

Defined in: [packages/express/src/adapters.ts:96](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L96)

#### Parameters

##### url

`string`

##### statusCode

`number`

#### Returns

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Implementation of

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/).[`createRedirectResponse`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/#createredirectresponse)

***

### createResponse()

> **createResponse**(`content`, `statusCode`): [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

Defined in: [packages/express/src/adapters.ts:92](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/adapters.ts#L92)

#### Parameters

##### content

`string`

##### statusCode

`number`

#### Returns

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Implementation of

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/).[`createResponse`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/#createresponse)
