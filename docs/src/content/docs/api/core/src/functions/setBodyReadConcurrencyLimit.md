---
editUrl: false
next: false
prev: false
title: "setBodyReadConcurrencyLimit"
---

> **setBodyReadConcurrencyLimit**(`limit`): `void`

Defined in: [packages/core/src/core/bounded-body-reader.ts:42](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L42)

Update the process-wide in-flight read budget. Called from readCappedBody
 with the resolved config's bodyReadMaxConcurrent: the last config seen
 wins, which is deterministic for the single-config-per-process case the
 family ships.

## Parameters

### limit

`number`

## Returns

`void`
