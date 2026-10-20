---
editUrl: false
next: false
prev: false
title: "pathIsExcluded"
---

> **pathIsExcluded**(`urlPath`, `excludePaths`): `boolean`

Defined in: [packages/core/src/core/validation/path-matching.ts:126](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/validation/path-matching.ts#L126)

One-shot helper: normalize the request path and the configured
 exclusions, then subtree-match (reference path_is_excluded).

## Parameters

### urlPath

`string`

### excludePaths

readonly `string`[]

## Returns

`boolean`
