---
editUrl: false
next: false
prev: false
title: "logActivity"
---

> **logActivity**(`request`, `logger`, `logType?`, `reason?`, `passiveMode?`, `triggerInfo?`, `level?`, `hooks?`): `void`

Defined in: [packages/core/src/utils.ts:1115](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/utils.ts#L1115)

## Parameters

### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

### logType?

`string` = `'request'`

### reason?

`string` = `''`

### passiveMode?

`boolean` = `false`

### triggerInfo?

`string` = `''`

### level?

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

### hooks?

#### checkName?

`string`

#### mutedCheckLogs?

`ReadonlySet`\<`string`\> \| `null`

#### onBlock?

((`request`, `payload`) => `unknown`) \| `null`

#### sensitiveBodyFields?

`Iterable`\<`string`, `any`, `any`\> \| `null`

#### sensitiveHeaders?

`Iterable`\<`string`, `any`, `any`\> \| `null`

#### sensitiveParams?

`Iterable`\<`string`, `any`, `any`\> \| `null`

## Returns

`void`
