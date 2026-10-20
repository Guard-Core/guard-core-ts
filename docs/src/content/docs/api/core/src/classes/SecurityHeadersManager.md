---
editUrl: false
next: false
prev: false
title: "SecurityHeadersManager"
---

Defined in: [packages/core/src/handlers/security-headers.ts:59](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L59)

## Constructors

### Constructor

> **new SecurityHeadersManager**(`logger`): `SecurityHeadersManager`

Defined in: [packages/core/src/handlers/security-headers.ts:77](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L77)

#### Parameters

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`SecurityHeadersManager`

## Methods

### configure()

> **configure**(`options`): `void`

Defined in: [packages/core/src/handlers/security-headers.ts:137](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L137)

#### Parameters

##### options

###### contentTypeOptions?

`string`

###### corsAllowCredentials?

`boolean`

###### corsAllowHeaders?

`string`[]

###### corsAllowMethods?

`string`[]

###### corsOrigins?

`string`[]

###### csp?

`Record`\<`string`, `string`[]\> \| `null`

###### customHeaders?

`Record`\<`string`, `string`\> \| `null`

###### enabled?

`boolean`

###### frameOptions?

`string`

###### hstsIncludeSubdomains?

`boolean`

###### hstsMaxAge?

`number`

###### hstsPreload?

`boolean`

###### permissionsPolicy?

`string`

###### referrerPolicy?

`string`

###### xssProtection?

`string`

#### Returns

`void`

***

### getCorsHeaders()

> **getCorsHeaders**(`origin`): `Record`\<`string`, `string`\>

Defined in: [packages/core/src/handlers/security-headers.ts:323](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L323)

#### Parameters

##### origin

`string`

#### Returns

`Record`\<`string`, `string`\>

***

### getHeaders()

> **getHeaders**(`requestPath`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [packages/core/src/handlers/security-headers.ts:221](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L221)

#### Parameters

##### requestPath

`string`

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/security-headers.ts:85](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L85)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/security-headers.ts:79](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L79)

#### Parameters

##### redisHandler

[`RedisManager`](/guard-core-ts/api/core/src/classes/redismanager/)

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/security-headers.ts:353](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L353)

#### Returns

`Promise`\<`void`\>

***

### validateCspReport()

> **validateCspReport**(`report`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/handlers/security-headers.ts:276](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/security-headers.ts#L276)

#### Parameters

##### report

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`boolean`\>
