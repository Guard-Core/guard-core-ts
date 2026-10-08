---
editUrl: false
next: false
prev: false
title: "PerformanceMonitor"
---

Defined in: [core/src/detection-engine/monitor.ts:68](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L68)

## Constructors

### Constructor

> **new PerformanceMonitor**(`anomalyThreshold?`, `slowPatternThreshold?`, `historySize?`, `maxTrackedPatterns?`): `PerformanceMonitor`

Defined in: [core/src/detection-engine/monitor.ts:78](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L78)

#### Parameters

##### anomalyThreshold?

`number` = `3.0`

##### slowPatternThreshold?

`number` = `0.1`

##### historySize?

`number` = `1000`

##### maxTrackedPatterns?

`number` = `1000`

#### Returns

`PerformanceMonitor`

## Methods

### clearStats()

> **clearStats**(): `Promise`\<`void`\>

Defined in: [core/src/detection-engine/monitor.ts:323](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L323)

#### Returns

`Promise`\<`void`\>

***

### getPatternReport()

> **getPatternReport**(`pattern`): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/) \| `null`

Defined in: [core/src/detection-engine/monitor.ts:232](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L232)

#### Parameters

##### pattern

`string`

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/) \| `null`

***

### getProblematicPatterns()

> **getProblematicPatterns**(): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

Defined in: [core/src/detection-engine/monitor.ts:271](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L271)

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

***

### getSlowPatterns()

> **getSlowPatterns**(`limit?`): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

Defined in: [core/src/detection-engine/monitor.ts:257](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L257)

#### Parameters

##### limit?

`number` = `10`

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

***

### getSummaryStats()

> **getSummaryStats**(): `Record`\<`string`, `unknown`\>

Defined in: [core/src/detection-engine/monitor.ts:296](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L296)

#### Returns

`Record`\<`string`, `unknown`\>

***

### recordMetric()

> **recordMetric**(`pattern`, `executionTime`, `contentLength`, `matched`, `timeout?`, `agentHandler?`, `correlationId?`): `Promise`\<`void`\>

Defined in: [core/src/detection-engine/monitor.ts:90](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L90)

#### Parameters

##### pattern

`string`

##### executionTime

`number`

##### contentLength

`number`

##### matched

`boolean`

##### timeout?

`boolean` = `false`

##### agentHandler?

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

##### correlationId?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### registerAnomalyCallback()

> **registerAnomalyCallback**(`callback`): `void`

Defined in: [core/src/detection-engine/monitor.ts:319](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L319)

#### Parameters

##### callback

`AnomalyCallback`

#### Returns

`void`

***

### removePatternStats()

> **removePatternStats**(`pattern`): `Promise`\<`void`\>

Defined in: [core/src/detection-engine/monitor.ts:328](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/monitor.ts#L328)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`void`\>
