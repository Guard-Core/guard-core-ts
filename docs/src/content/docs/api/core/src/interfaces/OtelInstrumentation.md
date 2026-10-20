---
editUrl: false
next: false
prev: false
title: "OtelInstrumentation"
---

Defined in: [packages/core/src/core/events/otel-handler.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L31)

## Methods

### addCounter()

> **addCounter**(`name`, `value`, `attributes`): `void`

Defined in: [packages/core/src/core/events/otel-handler.ts:40](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L40)

#### Parameters

##### name

`string`

##### value

`number`

##### attributes

`Record`\<`string`, `string`\>

#### Returns

`void`

***

### recordHistogram()

> **recordHistogram**(`name`, `value`, `attributes`): `void`

Defined in: [packages/core/src/core/events/otel-handler.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L39)

#### Parameters

##### name

`string`

##### value

`number`

##### attributes

`Record`\<`string`, `string`\>

#### Returns

`void`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/otel-handler.ts:41](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L41)

#### Returns

`Promise`\<`void`\>

***

### startSpan()

> **startSpan**(`name`, `attributes`, `parent?`): `void`

Defined in: [packages/core/src/core/events/otel-handler.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/otel-handler.ts#L34)

Record a span for one security event. The parent trace context comes
 from the event metadata (traceparent/tracestate) when present.

#### Parameters

##### name

`string`

##### attributes

`Record`\<`string`, `string` \| `number`\>

##### parent?

[`OtelTraceContext`](/guard-core-ts/api/core/src/interfaces/oteltracecontext/)

#### Returns

`void`
