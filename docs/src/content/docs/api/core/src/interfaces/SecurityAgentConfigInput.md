---
editUrl: false
next: false
prev: false
title: "SecurityAgentConfigInput"
---

Defined in: [packages/core/src/models/agent-config.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L32)

Structural GuardAgent constructor input. Field docs live on the agent's
AgentConfig; only apiKey is required, every other field is optional so the
agent defaults apply where the SecurityConfig left them unset.

## Properties

### apiKey

> **apiKey**: `string`

Defined in: [packages/core/src/models/agent-config.ts:33](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L33)

***

### backoffFactor?

> `optional` **backoffFactor?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:47](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L47)

***

### bufferOverflowPolicy?

> `optional` **bufferOverflowPolicy?**: [`SecurityBufferOverflowPolicy`](/guard-core-ts/api/core/src/type-aliases/securitybufferoverflowpolicy/)

Defined in: [packages/core/src/models/agent-config.ts:42](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L42)

***

### bufferSize?

> `optional` **bufferSize?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:36](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L36)

***

### compressionEnabled?

> `optional` **compressionEnabled?**: `boolean`

Defined in: [packages/core/src/models/agent-config.ts:52](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L52)

***

### compressionThreshold?

> `optional` **compressionThreshold?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L53)

***

### dynamicRuleInterval?

> `optional` **dynamicRuleInterval?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:38](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L38)

***

### enableEvents?

> `optional` **enableEvents?**: `boolean`

Defined in: [packages/core/src/models/agent-config.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L44)

***

### enableMetrics?

> `optional` **enableMetrics?**: `boolean`

Defined in: [packages/core/src/models/agent-config.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L43)

***

### endpoint?

> `optional` **endpoint?**: `string`

Defined in: [packages/core/src/models/agent-config.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L34)

***

### flushInterval?

> `optional` **flushInterval?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:37](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L37)

***

### guardCoreVersion?

> `optional` **guardCoreVersion?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:51](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L51)

***

### guardVersion?

> `optional` **guardVersion?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:50](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L50)

***

### highWatermarkRatio?

> `optional` **highWatermarkRatio?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L40)

***

### installId?

> `optional` **installId?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:54](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L54)

***

### maxConcurrentFlushes?

> `optional` **maxConcurrentFlushes?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:41](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L41)

***

### maxPayloadSize?

> `optional` **maxPayloadSize?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L49)

***

### onError?

> `optional` **onError?**: [`SecurityErrorHook`](/guard-core-ts/api/core/src/type-aliases/securityerrorhook/)

Defined in: [packages/core/src/models/agent-config.ts:57](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L57)

***

### payloadSigningSecret?

> `optional` **payloadSigningSecret?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:55](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L55)

***

### projectEncryptionKey?

> `optional` **projectEncryptionKey?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L56)

***

### projectId?

> `optional` **projectId?**: `string` \| `null`

Defined in: [packages/core/src/models/agent-config.ts:35](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L35)

***

### retryAttempts?

> `optional` **retryAttempts?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L45)

***

### sensitiveHeaders?

> `optional` **sensitiveHeaders?**: `string`[]

Defined in: [packages/core/src/models/agent-config.ts:48](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L48)

***

### statusInterval?

> `optional` **statusInterval?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L39)

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [packages/core/src/models/agent-config.ts:46](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/agent-config.ts#L46)
