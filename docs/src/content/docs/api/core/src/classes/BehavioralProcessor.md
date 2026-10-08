---
editUrl: false
next: false
prev: false
title: "BehavioralProcessor"
---

Defined in: [core/src/core/behavioral/processor.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L8)

## Constructors

### Constructor

> **new BehavioralProcessor**(`logger`, `eventBus`): `BehavioralProcessor`

Defined in: [core/src/core/behavioral/processor.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L11)

#### Parameters

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

##### eventBus

[`SecurityEventBus`](/guard-core-ts/api/core/src/classes/securityeventbus/)

#### Returns

`BehavioralProcessor`

## Methods

### getEndpointId()

> **getEndpointId**(`request`): `string`

Defined in: [core/src/core/behavioral/processor.ts:92](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L92)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`string`

***

### processReturnRules()

> **processReturnRules**(`request`, `response`, `clientIp`, `routeConfig`): `Promise`\<`void`\>

Defined in: [core/src/core/behavioral/processor.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L55)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### clientIp

`string`

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

#### Returns

`Promise`\<`void`\>

***

### processUsageRules()

> **processUsageRules**(`request`, `clientIp`, `routeConfig`): `Promise`\<`void`\>

Defined in: [core/src/core/behavioral/processor.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L20)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### clientIp

`string`

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

#### Returns

`Promise`\<`void`\>

***

### setGuardDecorator()

> **setGuardDecorator**(`decorator`): `void`

Defined in: [core/src/core/behavioral/processor.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/behavioral/processor.ts#L16)

#### Parameters

##### decorator

###### behaviorTracker

`BehaviorTracker`

#### Returns

`void`
