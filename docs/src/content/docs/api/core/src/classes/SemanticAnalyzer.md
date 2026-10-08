---
editUrl: false
next: false
prev: false
title: "SemanticAnalyzer"
---

Defined in: [core/src/detection-engine/semantic.ts:59](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L59)

## Constructors

### Constructor

> **new SemanticAnalyzer**(): `SemanticAnalyzer`

#### Returns

`SemanticAnalyzer`

## Methods

### analyze()

> **analyze**(`content`): [`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

Defined in: [core/src/detection-engine/semantic.ts:215](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L215)

#### Parameters

##### content

`string`

#### Returns

[`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

***

### analyzeAttackProbability()

> **analyzeAttackProbability**(`content`): `Record`\<`string`, `number`\>

Defined in: [core/src/detection-engine/semantic.ts:123](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L123)

#### Parameters

##### content

`string`

#### Returns

`Record`\<`string`, `number`\>

***

### analyzeCodeInjectionRisk()

> **analyzeCodeInjectionRisk**(`content`): `number`

Defined in: [core/src/detection-engine/semantic.ts:185](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L185)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### calculateEntropy()

> **calculateEntropy**(`content`): `number`

Defined in: [core/src/detection-engine/semantic.ts:83](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L83)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### detectEncodingLayers()

> **detectEncodingLayers**(`content`): `number`

Defined in: [core/src/detection-engine/semantic.ts:107](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L107)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### detectObfuscation()

> **detectObfuscation**(`content`): `boolean`

Defined in: [core/src/detection-engine/semantic.ts:151](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L151)

#### Parameters

##### content

`string`

#### Returns

`boolean`

***

### extractSuspiciousPatterns()

> **extractSuspiciousPatterns**(`content`): `object`[]

Defined in: [core/src/detection-engine/semantic.ts:164](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L164)

#### Parameters

##### content

`string`

#### Returns

`object`[]

***

### extractTokens()

> **extractTokens**(`content`): `string`[]

Defined in: [core/src/detection-engine/semantic.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L60)

#### Parameters

##### content

`string`

#### Returns

`string`[]

***

### getThreatScore()

> **getThreatScore**(`analysis`): `number`

Defined in: [core/src/detection-engine/semantic.ts:227](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/semantic.ts#L227)

#### Parameters

##### analysis

[`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

#### Returns

`number`
