---
editUrl: false
next: false
prev: false
title: "fireBlockHook"
---

> **fireBlockHook**(`hook`, `request`, `logger`, `checkName`, `reason`, `triggerInfo`, `passiveMode`, `statusCode`, `sensitiveParams`, `sensitiveBodyFields`, `sensitiveHeaders`): `Promise`\<`void`\>

Defined in: [packages/core/src/core/block-events.ts:76](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/block-events.ts#L76)

## Parameters

### hook

[`OnBlockHook`](/guard-core-ts/api/core/src/type-aliases/onblockhook/) \| `null` \| `undefined`

### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

### checkName

`string`

### reason

`string`

### triggerInfo

`string`

### passiveMode

`boolean`

### statusCode

`number` \| `null`

### sensitiveParams

`Iterable`\<`string`, `any`, `any`\> \| `null` \| `undefined`

### sensitiveBodyFields

`Iterable`\<`string`, `any`, `any`\> \| `null` \| `undefined`

### sensitiveHeaders

`Iterable`\<`string`, `any`, `any`\> \| `null` \| `undefined`

## Returns

`Promise`\<`void`\>
