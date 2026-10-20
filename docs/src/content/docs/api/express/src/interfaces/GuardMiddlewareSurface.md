---
editUrl: false
next: false
prev: false
title: "GuardMiddlewareSurface"
---

Defined in: [packages/express/src/middleware.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L23)

## Properties

### agentStats

> **agentStats**: `object` & `Record`\<`string`, `unknown`\>

Defined in: [packages/express/src/middleware.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L37)

The reference agent_stats.

#### Type Declaration

##### degraded

> **degraded**: `boolean`

##### enabled

> **enabled**: `boolean`

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `message`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/express/src/middleware.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L39)

The reference create_error_response.

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

Defined in: [packages/express/src/middleware.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L29)

The reference get_initialization_status.

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

Defined in: [packages/express/src/middleware.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L27)

The reference mark_initialized.

#### Returns

`void`

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/express/src/middleware.ts:35](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L35)

The reference refresh_cloud_ip_ranges.

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/express/src/middleware.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/express/src/middleware.ts#L25)

The reference reset(): clear the rate-limit tier state.

#### Returns

`Promise`\<`void`\>
