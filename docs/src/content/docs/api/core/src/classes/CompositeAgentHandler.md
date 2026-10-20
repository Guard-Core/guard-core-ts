---
editUrl: false
next: false
prev: false
title: "CompositeAgentHandler"
---

Defined in: [packages/core/src/core/events/composite-handler.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L21)

## Implements

- [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

## Constructors

### Constructor

> **new CompositeAgentHandler**(`handlers`, `options?`): `CompositeAgentHandler`

Defined in: [packages/core/src/core/events/composite-handler.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L29)

#### Parameters

##### handlers

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)[]

##### options?

###### enricher?

[`AgentEventEnricher`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/) \| `null`

###### eventFilter?

[`EventFilter`](/guard-core-ts/api/core/src/classes/eventfilter/)

###### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`CompositeAgentHandler`

## Accessors

### isDegraded

#### Get Signature

> **get** **isDegraded**(): `boolean`

Defined in: [packages/core/src/core/events/composite-handler.ts:47](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L47)

##### Returns

`boolean`

***

### isStarted

#### Get Signature

> **get** **isStarted**(): `boolean`

Defined in: [packages/core/src/core/events/composite-handler.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L43)

##### Returns

`boolean`

## Methods

### flushBuffer()

> **flushBuffer**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:123](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L123)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`flushBuffer`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#flushbuffer)

***

### getDynamicRules()

> **getDynamicRules**(): `Promise`\<`unknown`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:133](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L133)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`getDynamicRules`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#getdynamicrules)

***

### getFailedHandlers()

> **getFailedHandlers**(): `string`[]

Defined in: [packages/core/src/core/events/composite-handler.ts:51](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L51)

#### Returns

`string`[]

***

### healthCheck()

> **healthCheck**(): `Promise`\<`boolean`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:145](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L145)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`healthCheck`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#healthcheck)

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:89](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L89)

#### Parameters

##### redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`initializeRedis`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#initializeredis)

***

### sendEvent()

> **sendEvent**(`event`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L55)

#### Parameters

##### event

`unknown`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`sendEvent`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#sendevent)

***

### sendMetric()

> **sendMetric**(`metric`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:72](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L72)

#### Parameters

##### metric

`unknown`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`sendMetric`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#sendmetric)

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:99](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L99)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`start`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#start)

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/composite-handler.ts:113](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/composite-handler.ts#L113)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`stop`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#stop)
