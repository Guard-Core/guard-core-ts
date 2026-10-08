---
editUrl: false
next: false
prev: false
title: "SecurityCheckPipeline"
---

Defined in: [core/src/core/checks/pipeline.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L6)

## Constructors

### Constructor

> **new SecurityCheckPipeline**(`checks`, `logger`): `SecurityCheckPipeline`

Defined in: [core/src/core/checks/pipeline.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L7)

#### Parameters

##### checks

`SecurityCheck`[]

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`SecurityCheckPipeline`

## Accessors

### length

#### Get Signature

> **get** **length**(): `number`

Defined in: [core/src/core/checks/pipeline.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L43)

##### Returns

`number`

## Methods

### add()

> **add**(`check`): `void`

Defined in: [core/src/core/checks/pipeline.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L24)

#### Parameters

##### check

`SecurityCheck`

#### Returns

`void`

***

### execute()

> **execute**(`request`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

Defined in: [core/src/core/checks/pipeline.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L12)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

***

### getCheckNames()

> **getCheckNames**(): `string`[]

Defined in: [core/src/core/checks/pipeline.ts:39](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L39)

#### Returns

`string`[]

***

### insert()

> **insert**(`index`, `check`): `void`

Defined in: [core/src/core/checks/pipeline.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L28)

#### Parameters

##### index

`number`

##### check

`SecurityCheck`

#### Returns

`void`

***

### remove()

> **remove**(`name`): `boolean`

Defined in: [core/src/core/checks/pipeline.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/checks/pipeline.ts#L32)

#### Parameters

##### name

`string`

#### Returns

`boolean`
