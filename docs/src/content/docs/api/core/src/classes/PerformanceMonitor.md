---
editUrl: false
next: false
prev: false
title: "PerformanceMonitor"
---

Defined in: [packages/core/src/detection-engine/monitor.ts:64](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L64)

## Constructors

### Constructor

> **new PerformanceMonitor**(`anomalyThreshold?`, `slowPatternThreshold?`, `historySize?`, `maxTrackedPatterns?`, `emissionCooldownSeconds?`, `minSamplesForAnomaly?`): `PerformanceMonitor`

Defined in: [packages/core/src/detection-engine/monitor.ts:80](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L80)

#### Parameters

##### anomalyThreshold?

`number` = `3.0`

##### slowPatternThreshold?

`number` = `0.1`

##### historySize?

`number` = `1000`

##### maxTrackedPatterns?

`number` = `1000`

##### emissionCooldownSeconds?

`number` = `60`

##### minSamplesForAnomaly?

`number` = `30`

#### Returns

`PerformanceMonitor`

## Methods

### clearStats()

> **clearStats**(): `Promise`\<`void`\>

Defined in: [packages/core/src/detection-engine/monitor.ts:433](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L433)

#### Returns

`Promise`\<`void`\>

***

### getPatternReport()

> **getPatternReport**(`pattern`): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/) \| `null`

Defined in: [packages/core/src/detection-engine/monitor.ts:334](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L334)

#### Parameters

##### pattern

`string`

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/) \| `null`

***

### getProblematicPatterns()

> **getProblematicPatterns**(): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

Defined in: [packages/core/src/detection-engine/monitor.ts:373](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L373)

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

***

### getSlowPatterns()

> **getSlowPatterns**(`limit?`): [`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

Defined in: [packages/core/src/detection-engine/monitor.ts:359](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L359)

#### Parameters

##### limit?

`number` = `10`

#### Returns

[`PatternReport`](/guard-core-ts/api/core/src/interfaces/patternreport/)[]

***

### getSummaryStats()

> **getSummaryStats**(): `Record`\<`string`, `unknown`\>

Defined in: [packages/core/src/detection-engine/monitor.ts:400](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L400)

#### Returns

`Record`\<`string`, `unknown`\>

***

### recordMetric()

> **recordMetric**(`pattern`, `executionTime`, `contentLength`, `matched`, `timeout?`, `agentHandler?`, `correlationId?`): `Promise`\<`void`\>

Defined in: [packages/core/src/detection-engine/monitor.ts:97](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L97)

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

### recordPoolEvent()

> **recordPoolEvent**(`type`, `pattern`, `agentHandler?`, `correlationId?`): `Promise`\<`void`\>

Defined in: [packages/core/src/detection-engine/monitor.ts:300](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L300)

Scan-pool lifecycle events from the native-regex deadline machinery
(scan-pool.ts): quarantine replaces the reference's consecutive-timeout
pool swap, release re-admits the pattern once its cooldown elapses.
Emission mirrors the anomaly path: agent event plus sanitized callback
data (pattern redacted to 50 chars plus an 8-char hash), and a failing
callback or agent handler never propagates.

#### Parameters

##### type

`PoolEventType`

##### pattern

`string`

##### agentHandler?

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

##### correlationId?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### registerAnomalyCallback()

> **registerAnomalyCallback**(`callback`): `void`

Defined in: [packages/core/src/detection-engine/monitor.ts:429](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L429)

#### Parameters

##### callback

`AnomalyCallback`

#### Returns

`void`

***

### removePatternStats()

> **removePatternStats**(`pattern`): `Promise`\<`void`\>

Defined in: [packages/core/src/detection-engine/monitor.ts:438](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/monitor.ts#L438)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`void`\>
