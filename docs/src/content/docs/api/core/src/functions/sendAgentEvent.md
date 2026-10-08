---
editUrl: false
next: false
prev: false
title: "sendAgentEvent"
---

> **sendAgentEvent**(`agentHandler`, `eventType`, `ipAddress`, `actionTaken`, `reason`, `request?`, `metadata?`): `Promise`\<`void`\>

Defined in: [core/src/utils.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/utils.ts#L25)

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
