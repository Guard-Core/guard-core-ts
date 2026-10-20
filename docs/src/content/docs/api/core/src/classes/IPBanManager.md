---
editUrl: false
next: false
prev: false
title: "IPBanManager"
---

Defined in: [packages/core/src/handlers/ip-ban.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L19)

## Constructors

### Constructor

> **new IPBanManager**(`logger`): `IPBanManager`

Defined in: [packages/core/src/handlers/ip-ban.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L25)

#### Parameters

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`IPBanManager`

## Methods

### banIp()

> **banIp**(`ip`, `duration`, `reason`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:91](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L91)

#### Parameters

##### ip

`string`

##### duration

`number`

##### reason

`string`

#### Returns

`Promise`\<`boolean`\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:82](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L82)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L27)

#### Parameters

##### redisHandler

[`RedisManager`](/guard-core-ts/api/core/src/classes/redismanager/)

#### Returns

`Promise`\<`void`\>

***

### isIpBanned()

> **isIpBanned**(`ip`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:125](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L125)

#### Parameters

##### ip

`string`

#### Returns

`Promise`\<`boolean`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:177](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L177)

#### Returns

`Promise`\<`void`\>

***

### unbanIp()

> **unbanIp**(`ip`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/ip-ban.ts:153](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/ip-ban.ts#L153)

#### Parameters

##### ip

`string`

#### Returns

`Promise`\<`void`\>
