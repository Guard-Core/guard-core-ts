---
editUrl: false
next: false
prev: false
title: "NestResponseFactory"
---

Defined in: [packages/nestjs/src/adapters.ts:81](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L81)

## Implements

- [`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

## Constructors

### Constructor

> **new NestResponseFactory**(): `NestResponseFactory`

#### Returns

`NestResponseFactory`

## Methods

### createRedirectResponse()

> **createRedirectResponse**(`url`, `statusCode`): [`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

Defined in: [packages/nestjs/src/adapters.ts:86](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L86)

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

Defined in: [packages/nestjs/src/adapters.ts:82](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/adapters.ts#L82)

#### Parameters

##### content

`string`

##### statusCode

`number`

#### Returns

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Implementation of

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/).[`createResponse`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/#createresponse)
