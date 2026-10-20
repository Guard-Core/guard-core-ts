---
editUrl: false
next: false
prev: false
title: "BehavioralProcessor"
---

Defined in: [packages/core/src/core/behavioral/processor.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L30)

## Constructors

### Constructor

> **new BehavioralProcessor**(`logger`, `eventBus`): `BehavioralProcessor`

Defined in: [packages/core/src/core/behavioral/processor.ts:35](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L35)

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

Defined in: [packages/core/src/core/behavioral/processor.ts:218](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L218)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`string`

***

### processGlobalReturnRules()

> **processGlobalReturnRules**(`request`, `response`, `clientIp`, `rules`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/behavioral/processor.ts:135](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L135)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### clientIp

`string`

##### rules

readonly [`BehaviorRule`](/guard-core-ts/api/core/src/classes/behaviorrule/)[]

#### Returns

`Promise`\<`void`\>

***

### processReturnRules()

> **processReturnRules**(`request`, `response`, `clientIp`, `routeConfig`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/behavioral/processor.ts:97](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L97)

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

Defined in: [packages/core/src/core/behavioral/processor.ts:64](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L64)

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

### setDefaultTracker()

> **setDefaultTracker**(`tracker`): `void`

Defined in: [packages/core/src/core/behavioral/processor.ts:48](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L48)

#### Parameters

##### tracker

[`BehaviorTracker`](/guard-core-ts/api/core/src/classes/behaviortracker/)

#### Returns

`void`

***

### setGuardDecorator()

> **setGuardDecorator**(`decorator`): `void`

Defined in: [packages/core/src/core/behavioral/processor.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L40)

#### Parameters

##### decorator

###### behaviorTracker

[`BehaviorTracker`](/guard-core-ts/api/core/src/classes/behaviortracker/)

#### Returns

`void`

***

### setSuspiciousCountsReader()

> **setSuspiciousCountsReader**(`reader`): `void`

Defined in: [packages/core/src/core/behavioral/processor.ts:52](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/behavioral/processor.ts#L52)

#### Parameters

##### reader

`SuspiciousCountsReader`

#### Returns

`void`
