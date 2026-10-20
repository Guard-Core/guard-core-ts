---
editUrl: false
next: false
prev: false
title: "ResolvedDetectionExclusions"
---

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L14)

The resolved exclusion set for one request. enabledCategories is null
 when every category scans (the reference passes None through to the
 scanners); scanBody defaults to true.

## Properties

### enabledCategories

> **enabledCategories**: `ReadonlySet`\<`string`\> \| `null`

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L21)

***

### excludedBodyFields

> **excludedBodyFields**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L16)

***

### excludedHeaders

> **excludedHeaders**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L17)

***

### excludedParams

> **excludedParams**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L15)

***

### excludedSemanticHeaders

> **excludedSemanticHeaders**: `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L20)

***

### scanBody

> **scanBody**: `boolean`

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L22)
