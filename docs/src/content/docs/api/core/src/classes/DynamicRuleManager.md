---
editUrl: false
next: false
prev: false
title: "DynamicRuleManager"
---

Defined in: [packages/core/src/handlers/dynamic-rules.ts:79](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L79)

## Constructors

### Constructor

> **new DynamicRuleManager**(`config`, `logger`, `targets?`): `DynamicRuleManager`

Defined in: [packages/core/src/handlers/dynamic-rules.ts:98](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L98)

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

##### targets?

`DynamicRuleTargets` = `{}`

#### Returns

`DynamicRuleManager`

## Methods

### forceUpdate()

> **forceUpdate**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:687](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L687)

#### Returns

`Promise`\<`void`\>

***

### getCurrentRules()

> **getCurrentRules**(): \{ `autoBanDuration`: `number` \| `null`; `autoBanThreshold`: `number` \| `null`; `blockedCloudProviders`: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>; `blockedCountries`: `string`[]; `blockedUserAgents`: `string`[]; `emergencyMode`: `boolean`; `emergencyWhitelist`: `string`[]; `enableIpBanning`: `boolean` \| `null`; `enablePenetrationDetection`: `boolean` \| `null`; `enableRateLimitAutoBan`: `boolean` \| `null`; `enableRateLimiting`: `boolean` \| `null`; `endpointRateLimits`: `Record`\<`string`, \[`number`, `number`\]\>; `expiresAt`: `string` \| `null`; `globalRateLimit`: `number` \| `null`; `globalRateWindow`: `number` \| `null`; `ipBanDuration`: `number`; `ipBlacklist`: `string`[]; `ipWhitelist`: `string`[]; `ruleId`: `string`; `suspiciousPatterns`: `string`[]; `timestamp`: `string`; `ttl`: `number`; `version`: `number`; `whitelistCountries`: `string`[]; \} \| `null`

Defined in: [packages/core/src/handlers/dynamic-rules.ts:397](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L397)

#### Returns

\{ `autoBanDuration`: `number` \| `null`; `autoBanThreshold`: `number` \| `null`; `blockedCloudProviders`: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>; `blockedCountries`: `string`[]; `blockedUserAgents`: `string`[]; `emergencyMode`: `boolean`; `emergencyWhitelist`: `string`[]; `enableIpBanning`: `boolean` \| `null`; `enablePenetrationDetection`: `boolean` \| `null`; `enableRateLimitAutoBan`: `boolean` \| `null`; `enableRateLimiting`: `boolean` \| `null`; `endpointRateLimits`: `Record`\<`string`, \[`number`, `number`\]\>; `expiresAt`: `string` \| `null`; `globalRateLimit`: `number` \| `null`; `globalRateWindow`: `number` \| `null`; `ipBanDuration`: `number`; `ipBlacklist`: `string`[]; `ipWhitelist`: `string`[]; `ruleId`: `string`; `suspiciousPatterns`: `string`[]; `timestamp`: `string`; `ttl`: `number`; `version`: `number`; `whitelistCountries`: `string`[]; \} \| `null`

***

### hydrateLastKnownRules()

> **hydrateLastKnownRules**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:125](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L125)

#### Returns

`Promise`\<`void`\>

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:104](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L104)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeRedis()

> **initializeRedis**(`redisHandler`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:115](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L115)

#### Parameters

##### redisHandler

[`RedisManager`](/guard-core-ts/api/core/src/classes/redismanager/)

#### Returns

`Promise`\<`void`\>

***

### loadLastKnownRules()

> **loadLastKnownRules**(): `Promise`\<\{ `autoBanDuration`: `number` \| `null`; `autoBanThreshold`: `number` \| `null`; `blockedCloudProviders`: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>; `blockedCountries`: `string`[]; `blockedUserAgents`: `string`[]; `emergencyMode`: `boolean`; `emergencyWhitelist`: `string`[]; `enableIpBanning`: `boolean` \| `null`; `enablePenetrationDetection`: `boolean` \| `null`; `enableRateLimitAutoBan`: `boolean` \| `null`; `enableRateLimiting`: `boolean` \| `null`; `endpointRateLimits`: `Record`\<`string`, \[`number`, `number`\]\>; `expiresAt`: `string` \| `null`; `globalRateLimit`: `number` \| `null`; `globalRateWindow`: `number` \| `null`; `ipBanDuration`: `number`; `ipBlacklist`: `string`[]; `ipWhitelist`: `string`[]; `ruleId`: `string`; `suspiciousPatterns`: `string`[]; `timestamp`: `string`; `ttl`: `number`; `version`: `number`; `whitelistCountries`: `string`[]; \} \| `null`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:149](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L149)

#### Returns

`Promise`\<\{ `autoBanDuration`: `number` \| `null`; `autoBanThreshold`: `number` \| `null`; `blockedCloudProviders`: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>; `blockedCountries`: `string`[]; `blockedUserAgents`: `string`[]; `emergencyMode`: `boolean`; `emergencyWhitelist`: `string`[]; `enableIpBanning`: `boolean` \| `null`; `enablePenetrationDetection`: `boolean` \| `null`; `enableRateLimitAutoBan`: `boolean` \| `null`; `enableRateLimiting`: `boolean` \| `null`; `endpointRateLimits`: `Record`\<`string`, \[`number`, `number`\]\>; `expiresAt`: `string` \| `null`; `globalRateLimit`: `number` \| `null`; `globalRateWindow`: `number` \| `null`; `ipBanDuration`: `number`; `ipBlacklist`: `string`[]; `ipWhitelist`: `string`[]; `ruleId`: `string`; `suspiciousPatterns`: `string`[]; `timestamp`: `string`; `ttl`: `number`; `version`: `number`; `whitelistCountries`: `string`[]; \} \| `null`\>

***

### matchEvent()

> **matchEvent**(`event`): \{ `ruleId`: `string`; `version`: `number`; \} \| `null`

Defined in: [packages/core/src/handlers/dynamic-rules.ts:637](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L637)

#### Parameters

##### event

###### country?

`string` \| `null`

###### eventType?

`string` \| `null`

###### ipAddress?

`string` \| `null`

#### Returns

\{ `ruleId`: `string`; `version`: `number`; \} \| `null`

***

### persistLastKnownRules()

> **persistLastKnownRules**(`rules`): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:239](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L239)

#### Parameters

##### rules

###### autoBanDuration

`number` \| `null` = `...`

###### autoBanThreshold

`number` \| `null` = `...`

###### blockedCloudProviders

`Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\> = `...`

###### blockedCountries

`string`[] = `...`

###### blockedUserAgents

`string`[] = `...`

###### emergencyMode

`boolean` = `...`

###### emergencyWhitelist

`string`[] = `...`

###### enableIpBanning

`boolean` \| `null` = `...`

###### enablePenetrationDetection

`boolean` \| `null` = `...`

###### enableRateLimitAutoBan

`boolean` \| `null` = `...`

###### enableRateLimiting

`boolean` \| `null` = `...`

###### endpointRateLimits

`Record`\<`string`, \[`number`, `number`\]\> = `...`

###### expiresAt

`string` \| `null` = `...`

###### globalRateLimit

`number` \| `null` = `...`

###### globalRateWindow

`number` \| `null` = `...`

###### ipBanDuration

`number` = `...`

###### ipBlacklist

`string`[] = `...`

###### ipWhitelist

`string`[] = `...`

###### ruleId

`string` = `...`

###### suspiciousPatterns

`string`[] = `...`

###### timestamp

`string` = `...`

###### ttl

`number` = `...`

###### version

`number` = `...`

###### whitelistCountries

`string`[] = `...`

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:691](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L691)

#### Returns

`Promise`\<`void`\>

***

### updateRules()

> **updateRules**(): `Promise`\<`void`\>

Defined in: [packages/core/src/handlers/dynamic-rules.ts:307](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/handlers/dynamic-rules.ts#L307)

#### Returns

`Promise`\<`void`\>
