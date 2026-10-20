---
editUrl: false
next: false
prev: false
title: "EventFilter"
---

Defined in: [packages/core/src/core/events/event-filter.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L20)

## Constructors

### Constructor

> **new EventFilter**(`mutedEventTypes?`, `mutedMetricTypes?`): `EventFilter`

Defined in: [packages/core/src/core/events/event-filter.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L24)

#### Parameters

##### mutedEventTypes?

`Iterable`\<`string`\> = `[]`

##### mutedMetricTypes?

`Iterable`\<`string`\> = `[]`

#### Returns

`EventFilter`

## Properties

### mutedEventTypes

> `readonly` **mutedEventTypes**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/events/event-filter.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L21)

***

### mutedMetricTypes

> `readonly` **mutedMetricTypes**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/events/event-filter.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L22)

## Methods

### isEventAllowed()

> **isEventAllowed**(`eventType`): `boolean`

Defined in: [packages/core/src/core/events/event-filter.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L32)

#### Parameters

##### eventType

`string`

#### Returns

`boolean`

***

### isMetricAllowed()

> **isMetricAllowed**(`metricType`): `boolean`

Defined in: [packages/core/src/core/events/event-filter.ts:36](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/event-filter.ts#L36)

#### Parameters

##### metricType

`string`

#### Returns

`boolean`
