---
editUrl: false
next: false
prev: false
title: "RedisManager"
---

Defined in: [packages/core/src/handlers/redis.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L56)

## Implements

- [`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

## Constructors

### Constructor

> **new RedisManager**(`config`, `logger`): `RedisManager`

Defined in: [packages/core/src/handlers/redis.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L65)

#### Parameters

##### config

###### agentApiKey

`string` \| `null` = `...`

###### agentBackoffFactor

`number` \| `null` = `...`

###### agentBufferOverflowPolicy

`"drop"` \| `"block"` \| `"raise"` \| `null` = `...`

###### agentBufferSize

`number` = `...`

###### agentCompressionEnabled

`boolean` \| `null` = `...`

###### agentCompressionThreshold

`number` \| `null` = `...`

###### agentEnableEvents

`boolean` = `...`

###### agentEnableMetrics

`boolean` = `...`

###### agentEndpoint

`string` = `...`

###### agentFlushInterval

`number` = `...`

###### agentGuardVersion

`string` \| `null` = `...`

###### agentHighWatermarkRatio

`number` \| `null` = `...`

###### agentInstallId

`string` \| `null` = `...`

###### agentMaxConcurrentFlushes

`number` \| `null` = `...`

###### agentMaxPayloadSize

`number` \| `null` = `...`

###### agentPayloadSigningSecret

`string` \| `null` = `...`

###### agentProjectEncryptionKey

`string` \| `null` = `...`

###### agentProjectId

`string` \| `null` = `...`

###### agentRetryAttempts

`number` = `...`

###### agentSensitiveHeaders

`string`[] \| `null` = `...`

###### agentStatusInterval

`number` = `...`

###### agentStrict

`boolean` = `...`

###### agentTimeout

`number` = `...`

###### authVerifier?

(`request`, `credential`) => `unknown` = `...`

###### autoBanDuration

`number` = `...`

###### autoBanThreshold

`number` = `...`

###### behaviorMaxResponseBodyInspectBytes

`number` = `...`

###### behaviorScanResponseBody

`boolean` = `...`

###### blacklist

`string`[] = `...`

###### blockCloudProviders

`Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\> = `...`

###### blockedCountries

`string`[] = `...`

###### blockedUserAgents

`string`[] = `...`

###### bodyReadMaxConcurrent

`number` = `...`

###### bodyReadTimeout

`number` = `...`

###### cloudIpRefreshInterval

`number` = `...`

###### corsAllowCredentials

`boolean` = `...`

###### corsAllowHeaders

`string`[] = `...`

###### corsAllowMethods

`string`[] = `...`

###### corsAllowOrigins

`string`[] = `...`

###### corsExposeHeaders

`string`[] = `...`

###### corsMaxAge

`number` = `...`

###### customErrorResponses

`Record`\<`number`, `string`\> = `...`

###### customLogFile

`string` \| `null` = `...`

###### customRequestCheck?

(`req`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\> = `...`

###### customResponseModifier?

(`res`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\> = `...`

###### detectionAnomalyEmissionCooldown

`number` = `...`

###### detectionAnomalyThreshold

`number` = `...`

###### detectionBinaryMinRunLength

`number` = `...`

###### detectionCompilerTimeout

`number` = `...`

###### detectionMaxBodyInspectBytes

`number` = `...`

###### detectionMaxContentLength

`number` = `...`

###### detectionMaxJsonDepth

`number` = `...`

###### detectionMaxScanChars

`number` = `...`

###### detectionMaxScanSeconds

`number` = `...`

###### detectionMaxScanValues

`number` = `...`

###### detectionMaxTrackedPatterns

`number` = `...`

###### detectionMinSamplesForAnomaly

`number` = `...`

###### detectionMonitorHistorySize

`number` = `...`

###### detectionPatternValidationCachePath

`string` \| `null` = `...`

###### detectionPreserveAttackPatterns

`boolean` = `...`

###### detectionScanBody

`boolean` = `...`

###### detectionScanWorkerPool

`boolean` = `...`

###### detectionSemanticThreshold

`number` = `...`

###### detectionSlowPatternThreshold

`number` = `...`

###### detectionThreatScoreThreshold

`number` = `...`

###### dynamicRuleInterval

`number` = `...`

###### dynamicRulesCachePath

`string` \| `null` = `...`

###### emergencyMode

`boolean` = `...`

###### emergencyWhitelist

`string`[] = `...`

###### enableAgent

`boolean` = `...`

###### enableCors

`boolean` = `...`

###### enabledDetectionCategories

`string`[] = `...`

###### enableDynamicRules

`boolean` = `...`

###### enableEnrichment

`boolean` = `...`

###### enableIpBanning

`boolean` = `...`

###### enableLogfire

`boolean` = `...`

###### enableOtel

`boolean` = `...`

###### enablePenetrationDetection

`boolean` = `...`

###### enableRateLimitAutoBan

`boolean` = `...`

###### enableRateLimiting

`boolean` = `...`

###### enableRedis

`boolean` = `...`

###### endpointRateLimits

`Record`\<`string`, \[`number`, `number`\]\> = `...`

###### enforceHttps

`boolean` = `...`

###### excludedDetectionBodyFields

`string`[] = `...`

###### excludedDetectionHeaders

`string`[] = `...`

###### excludedDetectionParams

`string`[] = `...`

###### excludedSemanticDetectionHeaders

`string`[] = `...`

###### excludePaths

`string`[] = `...`

###### exemptIps

`string`[] = `...`

###### failSecure

`boolean` = `...`

###### geoIpDbMaxAge

`number` = `...`

###### geoIpHandler?

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/) = `...`

###### geoResolver?

(`ip`) => `string` \| `null` = `...`

###### globalBehaviorRules

`object`[] = `...`

###### ipinfoDbPath

`string` = `...`

###### ipinfoToken

`string` \| `null` = `...`

###### lazyInit

`boolean` = `...`

###### logCountryCheckLevel

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null` = `...`

###### logfireServiceName

`string` = `...`

###### logFormat

`"text"` \| `"json"` = `...`

###### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/) = `...`

###### logRequestLevel

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null` = `...`

###### logSensitiveBodyFields

`string`[] = `...`

###### logSensitiveHeaders

`string`[] = `...`

###### logSensitiveParams

`string`[] = `...`

###### logSuspiciousLevel

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null` = `...`

###### mutedCheckLogs

`string`[] = `...`

###### mutedEventTypes

`string`[] = `...`

###### mutedMetricTypes

`string`[] = `...`

###### onBlock?

(`request`, `payload`) => `unknown` = `...`

###### onError?

(`stage`, `error`, `context`) => `void` = `...`

###### otelExporterEndpoint

`string` \| `null` = `...`

###### otelResourceAttributes

`Record`\<`string`, `string`\> = `...`

###### otelServiceName

`string` = `...`

###### passiveMode

`boolean` = `...`

###### rateLimit

`number` = `...`

###### rateLimitWindow

`number` = `...`

###### redisFailOpen

`boolean` = `...`

###### redisHealthCheckInterval

`number` = `...`

###### redisMaxConnections

`number` \| `null` = `...`

###### redisPrefix

`string` = `...`

###### redisRetries

`number` = `...`

###### redisSocketConnectTimeout

`number` \| `null` = `...`

###### redisSocketTimeout

`number` \| `null` = `...`

###### redisUrl

`string` = `...`

###### routeResolutionStrict

`boolean` = `...`

###### securityHeaders

\{ `contentTypeOptions`: `string`; `csp`: `Record`\<`string`, `string`[]\> \| `null`; `custom`: `Record`\<`string`, `string`\> \| `null`; `enabled`: `boolean`; `frameOptions`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains`: `boolean`; `maxAge`: `number`; `preload`: `boolean`; \}; `permissionsPolicy`: `string`; `referrerPolicy`: `string`; `xssProtection`: `string`; \} \| `null` = `...`

###### threatBanConfig

`Record`\<`string`, \{ `duration`: `number`; `threshold`: `number`; \}\> = `...`

###### trustedProxies

`string`[] = `...`

###### trustedProxyDepth

`number` = `...`

###### trustXForwardedProto

`boolean` = `...`

###### whitelist

`string`[] \| `null` = `...`

###### whitelistCountries

`string`[] = `...`

##### logger

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`RedisManager`

## Properties

### safeOperationDepth

> **safeOperationDepth**: `number` = `0`

Defined in: [packages/core/src/handlers/redis.ts:63](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L63)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/redis.ts:133](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L133)

#### Returns

`Promise`\<`void`\>

***

### delete()

> **delete**(`namespace`, `key`): `Promise`\<`number` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:274](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L274)

#### Parameters

##### namespace

`string`

##### key

`string`

#### Returns

`Promise`\<`number` \| `null`\>

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`delete`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#delete)

***

### deletePattern()

> **deletePattern**(`pattern`): `Promise`\<`number` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:292](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L292)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`number` \| `null`\>

***

### exists()

> **exists**(`namespace`, `key`): `Promise`\<`boolean` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:264](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L264)

#### Parameters

##### namespace

`string`

##### key

`string`

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### getConnection()

> **getConnection**(): `AsyncDisposable`

Defined in: [packages/core/src/handlers/redis.ts:177](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L177)

#### Returns

`AsyncDisposable`

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`getConnection`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#getconnection)

***

### getKey()

> **getKey**(`namespace`, `key`): `Promise`\<`unknown`\>

Defined in: [packages/core/src/handlers/redis.ts:225](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L225)

#### Parameters

##### namespace

`string`

##### key

`string`

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`getKey`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#getkey)

***

### getRawClient()

> **getRawClient**(): `RedisClient` \| `null`

Defined in: [packages/core/src/handlers/redis.ts:303](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L303)

#### Returns

`RedisClient` \| `null`

***

### incr()

> **incr**(`namespace`, `key`, `ttl?`): `Promise`\<`number` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:250](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L250)

#### Parameters

##### namespace

`string`

##### key

`string`

##### ttl?

`number`

#### Returns

`Promise`\<`number` \| `null`\>

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/redis.ts:72](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L72)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`initialize`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#initialize)

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/redis.ts:146](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L146)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### keys()

> **keys**(`pattern`): `Promise`\<`string`[] \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:283](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L283)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`string`[] \| `null`\>

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`keys`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#keys)

***

### safeOperation()

> **safeOperation**\<`T`\>(`func`, ...`args`): `Promise`\<`T` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:193](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L193)

#### Type Parameters

##### T

`T`

#### Parameters

##### func

(`client`) => `Promise`\<`T`\>

##### args

...`unknown`[]

#### Returns

`Promise`\<`T` \| `null`\>

***

### setKey()

> **setKey**(`namespace`, `key`, `value`, `ttl?`): `Promise`\<`boolean` \| `null`\>

Defined in: [packages/core/src/handlers/redis.ts:234](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/redis.ts#L234)

#### Parameters

##### namespace

`string`

##### key

`string`

##### value

`unknown`

##### ttl?

`number` \| `null`

#### Returns

`Promise`\<`boolean` \| `null`\>

#### Implementation of

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/).[`setKey`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/#setkey)
