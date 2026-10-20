---
editUrl: false
next: false
prev: false
title: "BoundedBodyReaderDeps"
---

Defined in: [packages/core/src/core/bounded-body-reader.ts:175](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L175)

## Properties

### config?

> `optional` **config?**: `object`

Defined in: [packages/core/src/core/bounded-body-reader.ts:176](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L176)

#### agentApiKey

> **agentApiKey**: `string` \| `null`

#### agentBackoffFactor

> **agentBackoffFactor**: `number` \| `null`

#### agentBufferOverflowPolicy

> **agentBufferOverflowPolicy**: `"drop"` \| `"block"` \| `"raise"` \| `null`

#### agentBufferSize

> **agentBufferSize**: `number`

#### agentCompressionEnabled

> **agentCompressionEnabled**: `boolean` \| `null`

#### agentCompressionThreshold

> **agentCompressionThreshold**: `number` \| `null`

#### agentEnableEvents

> **agentEnableEvents**: `boolean`

#### agentEnableMetrics

> **agentEnableMetrics**: `boolean`

#### agentEndpoint

> **agentEndpoint**: `string`

#### agentFlushInterval

> **agentFlushInterval**: `number`

#### agentGuardVersion

> **agentGuardVersion**: `string` \| `null`

#### agentHighWatermarkRatio

> **agentHighWatermarkRatio**: `number` \| `null`

#### agentInstallId

> **agentInstallId**: `string` \| `null`

#### agentMaxConcurrentFlushes

> **agentMaxConcurrentFlushes**: `number` \| `null`

#### agentMaxPayloadSize

> **agentMaxPayloadSize**: `number` \| `null`

#### agentPayloadSigningSecret

> **agentPayloadSigningSecret**: `string` \| `null`

#### agentProjectEncryptionKey

> **agentProjectEncryptionKey**: `string` \| `null`

#### agentProjectId

> **agentProjectId**: `string` \| `null`

#### agentRetryAttempts

> **agentRetryAttempts**: `number`

#### agentSensitiveHeaders

> **agentSensitiveHeaders**: `string`[] \| `null`

#### agentStatusInterval

> **agentStatusInterval**: `number`

#### agentStrict

> **agentStrict**: `boolean`

#### agentTimeout

> **agentTimeout**: `number`

#### authVerifier?

> `optional` **authVerifier?**: (`request`, `credential`) => `unknown`

##### Parameters

###### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

###### credential

`string`

##### Returns

`unknown`

#### autoBanDuration

> **autoBanDuration**: `number`

#### autoBanThreshold

> **autoBanThreshold**: `number`

#### behaviorMaxResponseBodyInspectBytes

> **behaviorMaxResponseBodyInspectBytes**: `number`

#### behaviorScanResponseBody

> **behaviorScanResponseBody**: `boolean`

#### blacklist

> **blacklist**: `string`[]

#### blockCloudProviders

> **blockCloudProviders**: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>

#### blockedCountries

> **blockedCountries**: `string`[]

#### blockedUserAgents

> **blockedUserAgents**: `string`[]

#### bodyReadMaxConcurrent

> **bodyReadMaxConcurrent**: `number`

#### bodyReadTimeout

> **bodyReadTimeout**: `number`

#### cloudIpRefreshInterval

> **cloudIpRefreshInterval**: `number`

#### corsAllowCredentials

> **corsAllowCredentials**: `boolean`

#### corsAllowHeaders

> **corsAllowHeaders**: `string`[]

#### corsAllowMethods

> **corsAllowMethods**: `string`[]

#### corsAllowOrigins

> **corsAllowOrigins**: `string`[]

#### corsExposeHeaders

> **corsExposeHeaders**: `string`[]

#### corsMaxAge

> **corsMaxAge**: `number`

#### customErrorResponses

> **customErrorResponses**: `Record`\<`number`, `string`\>

#### customLogFile

> **customLogFile**: `string` \| `null`

#### customRequestCheck?

> `optional` **customRequestCheck?**: (`req`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

##### Parameters

###### req

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/) \| `null`\>

#### customResponseModifier?

> `optional` **customResponseModifier?**: (`res`) => `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

##### Parameters

###### res

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

#### detectionAnomalyEmissionCooldown

> **detectionAnomalyEmissionCooldown**: `number`

#### detectionAnomalyThreshold

> **detectionAnomalyThreshold**: `number`

#### detectionBinaryMinRunLength

> **detectionBinaryMinRunLength**: `number`

#### detectionCompilerTimeout

> **detectionCompilerTimeout**: `number`

#### detectionMaxBodyInspectBytes

> **detectionMaxBodyInspectBytes**: `number`

#### detectionMaxContentLength

> **detectionMaxContentLength**: `number`

#### detectionMaxJsonDepth

> **detectionMaxJsonDepth**: `number`

#### detectionMaxScanChars

> **detectionMaxScanChars**: `number`

#### detectionMaxScanSeconds

> **detectionMaxScanSeconds**: `number`

#### detectionMaxScanValues

> **detectionMaxScanValues**: `number`

#### detectionMaxTrackedPatterns

> **detectionMaxTrackedPatterns**: `number`

#### detectionMinSamplesForAnomaly

> **detectionMinSamplesForAnomaly**: `number`

#### detectionMonitorHistorySize

> **detectionMonitorHistorySize**: `number`

#### detectionPatternValidationCachePath

> **detectionPatternValidationCachePath**: `string` \| `null`

#### detectionPreserveAttackPatterns

> **detectionPreserveAttackPatterns**: `boolean`

#### detectionScanBody

> **detectionScanBody**: `boolean`

#### detectionScanWorkerPool

> **detectionScanWorkerPool**: `boolean`

#### detectionSemanticThreshold

> **detectionSemanticThreshold**: `number`

#### detectionSlowPatternThreshold

> **detectionSlowPatternThreshold**: `number`

#### detectionThreatScoreThreshold

> **detectionThreatScoreThreshold**: `number`

#### dynamicRuleInterval

> **dynamicRuleInterval**: `number`

#### dynamicRulesCachePath

> **dynamicRulesCachePath**: `string` \| `null`

#### emergencyMode

> **emergencyMode**: `boolean`

#### emergencyWhitelist

> **emergencyWhitelist**: `string`[]

#### enableAgent

> **enableAgent**: `boolean`

#### enableCors

> **enableCors**: `boolean`

#### enabledDetectionCategories

> **enabledDetectionCategories**: `string`[]

#### enableDynamicRules

> **enableDynamicRules**: `boolean`

#### enableEnrichment

> **enableEnrichment**: `boolean`

#### enableIpBanning

> **enableIpBanning**: `boolean`

#### enableLogfire

> **enableLogfire**: `boolean`

#### enableOtel

> **enableOtel**: `boolean`

#### enablePenetrationDetection

> **enablePenetrationDetection**: `boolean`

#### enableRateLimitAutoBan

> **enableRateLimitAutoBan**: `boolean`

#### enableRateLimiting

> **enableRateLimiting**: `boolean`

#### enableRedis

> **enableRedis**: `boolean`

#### endpointRateLimits

> **endpointRateLimits**: `Record`\<`string`, \[`number`, `number`\]\>

#### enforceHttps

> **enforceHttps**: `boolean`

#### excludedDetectionBodyFields

> **excludedDetectionBodyFields**: `string`[]

#### excludedDetectionHeaders

> **excludedDetectionHeaders**: `string`[]

#### excludedDetectionParams

> **excludedDetectionParams**: `string`[]

#### excludedSemanticDetectionHeaders

> **excludedSemanticDetectionHeaders**: `string`[]

#### excludePaths

> **excludePaths**: `string`[]

#### exemptIps

> **exemptIps**: `string`[]

#### failSecure

> **failSecure**: `boolean`

#### geoIpDbMaxAge

> **geoIpDbMaxAge**: `number`

#### geoIpHandler?

> `optional` **geoIpHandler?**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

#### geoResolver?

> `optional` **geoResolver?**: (`ip`) => `string` \| `null`

##### Parameters

###### ip

`string`

##### Returns

`string` \| `null`

#### globalBehaviorRules

> **globalBehaviorRules**: `object`[]

#### ipinfoDbPath

> **ipinfoDbPath**: `string`

#### ipinfoToken

> **ipinfoToken**: `string` \| `null`

#### lazyInit

> **lazyInit**: `boolean`

#### logCountryCheckLevel

> **logCountryCheckLevel**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logfireServiceName

> **logfireServiceName**: `string`

#### logFormat

> **logFormat**: `"text"` \| `"json"`

#### logger?

> `optional` **logger?**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### logRequestLevel

> **logRequestLevel**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logSensitiveBodyFields

> **logSensitiveBodyFields**: `string`[]

#### logSensitiveHeaders

> **logSensitiveHeaders**: `string`[]

#### logSensitiveParams

> **logSensitiveParams**: `string`[]

#### logSuspiciousLevel

> **logSuspiciousLevel**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### mutedCheckLogs

> **mutedCheckLogs**: `string`[]

#### mutedEventTypes

> **mutedEventTypes**: `string`[]

#### mutedMetricTypes

> **mutedMetricTypes**: `string`[]

#### onBlock?

> `optional` **onBlock?**: (`request`, `payload`) => `unknown`

##### Parameters

###### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

###### payload

`Record`\<`string`, `unknown`\>

##### Returns

`unknown`

#### onError?

> `optional` **onError?**: (`stage`, `error`, `context`) => `void`

##### Parameters

###### stage

`string`

###### error

`unknown`

###### context

`Record`\<`string`, `unknown`\>

##### Returns

`void`

#### otelExporterEndpoint

> **otelExporterEndpoint**: `string` \| `null`

#### otelResourceAttributes

> **otelResourceAttributes**: `Record`\<`string`, `string`\>

#### otelServiceName

> **otelServiceName**: `string`

#### passiveMode

> **passiveMode**: `boolean`

#### rateLimit

> **rateLimit**: `number`

#### rateLimitWindow

> **rateLimitWindow**: `number`

#### redisFailOpen

> **redisFailOpen**: `boolean`

#### redisHealthCheckInterval

> **redisHealthCheckInterval**: `number`

#### redisMaxConnections

> **redisMaxConnections**: `number` \| `null`

#### redisPrefix

> **redisPrefix**: `string`

#### redisRetries

> **redisRetries**: `number`

#### redisSocketConnectTimeout

> **redisSocketConnectTimeout**: `number` \| `null`

#### redisSocketTimeout

> **redisSocketTimeout**: `number` \| `null`

#### redisUrl

> **redisUrl**: `string`

#### routeResolutionStrict

> **routeResolutionStrict**: `boolean`

#### securityHeaders

> **securityHeaders**: \{ `contentTypeOptions`: `string`; `csp`: `Record`\<`string`, `string`[]\> \| `null`; `custom`: `Record`\<`string`, `string`\> \| `null`; `enabled`: `boolean`; `frameOptions`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains`: `boolean`; `maxAge`: `number`; `preload`: `boolean`; \}; `permissionsPolicy`: `string`; `referrerPolicy`: `string`; `xssProtection`: `string`; \} \| `null`

#### threatBanConfig

> **threatBanConfig**: `Record`\<`string`, \{ `duration`: `number`; `threshold`: `number`; \}\>

#### trustedProxies

> **trustedProxies**: `string`[]

#### trustedProxyDepth

> **trustedProxyDepth**: `number`

#### trustXForwardedProto

> **trustXForwardedProto**: `boolean`

#### whitelist

> **whitelist**: `string`[] \| `null`

#### whitelistCountries

> **whitelistCountries**: `string`[]

***

### logger

> **logger**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

Defined in: [packages/core/src/core/bounded-body-reader.ts:177](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L177)

***

### longestPatternLength?

> `optional` **longestPatternLength?**: `number` \| `null`

Defined in: [packages/core/src/core/bounded-body-reader.ts:180](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/bounded-body-reader.ts#L180)

Longest compiled detection pattern length (for the prefix over-read);
 null when unavailable, which disables the over-read.
