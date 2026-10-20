---
editUrl: false
next: false
prev: false
title: "ContentPreprocessor"
---

Defined in: [packages/core/src/detection-engine/preprocessor.ts:106](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L106)

## Constructors

### Constructor

> **new ContentPreprocessor**(`maxContentLength?`, `preserveAttackPatterns?`, `maxFullScanBytes?`): `ContentPreprocessor`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:114](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L114)

#### Parameters

##### maxContentLength?

`number` = `10000`

##### preserveAttackPatterns?

`boolean` = `true`

##### maxFullScanBytes?

`number` \| `null`

#### Returns

`ContentPreprocessor`

## Properties

### compiledIndicators

> `readonly` **compiledIndicators**: `RegExp`[]

Defined in: [packages/core/src/detection-engine/preprocessor.ts:110](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L110)

***

### maxContentLength

> `readonly` **maxContentLength**: `number`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:107](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L107)

***

### maxFullScanBytes

> `readonly` **maxFullScanBytes**: `number`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:109](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L109)

***

### preserveAttackPatterns

> `readonly` **preserveAttackPatterns**: `boolean`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:108](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L108)

## Methods

### decodeCommonEncodings()

> **decodeCommonEncodings**(`content`, `decodeBudgetExhausted?`): `Promise`\<`string`\>

Defined in: [packages/core/src/detection-engine/preprocessor.ts:232](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L232)

#### Parameters

##### content

`string`

##### decodeBudgetExhausted?

###### value

`boolean`

#### Returns

`Promise`\<`string`\>

***

### extractAttackRegions()

> **extractAttackRegions**(`content`): \[`number`, `number`\][]

Defined in: [packages/core/src/detection-engine/preprocessor.ts:181](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L181)

#### Parameters

##### content

`string`

#### Returns

\[`number`, `number`\][]

***

### normalizeUnicode()

> **normalizeUnicode**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:162](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L162)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### preprocess()

> **preprocess**(`content`, `decodeBudgetExhausted?`): `Promise`\<`string`\>

Defined in: [packages/core/src/detection-engine/preprocessor.ts:297](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L297)

#### Parameters

##### content

`string`

##### decodeBudgetExhausted?

###### value

`boolean`

#### Returns

`Promise`\<`string`\>

***

### preprocessBatch()

> **preprocessBatch**(`contents`): `Promise`\<`string`[]\>

Defined in: [packages/core/src/detection-engine/preprocessor.ts:328](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L328)

#### Parameters

##### contents

`string`[]

#### Returns

`Promise`\<`string`[]\>

***

### preprocessShortBase64AdditiveView()

> **preprocessShortBase64AdditiveView**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:324](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L324)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### preprocessSignalPreserving()

> **preprocessSignalPreserving**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:302](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L302)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### preprocessUrlDecodedNewlinePreserving()

> **preprocessUrlDecodedNewlinePreserving**(`content`, `decodeBudgetExhausted?`): `Promise`\<`string`\>

Defined in: [packages/core/src/detection-engine/preprocessor.ts:308](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L308)

#### Parameters

##### content

`string`

##### decodeBudgetExhausted?

###### value

`boolean`

#### Returns

`Promise`\<`string`\>

***

### preprocessWithDecoded()

> **preprocessWithDecoded**(`content`, `decodeBudgetExhausted?`): `Promise`\<\[`string`, `string`\]\>

Defined in: [packages/core/src/detection-engine/preprocessor.ts:282](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L282)

#### Parameters

##### content

`string`

##### decodeBudgetExhausted?

###### value

`boolean`

#### Returns

`Promise`\<\[`string`, `string`\]\>

***

### removeExcessiveWhitespace()

> **removeExcessiveWhitespace**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:174](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L174)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### removeNullBytes()

> **removeNullBytes**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:170](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L170)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### setAgentHandler()

> **setAgentHandler**(`agentHandler`, `correlationId?`): `void`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:128](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L128)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

##### correlationId?

`string` \| `null`

#### Returns

`void`

***

### stripSqlComments()

> **stripSqlComments**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:223](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L223)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### truncateSafely()

> **truncateSafely**(`content`): `string`

Defined in: [packages/core/src/detection-engine/preprocessor.ts:201](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/preprocessor.ts#L201)

#### Parameters

##### content

`string`

#### Returns

`string`
