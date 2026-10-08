---
editUrl: false
next: false
prev: false
title: "PatternCompiler"
---

Defined in: [core/src/detection-engine/compiler.ts:48](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L48)

## Constructors

### Constructor

> **new PatternCompiler**(`defaultTimeoutMs?`, `maxCacheSize?`): `PatternCompiler`

Defined in: [core/src/detection-engine/compiler.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L53)

#### Parameters

##### defaultTimeoutMs?

`number` = `2000`

##### maxCacheSize?

`number` = `1000`

#### Returns

`PatternCompiler`

## Methods

### batchCompile()

> **batchCompile**(`patterns`, `validate?`): `Promise`\<`Map`\<`string`, `RegExp` \| `RE2Instance`\>\>

Defined in: [core/src/detection-engine/compiler.ts:201](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L201)

#### Parameters

##### patterns

`string`[]

##### validate?

`boolean` = `true`

#### Returns

`Promise`\<`Map`\<`string`, `RegExp` \| `RE2Instance`\>\>

***

### clearCache()

> **clearCache**(): `Promise`\<`void`\>

Defined in: [core/src/detection-engine/compiler.ts:220](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L220)

#### Returns

`Promise`\<`void`\>

***

### compile()

> **compile**(`pattern`, `flags?`): `Promise`\<`RegExp` \| `RE2Instance`\>

Defined in: [core/src/detection-engine/compiler.ts:67](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L67)

#### Parameters

##### pattern

`string`

##### flags?

`string` = `'gi'`

#### Returns

`Promise`\<`RegExp` \| `RE2Instance`\>

***

### compileSync()

> **compileSync**(`pattern`, `flags?`): `RegExp`

Defined in: [core/src/detection-engine/compiler.ts:101](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L101)

#### Parameters

##### pattern

`string`

##### flags?

`string` = `'gi'`

#### Returns

`RegExp`

***

### safeMatch()

> **safeMatch**(`pattern`, `content`, `timeoutMs?`): `Promise`\<`MatchResult` \| `null`\>

Defined in: [core/src/detection-engine/compiler.ts:105](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L105)

#### Parameters

##### pattern

`string`

##### content

`string`

##### timeoutMs?

`number`

#### Returns

`Promise`\<`MatchResult` \| `null`\>

***

### validatePatternSafety()

> **validatePatternSafety**(`pattern`, `testStrings?`): \[`boolean`, `string`\]

Defined in: [core/src/detection-engine/compiler.ts:172](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/detection-engine/compiler.ts#L172)

#### Parameters

##### pattern

`string`

##### testStrings?

`string`[]

#### Returns

\[`boolean`, `string`\]
