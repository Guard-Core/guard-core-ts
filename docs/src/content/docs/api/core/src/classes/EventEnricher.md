---
editUrl: false
next: false
prev: false
title: "EventEnricher"
---

Defined in: [packages/core/src/core/events/enricher.ts:144](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/enricher.ts#L144)

## Implements

- [`AgentEventEnricher`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/)

## Constructors

### Constructor

> **new EventEnricher**(`context`, `options?`): `EventEnricher`

Defined in: [packages/core/src/core/events/enricher.ts:150](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/enricher.ts#L150)

#### Parameters

##### context

[`EnrichmentContext`](/guard-core-ts/api/core/src/interfaces/enrichmentcontext/)

##### options?

###### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

###### now?

() => `number`

#### Returns

`EventEnricher`

## Methods

### enrichEvent()

> **enrichEvent**(`event`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/enricher.ts:159](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/enricher.ts#L159)

#### Parameters

##### event

`unknown`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentEventEnricher`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/).[`enrichEvent`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/#enrichevent)

***

### enrichMetric()

> **enrichMetric**(`metric`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/enricher.ts:176](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/enricher.ts#L176)

#### Parameters

##### metric

`unknown`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AgentEventEnricher`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/).[`enrichMetric`](/guard-core-ts/api/core/src/interfaces/agenteventenricher/#enrichmetric)
