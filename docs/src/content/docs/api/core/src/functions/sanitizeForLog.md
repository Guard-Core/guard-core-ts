---
editUrl: false
next: false
prev: false
title: "sanitizeForLog"
---

> **sanitizeForLog**(`value`): `string`

Defined in: [packages/core/src/utils.ts:111](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/utils.ts#L111)

Port of guard_core._utils.logging_utils._sanitize_for_log: make a string
safe to emit on any console encoding. Control characters become \uXXXX
escapes and every non-ASCII code point becomes a \uXXXX (or \xNN for
surrogate-escaped bytes in the 0xDC80-0xDCFF range) escape, so the result
is pure ASCII and can never raise on legacy code pages such as cp1252.

## Parameters

### value

`string`

## Returns

`string`
