---
editUrl: false
next: false
prev: false
title: "ExpressResponseFactory"
---

Defined in: [express/src/adapters.ts:50](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L50)

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

Defined in: [express/src/adapters.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L55)

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

Defined in: [express/src/adapters.ts:51](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/adapters.ts#L51)

#### Parameters

##### content

`string`

##### statusCode

`number`

#### Returns

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Implementation of

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/).[`createResponse`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/#createresponse)
