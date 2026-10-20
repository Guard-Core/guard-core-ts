---
editUrl: false
next: false
prev: false
title: "GuardSurface"
---

Defined in: [packages/nestjs/src/guard-module.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L40)

## Properties

### agentStats

> `readonly` **agentStats**: `object` & `Record`\<`string`, `unknown`\>

Defined in: [packages/nestjs/src/guard-module.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L49)

#### Type Declaration

##### degraded

> **degraded**: `boolean`

##### enabled

> **enabled**: `boolean`

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `message`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/nestjs/src/guard-module.ts:50](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L50)

#### Parameters

##### statusCode

`number`

##### message

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### getInitializationStatus()

> **getInitializationStatus**(): `object`

Defined in: [packages/nestjs/src/guard-module.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L43)

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

***

### markInitialized()

> **markInitialized**(): `void`

Defined in: [packages/nestjs/src/guard-module.ts:42](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L42)

#### Returns

`void`

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/nestjs/src/guard-module.ts:48](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L48)

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/nestjs/src/guard-module.ts:41](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/nestjs/src/guard-module.ts#L41)

#### Returns

`Promise`\<`void`\>
