---
editUrl: false
next: false
prev: false
title: "AgentHandlerProtocol"
---

Defined in: [core/src/protocols/agent.ts:3](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L3)

## Methods

### flushBuffer()

> **flushBuffer**(): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L9)

#### Returns

`Promise`\<`void`\>

***

### getDynamicRules()

> **getDynamicRules**(): `Promise`\<`unknown`\>

Defined in: [core/src/protocols/agent.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L10)

#### Returns

`Promise`\<`unknown`\>

***

### healthCheck()

> **healthCheck**(): `Promise`\<`boolean`\>

Defined in: [core/src/protocols/agent.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L11)

#### Returns

`Promise`\<`boolean`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L4)

#### Parameters

##### redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### sendEvent()

> **sendEvent**(`event`): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L5)

#### Parameters

##### event

`unknown`

#### Returns

`Promise`\<`void`\>

***

### sendMetric()

> **sendMetric**(`metric`): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L6)

#### Parameters

##### metric

`unknown`

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L7)

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [core/src/protocols/agent.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/agent.ts#L8)

#### Returns

`Promise`\<`void`\>
