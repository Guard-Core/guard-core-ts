---
editUrl: false
next: false
prev: false
title: "IPInfoManager"
---

Defined in: [packages/core/src/handlers/geoip.ts:50](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L50)

## Implements

- [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

## Constructors

### Constructor

> **new IPInfoManager**(`logger`, `options?`): `IPInfoManager`

Defined in: [packages/core/src/handlers/geoip.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L60)

#### Parameters

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

##### options?

`IPInfoManagerOptions` = `{}`

#### Returns

`IPInfoManager`

## Accessors

### entryCount

#### Get Signature

> **get** **entryCount**(): `number`

Defined in: [packages/core/src/handlers/geoip.ts:72](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L72)

##### Returns

`number`

***

### isInitialized

#### Get Signature

> **get** **isInitialized**(): `boolean`

Defined in: [packages/core/src/handlers/geoip.ts:66](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L66)

##### Returns

`boolean`

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`isInitialized`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#isinitialized)

## Methods

### checkCountryAccess()

> **checkCountryAccess**(`ip`, `blockedCountries`, `whitelistCountries?`): `Promise`\<\[`boolean`, `string` \| `null`\]\>

Defined in: [packages/core/src/handlers/geoip.ts:204](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L204)

#### Parameters

##### ip

`string`

##### blockedCountries

readonly `string`[]

##### whitelistCountries?

readonly `string`[] \| `null`

#### Returns

`Promise`\<\[`boolean`, `string` \| `null`\]\>

***

### close()

> **close**(): `void`

Defined in: [packages/core/src/handlers/geoip.ts:240](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L240)

The reference close: release the reader.

#### Returns

`void`

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`close`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#close)

***

### getCountry()

> **getCountry**(`ip`): `string` \| `null`

Defined in: [packages/core/src/handlers/geoip.ts:168](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L168)

#### Parameters

##### ip

`string`

#### Returns

`string` \| `null`

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`getCountry`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#getcountry)

***

### getStatus()

> **getStatus**(): `object`

Defined in: [packages/core/src/handlers/geoip.ts:77](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L77)

#### Returns

`object`

##### entries

> **entries**: `number`

##### lastRefreshed

> **lastRefreshed**: `Date` \| `null`

##### ready

> **ready**: `boolean`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/geoip.ts:92](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L92)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`initialize`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#initialize)

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/geoip.ts:164](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L164)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`initializeAgent`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#initializeagent)

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/geoip.ts:159](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L159)

#### Parameters

##### redisHandler

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`initializeRedis`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#initializeredis)

***

### refresh()

> **refresh**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/geoip.ts:134](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/geoip.ts#L134)

The reference refresh: re-download and swap the reader.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/).[`refresh`](/guard-core-ts/api/core/src/interfaces/geoiphandler/#refresh)
