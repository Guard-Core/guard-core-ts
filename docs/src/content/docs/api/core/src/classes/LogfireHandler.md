---
editUrl: false
next: false
prev: false
title: "LogfireHandler"
---

Defined in: [packages/core/src/core/events/logfire-handler.ts:66](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L66)

## Implements

- [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

## Constructors

### Constructor

> **new LogfireHandler**(`config`, `logger?`): `LogfireHandler`

Defined in: [packages/core/src/core/events/logfire-handler.ts:73](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L73)

#### Parameters

##### config

[`LogfireHandlerConfig`](/guard-core-ts/api/core/src/interfaces/logfirehandlerconfig/)

##### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/) = `defaultLogger`

#### Returns

`LogfireHandler`

## Methods

### flushBuffer()

> **flushBuffer**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:161](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L161)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`flushBuffer`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#flushbuffer)

***

### getDynamicRules()

> **getDynamicRules**(): `Promise`\<`unknown`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:163](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L163)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`getDynamicRules`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#getdynamicrules)

***

### healthCheck()

> **healthCheck**(): `Promise`\<`boolean`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:167](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L167)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`healthCheck`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#healthcheck)

***

### initializeRedis()

> **initializeRedis**(`_redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:159](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L159)

#### Parameters

##### \_redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`initializeRedis`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#initializeredis)

***

### sendEvent()

> **sendEvent**(`event`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:108](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L108)

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

Defined in: [packages/core/src/core/events/logfire-handler.ts:139](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L139)

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

Defined in: [packages/core/src/core/events/logfire-handler.ts:79](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L79)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`start`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#start)

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:99](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L99)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`stop`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#stop)
