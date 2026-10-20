---
editUrl: false
next: false
prev: false
title: "sendAgentEvent"
---

> **sendAgentEvent**(`agentHandler`, `eventType`, `ipAddress`, `actionTaken`, `reason`, `request?`, `metadata?`): `Promise`\<`void`\>

Defined in: [packages/core/src/utils.ts:137](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/utils.ts#L137)

## Parameters

### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

### eventType

`string`

### ipAddress

`string`

### actionTaken

`string`

### reason

`string`

### request?

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/) \| `null`

### metadata?

`Record`\<`string`, `unknown`\>

## Returns

`Promise`\<`void`\>
