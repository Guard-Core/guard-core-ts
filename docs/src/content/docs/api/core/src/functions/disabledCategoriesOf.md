---
editUrl: false
next: false
prev: false
title: "disabledCategoriesOf"
---

> **disabledCategoriesOf**(`exclusions`): `ReadonlySet`\<`string`\>

Defined in: [packages/core/src/core/routing/detection-exclusions.ts:129](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/detection-exclusions.ts#L129)

Categories that must not produce a threat for this request: the
 complement of the resolved enabled set (empty when every category
 scans). The scanners fold this into their per-value skip sets, matching
 the reference's per-category pattern gating.

## Parameters

### exclusions

[`ResolvedDetectionExclusions`](/guard-core-ts/api/core/src/interfaces/resolveddetectionexclusions/)

## Returns

`ReadonlySet`\<`string`\>
