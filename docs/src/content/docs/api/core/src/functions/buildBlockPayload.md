---
editUrl: false
next: false
prev: false
title: "buildBlockPayload"
---

> **buildBlockPayload**(`request`, `checkName`, `reason`, `triggerInfo`, `passiveMode`, `statusCode`, `sensitiveParams`, `sensitiveBodyFields`, `sensitiveHeaders`): `Record`\<`string`, `unknown`\>

Defined in: [packages/core/src/core/block-events.ts:48](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/block-events.ts#L48)

## Parameters

### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

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

`Record`\<`string`, `unknown`\>
