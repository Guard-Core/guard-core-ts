---
editUrl: false
next: false
prev: false
title: "readCappedBody"
---

> **readCappedBody**(`request`, `deps`, `clientIp?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>

Defined in: [packages/core/src/core/bounded-body-reader.ts:186](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L186)

Read the request body under the detection caps. Returns null when the
 body is unavailable (timeout, budget exhaustion, read error, or an
 oversized body without a bounded reader on the request).

## Parameters

### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

### deps

[`BoundedBodyReaderDeps`](/guard-core-ts/api/core/src/interfaces/boundedbodyreaderdeps/)

### clientIp?

`string` = `''`

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>
