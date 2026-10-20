---
editUrl: false
next: false
prev: false
title: "SemanticAnalyzer"
---

Defined in: [packages/core/src/detection-engine/semantic.ts:114](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L114)

## Constructors

### Constructor

> **new SemanticAnalyzer**(): `SemanticAnalyzer`

#### Returns

`SemanticAnalyzer`

## Methods

### analyze()

> **analyze**(`content`): [`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

Defined in: [packages/core/src/detection-engine/semantic.ts:302](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L302)

#### Parameters

##### content

`string`

#### Returns

[`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

***

### analyzeAttackProbability()

> **analyzeAttackProbability**(`content`): `Record`\<`string`, `number`\>

Defined in: [packages/core/src/detection-engine/semantic.ts:215](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L215)

#### Parameters

##### content

`string`

#### Returns

`Record`\<`string`, `number`\>

***

### analyzeCodeInjectionRisk()

> **analyzeCodeInjectionRisk**(`content`): `number`

Defined in: [packages/core/src/detection-engine/semantic.ts:292](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L292)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### calculateEntropy()

> **calculateEntropy**(`content`): `number`

Defined in: [packages/core/src/detection-engine/semantic.ts:138](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L138)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### detectEncodingLayers()

> **detectEncodingLayers**(`content`): `number`

Defined in: [packages/core/src/detection-engine/semantic.ts:160](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L160)

#### Parameters

##### content

`string`

#### Returns

`number`

***

### detectObfuscation()

> **detectObfuscation**(`content`): `boolean`

Defined in: [packages/core/src/detection-engine/semantic.ts:220](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L220)

#### Parameters

##### content

`string`

#### Returns

`boolean`

***

### extractSuspiciousPatterns()

> **extractSuspiciousPatterns**(`content`): `SuspiciousPattern`[]

Defined in: [packages/core/src/detection-engine/semantic.ts:237](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L237)

#### Parameters

##### content

`string`

#### Returns

`SuspiciousPattern`[]

***

### extractTokens()

> **extractTokens**(`content`): `string`[]

Defined in: [packages/core/src/detection-engine/semantic.ts:115](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L115)

#### Parameters

##### content

`string`

#### Returns

`string`[]

***

### getThreatScore()

> **getThreatScore**(`analysisResults`): `number`

Defined in: [packages/core/src/detection-engine/semantic.ts:315](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/semantic.ts#L315)

#### Parameters

##### analysisResults

[`SemanticAnalysis`](/guard-core-ts/api/core/src/interfaces/semanticanalysis/)

#### Returns

`number`
