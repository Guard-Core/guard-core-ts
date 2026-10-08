---
editUrl: false
next: false
prev: false
title: "SecurityMiddlewareNest"
---

Defined in: [nestjs/src/guard-module.ts:26](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/nestjs/src/guard-module.ts#L26)

## Implements

- `NestMiddleware`

## Constructors

### Constructor

> **new SecurityMiddlewareNest**(`components`): `SecurityMiddlewareNest`

Defined in: [nestjs/src/guard-module.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/nestjs/src/guard-module.ts#L27)

#### Parameters

##### components

[`SecurityMiddlewareComponents`](/guard-core-ts/api/core/src/interfaces/securitymiddlewarecomponents/)

#### Returns

`SecurityMiddlewareNest`

## Methods

### use()

> **use**(`req`, `res`, `next`): `Promise`\<`void`\>

Defined in: [nestjs/src/guard-module.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/nestjs/src/guard-module.ts#L31)

#### Parameters

##### req

`Request`

##### res

`Response`

##### next

`NextFunction`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`NestMiddleware.use`
