---
editUrl: false
next: false
prev: false
title: "LogfireClient"
---

Defined in: [packages/core/src/core/events/logfire-handler.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L23)

## Methods

### configure()

> **configure**(`serviceName`): `void`

Defined in: [packages/core/src/core/events/logfire-handler.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L28)

#### Parameters

##### serviceName

`string`

#### Returns

`void`

***

### info()

> **info**(`message`, `attributes`): `void`

Defined in: [packages/core/src/core/events/logfire-handler.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L30)

#### Parameters

##### message

`string`

##### attributes

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### isConfigured()

> **isConfigured**(): `boolean`

Defined in: [packages/core/src/core/events/logfire-handler.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L27)

True when a host application (or an earlier guard instance) already
 configured logfire in this process; the handler adopts it instead of
 calling configure again.

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/core/src/core/events/logfire-handler.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L31)

#### Returns

`Promise`\<`void`\>

***

### span()

> **span**(`name`, `attributes`): `void`

Defined in: [packages/core/src/core/events/logfire-handler.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/events/logfire-handler.ts#L29)

#### Parameters

##### name

`string`

##### attributes

`Record`\<`string`, `unknown`\>

#### Returns

`void`
