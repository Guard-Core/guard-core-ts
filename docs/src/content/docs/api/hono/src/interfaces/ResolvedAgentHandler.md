---
editUrl: false
next: false
prev: false
title: "ResolvedAgentHandler"
---

Defined in: [packages/hono/src/agent.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/agent.ts#L18)

## Properties

### agentHandler

> **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

Defined in: [packages/hono/src/agent.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/agent.ts#L19)

***

### degraded

> **degraded**: `boolean`

Defined in: [packages/hono/src/agent.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/hono/src/agent.ts#L22)

True when the agent was enabled but construction failed and the
middleware degraded to agent-off (the reference agent_degraded).
