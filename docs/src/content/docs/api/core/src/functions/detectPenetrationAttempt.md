---
editUrl: false
next: false
prev: false
title: "detectPenetrationAttempt"
---

> **detectPenetrationAttempt**(`request`): `Promise`\<\[`boolean`, `string`, `string`[]\]\>

Defined in: [packages/core/src/utils.ts:1108](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/utils.ts#L1108)

Standalone penetration detection entry point (public API). Runs the full
SusPatternsManager engine over the request surface on a shared default
manager; the live middleware path feeds the initializer's manager into
scanRequestWithManager directly via SuspiciousActivityCheck.

## Parameters

### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

## Returns

`Promise`\<\[`boolean`, `string`, `string`[]\]\>
