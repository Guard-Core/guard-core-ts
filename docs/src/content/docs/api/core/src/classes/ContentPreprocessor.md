---
editUrl: false
next: false
prev: false
title: "ContentPreprocessor"
---

Defined in: [core/src/detection-engine/preprocessor.ts:52](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L52)

## Constructors

### Constructor

> **new ContentPreprocessor**(`maxContentLength?`, `preserveAttackPatterns?`): `ContentPreprocessor`

Defined in: [core/src/detection-engine/preprocessor.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L56)

#### Parameters

##### maxContentLength?

`number` = `10000`

##### preserveAttackPatterns?

`boolean` = `true`

#### Returns

`ContentPreprocessor`

## Methods

### decodeCommonEncodings()

> **decodeCommonEncodings**(`content`): `string`

Defined in: [core/src/detection-engine/preprocessor.ts:77](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L77)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### extractAttackRegions()

> **extractAttackRegions**(`content`): \[`number`, `number`\][]

Defined in: [core/src/detection-engine/preprocessor.ts:126](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L126)

#### Parameters

##### content

`string`

#### Returns

\[`number`, `number`\][]

***

### normalizeUnicode()

> **normalizeUnicode**(`content`): `string`

Defined in: [core/src/detection-engine/preprocessor.ts:61](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L61)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### preprocess()

> **preprocess**(`content`): `Promise`\<`string`\>

Defined in: [core/src/detection-engine/preprocessor.ts:205](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L205)

#### Parameters

##### content

`string`

#### Returns

`Promise`\<`string`\>

***

### preprocessBatch()

> **preprocessBatch**(`contents`): `Promise`\<`string`[]\>

Defined in: [core/src/detection-engine/preprocessor.ts:217](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L217)

#### Parameters

##### contents

`string`[]

#### Returns

`Promise`\<`string`[]\>

***

### removeExcessiveWhitespace()

> **removeExcessiveWhitespace**(`content`): `string`

Defined in: [core/src/detection-engine/preprocessor.ts:73](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L73)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### removeNullBytes()

> **removeNullBytes**(`content`): `string`

Defined in: [core/src/detection-engine/preprocessor.ts:69](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L69)

#### Parameters

##### content

`string`

#### Returns

`string`

***

### truncateSafely()

> **truncateSafely**(`content`): `string`

Defined in: [core/src/detection-engine/preprocessor.ts:162](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/preprocessor.ts#L162)

#### Parameters

##### content

`string`

#### Returns

`string`
