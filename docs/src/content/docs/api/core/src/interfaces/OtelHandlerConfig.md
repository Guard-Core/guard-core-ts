---
editUrl: false
next: false
prev: false
title: "OtelHandlerConfig"
---

Defined in: [packages/core/src/core/events/otel-handler.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L44)

## Properties

### exporterEndpoint?

> `optional` **exporterEndpoint?**: `string` \| `null`

Defined in: [packages/core/src/core/events/otel-handler.ts:47](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L47)

***

### instrumentation?

> `optional` **instrumentation?**: [`OtelInstrumentation`](/guard-core-ts/api/core/src/interfaces/otelinstrumentation/) \| `null`

Defined in: [packages/core/src/core/events/otel-handler.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L49)

The wired OTel SDK; null (the default) keeps the handler disabled.

***

### resourceAttributes?

> `optional` **resourceAttributes?**: `Record`\<`string`, `string`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:46](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L46)

***

### serviceName

> **serviceName**: `string`

Defined in: [packages/core/src/core/events/otel-handler.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L45)
