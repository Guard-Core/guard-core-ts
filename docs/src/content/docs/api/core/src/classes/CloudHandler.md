---
editUrl: false
next: false
prev: false
title: "CloudHandler"
---

Defined in: [packages/core/src/handlers/cloud.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L23)

## Constructors

### Constructor

> **new CloudHandler**(`logger`, `store?`): `CloudHandler`

Defined in: [packages/core/src/handlers/cloud.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L39)

#### Parameters

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

##### store?

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/) \| `null`

#### Returns

`CloudHandler`

## Properties

### agentHandler

> **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null` = `null`

Defined in: [packages/core/src/handlers/cloud.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L37)

## Methods

### getCloudProviderDetails()

> **getCloudProviderDetails**(`ip`, `providers`): \[`string`, `string`\] \| `null`

Defined in: [packages/core/src/handlers/cloud.ts:266](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L266)

#### Parameters

##### ip

`string`

##### providers

`Set`\<`string`\>

#### Returns

\[`string`, `string`\] \| `null`

***

### getStatus()

> **getStatus**(): `Record`\<`string`, \{ `entries`: `number`; `lastRefreshed`: `Date` \| `null`; `ready`: `boolean`; \}\>

Defined in: [packages/core/src/handlers/cloud.ts:193](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L193)

#### Returns

`Record`\<`string`, \{ `entries`: `number`; `lastRefreshed`: `Date` \| `null`; `ready`: `boolean`; \}\>

***

### getStore()

> **getStore**(): [`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/) \| `null`

Defined in: [packages/core/src/handlers/cloud.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L53)

#### Returns

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/) \| `null`

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:67](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L67)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`, `providers`, `ttl?`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:57](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L57)

#### Parameters

##### redisHandler

[`RedisManager`](/guard-core-ts/api/core/src/classes/redismanager/)

##### providers

`Set`\<`string`\>

##### ttl?

`number` = `3600`

#### Returns

`Promise`\<`void`\>

***

### isCloudIp()

> **isCloudIp**(`ip`, `providers`): `boolean`

Defined in: [packages/core/src/handlers/cloud.ts:245](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L245)

#### Parameters

##### ip

`string`

##### providers

`Set`\<`string`\>

#### Returns

`boolean`

***

### refresh()

> **refresh**(`providers`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:75](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L75)

#### Parameters

##### providers

`Set`\<`string`\>

#### Returns

`Promise`\<`void`\>

***

### refreshAsync()

> **refreshAsync**(`providers`, `ttl?`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:82](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L82)

#### Parameters

##### providers

`Set`\<`string`\>

##### ttl?

`number` = `3600`

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:315](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L315)

#### Returns

`Promise`\<`void`\>

***

### sendCloudDetectionEvent()

> **sendCloudDetectionEvent**(`ip`, `provider`, `network`, `actionTaken?`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/cloud.ts:292](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L292)

#### Parameters

##### ip

`string`

##### provider

`string`

##### network

`string`

##### actionTaken?

`string` = `'request_blocked'`

#### Returns

`Promise`\<`void`\>

***

### setStore()

> **setStore**(`store`): `void`

Defined in: [packages/core/src/handlers/cloud.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/cloud.ts#L49)

#### Parameters

##### store

[`CloudIpStoreProtocol`](/guard-core-ts/api/core/src/interfaces/cloudipstoreprotocol/) \| `null`

#### Returns

`void`
