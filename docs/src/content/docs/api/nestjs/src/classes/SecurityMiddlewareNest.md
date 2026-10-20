---
editUrl: false
next: false
prev: false
title: "SecurityMiddlewareNest"
---

Defined in: [packages/nestjs/src/guard-module.ts:54](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L54)

## Implements

- `NestMiddleware`
- [`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/)

## Constructors

### Constructor

> **new SecurityMiddlewareNest**(`components`): `SecurityMiddlewareNest`

Defined in: [packages/nestjs/src/guard-module.ts:61](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L61)

#### Parameters

##### components

[`SecurityMiddlewareComponents`](/guard-core-ts/api/core/src/interfaces/securitymiddlewarecomponents/)

#### Returns

`SecurityMiddlewareNest`

## Accessors

### agentStats

#### Get Signature

> **get** **agentStats**(): `object` & `Record`\<`string`, `unknown`\>

Defined in: [packages/nestjs/src/guard-module.ts:90](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L90)

##### Returns

`object` & `Record`\<`string`, `unknown`\>

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`agentStats`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#agentstats)

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `message`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/nestjs/src/guard-module.ts:99](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L99)

#### Parameters

##### statusCode

`number`

##### message

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`createErrorResponse`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#createerrorresponse)

***

### getInitializationStatus()

> **getInitializationStatus**(): `object`

Defined in: [packages/nestjs/src/guard-module.ts:74](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L74)

#### Returns

`object`

##### agent

> **agent**: `object`

###### agent.degraded

> **degraded**: `boolean`

###### agent.enabled

> **enabled**: `boolean`

##### initialized

> **initialized**: `boolean`

##### redis

> **redis**: `boolean`

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`getInitializationStatus`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#getinitializationstatus)

***

### markInitialized()

> **markInitialized**(): `void`

Defined in: [packages/nestjs/src/guard-module.ts:69](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L69)

#### Returns

`void`

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`markInitialized`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#markinitialized)

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/nestjs/src/guard-module.ts:86](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L86)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`refreshCloudIpRanges`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#refreshcloudipranges)

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/nestjs/src/guard-module.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L65)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GuardSurface`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/).[`reset`](/guard-core-ts/api/nestjs/src/interfaces/guardsurface/#reset)

***

### use()

> **use**(`req`, `res`, `next`): `Promise`\<`void`\>

Defined in: [packages/nestjs/src/guard-module.ts:103](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L103)

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
