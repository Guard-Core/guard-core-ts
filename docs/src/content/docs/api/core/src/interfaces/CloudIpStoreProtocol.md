---
editUrl: false
next: false
prev: false
title: "CloudIpStoreProtocol"
---

Defined in: [packages/core/src/protocols/cloud-ip-store.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/cloud-ip-store.ts#L11)

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/cloud-ip-store.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/cloud-ip-store.ts#L14)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`provider`): `Promise`\<`Set`\<`string`\> \| `null`\>

Defined in: [packages/core/src/protocols/cloud-ip-store.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/cloud-ip-store.ts#L12)

#### Parameters

##### provider

`string`

#### Returns

`Promise`\<`Set`\<`string`\> \| `null`\>

***

### set()

> **set**(`provider`, `ranges`, `ttl?`): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/cloud-ip-store.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/cloud-ip-store.ts#L13)

#### Parameters

##### provider

`string`

##### ranges

`Set`\<`string`\>

##### ttl?

`number` \| `null`

#### Returns

`Promise`\<`void`\>
