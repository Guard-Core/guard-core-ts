---
editUrl: false
next: false
prev: false
title: "SecurityCheckPipeline"
---

Defined in: [packages/core/src/core/checks/pipeline.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L10)

## Constructors

### Constructor

> **new SecurityCheckPipeline**(`checks`, `logger`): `SecurityCheckPipeline`

Defined in: [packages/core/src/core/checks/pipeline.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L11)

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

Defined in: [packages/core/src/core/checks/pipeline.ts:124](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L124)

##### Returns

`number`

## Methods

### add()

> **add**(`check`): `void`

Defined in: [packages/core/src/core/checks/pipeline.ts:105](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L105)

#### Parameters

##### check

`SecurityCheck`

#### Returns

`void`

***

### execute()

> **execute**(`request`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

Defined in: [packages/core/src/core/checks/pipeline.ts:84](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L84)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

***

### getCheckNames()

> **getCheckNames**(): `string`[]

Defined in: [packages/core/src/core/checks/pipeline.ts:120](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L120)

#### Returns

`string`[]

***

### insert()

> **insert**(`index`, `check`): `void`

Defined in: [packages/core/src/core/checks/pipeline.ts:109](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L109)

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

Defined in: [packages/core/src/core/checks/pipeline.ts:113](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/checks/pipeline.ts#L113)

#### Parameters

##### name

`string`

#### Returns

`boolean`
