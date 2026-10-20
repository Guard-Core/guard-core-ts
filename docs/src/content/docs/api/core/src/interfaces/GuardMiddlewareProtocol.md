---
editUrl: false
next: false
prev: false
title: "GuardMiddlewareProtocol"
---

Defined in: [packages/core/src/protocols/middleware.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L7)

## Properties

### agentHandler

> `readonly` **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

Defined in: [packages/core/src/protocols/middleware.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L20)

***

### config

> `readonly` **config**: `object`

Defined in: [packages/core/src/protocols/middleware.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L8)

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

### eventBus

> `readonly` **eventBus**: `unknown`

Defined in: [packages/core/src/protocols/middleware.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L16)

***

### geoIpHandler

> `readonly` **geoIpHandler**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/) \| `null`

Defined in: [packages/core/src/protocols/middleware.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L21)

***

### guardResponseFactory

> `readonly` **guardResponseFactory**: [`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

Defined in: [packages/core/src/protocols/middleware.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L22)

***

### lastCloudIpRefresh

> **lastCloudIpRefresh**: `number`

Defined in: [packages/core/src/protocols/middleware.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L10)

***

### logger

> `readonly` **logger**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

Defined in: [packages/core/src/protocols/middleware.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L9)

***

### rateLimitHandler

> `readonly` **rateLimitHandler**: `unknown`

Defined in: [packages/core/src/protocols/middleware.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L19)

***

### responseFactory

> `readonly` **responseFactory**: `unknown`

Defined in: [packages/core/src/protocols/middleware.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L18)

***

### routeResolver

> `readonly` **routeResolver**: `unknown`

Defined in: [packages/core/src/protocols/middleware.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L17)

***

### suspiciousRequestCounts

> **suspiciousRequestCounts**: `Map`\<`string`, `Map`\<`string`, `number`\>\>

Defined in: [packages/core/src/protocols/middleware.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L15)

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `defaultMessage`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/protocols/middleware.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L23)

#### Parameters

##### statusCode

`number`

##### defaultMessage

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### refreshCloudIpRanges()

> **refreshCloudIpRanges**(): `Promise`\<`void`\>

Defined in: [packages/core/src/protocols/middleware.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/protocols/middleware.ts#L24)

#### Returns

`Promise`\<`void`\>
