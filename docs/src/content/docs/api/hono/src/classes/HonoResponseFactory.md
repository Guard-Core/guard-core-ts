---
editUrl: false
next: false
prev: false
title: "HonoResponseFactory"
---

Defined in: [hono/src/adapters.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/hono/src/adapters.ts#L40)

## Implements

- [`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

## Constructors

### Constructor

> **new HonoResponseFactory**(): `HonoResponseFactory`

#### Returns

`HonoResponseFactory`

## Methods

### createRedirectResponse()

> **createRedirectResponse**(`url`, `statusCode`): [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

Defined in: [hono/src/adapters.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/hono/src/adapters.ts#L45)

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

Defined in: [hono/src/adapters.ts:41](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/hono/src/adapters.ts#L41)

#### Parameters

##### content

`string`

##### statusCode

`number`

#### Returns

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Implementation of

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/).[`createResponse`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/#createresponse)
