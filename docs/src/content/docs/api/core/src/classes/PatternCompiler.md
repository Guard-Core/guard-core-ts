---
editUrl: false
next: false
prev: false
title: "PatternCompiler"
---

Defined in: [packages/core/src/detection-engine/compiler.ts:62](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L62)

## Constructors

### Constructor

> **new PatternCompiler**(`defaultTimeoutMs?`, `maxCacheSize?`, `validationCache?`): `PatternCompiler`

Defined in: [packages/core/src/detection-engine/compiler.ts:71](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L71)

#### Parameters

##### defaultTimeoutMs?

`number` = `2000`

##### maxCacheSize?

`number` = `1000`

##### validationCache?

`PatternValidationCache` \| `null`

#### Returns

`PatternCompiler`

## Methods

### batchCompile()

> **batchCompile**(`patterns`, `validate?`): `Promise`\<`Map`\<`string`, `RegExp` \| `RE2Instance`\>\>

Defined in: [packages/core/src/detection-engine/compiler.ts:268](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L268)

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

Defined in: [packages/core/src/detection-engine/compiler.ts:287](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L287)

#### Returns

`Promise`\<`void`\>

***

### compile()

> **compile**(`pattern`, `flags?`): `Promise`\<`RegExp` \| `RE2Instance`\>

Defined in: [packages/core/src/detection-engine/compiler.ts:87](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L87)

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

Defined in: [packages/core/src/detection-engine/compiler.ts:121](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L121)

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

Defined in: [packages/core/src/detection-engine/compiler.ts:125](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L125)

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

> **validatePatternSafety**(`pattern`, `testStrings?`, `flags?`): \[`boolean`, `string`\]

Defined in: [packages/core/src/detection-engine/compiler.ts:192](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/detection-engine/compiler.ts#L192)

#### Parameters

##### pattern

`string`

##### testStrings?

`string`[]

##### flags?

`string` = `'gi'`

#### Returns

\[`boolean`, `string`\]
