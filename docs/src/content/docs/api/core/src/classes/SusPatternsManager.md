---
editUrl: false
next: false
prev: false
title: "SusPatternsManager"
---

Defined in: [packages/core/src/handlers/sus-patterns.ts:204](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L204)

## Constructors

### Constructor

> **new SusPatternsManager**(`config`, `logger`, `scanPool?`): `SusPatternsManager`

Defined in: [packages/core/src/handlers/sus-patterns.ts:220](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L220)

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

##### scanPool?

`ScanPoolSupervisor`

#### Returns

`SusPatternsManager`

## Accessors

### detectionBinaryMinRunLength

#### Get Signature

> **get** **detectionBinaryMinRunLength**(): `number`

Defined in: [packages/core/src/handlers/sus-patterns.ts:266](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L266)

detection_binary_min_run_length: the printable-run threshold the
 multipart binary-islands reduction hands to the pattern scan.

##### Returns

`number`

## Methods

### addPattern()

> **addPattern**(`pattern`, `custom?`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:928](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L928)

#### Parameters

##### pattern

`string`

##### custom?

`boolean` = `true`

#### Returns

`Promise`\<`boolean`\>

***

### configureSemanticThreshold()

> **configureSemanticThreshold**(`threshold`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:1030](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L1030)

#### Parameters

##### threshold

`number`

#### Returns

`Promise`\<`void`\>

***

### detect()

> **detect**(`content`, `ipAddress`, `context?`, `correlationId?`, `options?`): `Promise`\<`DetectionResult`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:712](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L712)

#### Parameters

##### content

`string`

##### ipAddress

`string`

##### context?

`string` = `'unknown'`

##### correlationId?

`string` \| `null`

##### options?

###### scanTime?

`ScanTimeBudget`

###### semanticExcludedHeaders?

`ReadonlySet`\<`string`\>

###### skipCategories?

`ReadonlySet`\<`string`\>

#### Returns

`Promise`\<`DetectionResult`\>

***

### detectPatternMatch()

> **detectPatternMatch**(`content`, `ipAddress`, `context?`, `correlationId?`): `Promise`\<\[`boolean`, `string` \| `null`\]\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:905](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L905)

#### Parameters

##### content

`string`

##### ipAddress

`string`

##### context?

`string` = `'unknown'`

##### correlationId?

`string` \| `null`

#### Returns

`Promise`\<\[`boolean`, `string` \| `null`\]\>

***

### getAllPatterns()

> **getAllPatterns**(): `string`[]

Defined in: [packages/core/src/handlers/sus-patterns.ts:997](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L997)

#### Returns

`string`[]

***

### getComponentStatus()

> **getComponentStatus**(): `Record`\<`string`, `boolean`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:1021](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L1021)

#### Returns

`Record`\<`string`, `boolean`\>

***

### getCustomPatterns()

> **getCustomPatterns**(): `string`[]

Defined in: [packages/core/src/handlers/sus-patterns.ts:993](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L993)

#### Returns

`string`[]

***

### getDefaultPatterns()

> **getDefaultPatterns**(): `string`[]

Defined in: [packages/core/src/handlers/sus-patterns.ts:989](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L989)

#### Returns

`string`[]

***

### getLongestPatternLength()

> **getLongestPatternLength**(): `number`

Defined in: [packages/core/src/handlers/sus-patterns.ts:1005](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L1005)

#### Returns

`number`

***

### getPerformanceStats()

> **getPerformanceStats**(): `Promise`\<`Record`\<`string`, `unknown`\> \| `null`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:1013](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L1013)

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\> \| `null`\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:282](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L282)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:270](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L270)

#### Parameters

##### redisHandler

[`RedisManager`](/guard-core-ts/api/core/src/classes/redismanager/)

#### Returns

`Promise`\<`void`\>

***

### removePattern()

> **removePattern**(`pattern`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:961](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L961)

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`void`\>

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/sus-patterns.ts:1034](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/sus-patterns.ts#L1034)

#### Returns

`Promise`\<`void`\>
