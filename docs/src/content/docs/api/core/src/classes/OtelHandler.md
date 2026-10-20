---
editUrl: false
next: false
prev: false
title: "OtelHandler"
---

Defined in: [packages/core/src/core/events/otel-handler.ts:85](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L85)

## Implements

- [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

## Constructors

### Constructor

> **new OtelHandler**(`config`, `logger?`): `OtelHandler`

Defined in: [packages/core/src/core/events/otel-handler.ts:92](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L92)

#### Parameters

##### config

[`OtelHandlerConfig`](/guard-core-ts/api/core/src/interfaces/otelhandlerconfig/)

##### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/) = `defaultLogger`

#### Returns

`OtelHandler`

## Properties

### config

> `readonly` **config**: [`OtelHandlerConfig`](/guard-core-ts/api/core/src/interfaces/otelhandlerconfig/)

Defined in: [packages/core/src/core/events/otel-handler.ts:88](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L88)

Exposed for diagnostics and tests (service name, resource attributes,
 exporter endpoint the application must mirror into its SDK setup).

## Methods

### flushBuffer()

> **flushBuffer**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:181](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L181)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`flushBuffer`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#flushbuffer)

***

### getDynamicRules()

> **getDynamicRules**(): `Promise`\<`unknown`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:183](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L183)

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`getDynamicRules`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#getdynamicrules)

***

### healthCheck()

> **healthCheck**(): `Promise`\<`boolean`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:187](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L187)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`healthCheck`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#healthcheck)

***

### initializeRedis()

> **initializeRedis**(`_redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:179](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L179)

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

Defined in: [packages/core/src/core/events/otel-handler.ts:114](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L114)

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

Defined in: [packages/core/src/core/events/otel-handler.ts:155](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L155)

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

Defined in: [packages/core/src/core/events/otel-handler.ts:98](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L98)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`start`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#start)

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:109](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L109)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/).[`stop`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/#stop)
