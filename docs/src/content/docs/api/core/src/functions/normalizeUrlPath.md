---
editUrl: false
next: false
prev: false
title: "normalizeUrlPath"
---

> **normalizeUrlPath**(`rawPath`): `string` \| `null`

Defined in: [packages/core/src/core/validation/path-matching.ts:96](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/validation/path-matching.ts#L96)

Normalize a raw URL path: recursive percent-decode (4 rounds max) +
 dot-segment collapse. Returns null when the path is not decodable
 (invalid UTF-8 escape or leftover %XX run after the rounds).

## Parameters

### rawPath

`string`

## Returns

`string` \| `null`
