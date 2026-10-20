---
editUrl: false
next: false
prev: false
title: "BaseSecurityDecorator"
---

Defined in: [packages/core/src/decorators/base.ts:25](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L25)

## Constructors

### Constructor

> **new BaseSecurityDecorator**(`config`, `logger?`): `BaseSecurityDecorator`

Defined in: [packages/core/src/decorators/base.ts:32](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L32)

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

##### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`BaseSecurityDecorator`

## Properties

### agentHandler

> **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null` = `null`

Defined in: [packages/core/src/decorators/base.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L28)

***

### behaviorTracker

> **behaviorTracker**: [`BehaviorTracker`](/guard-core-ts/api/core/src/classes/behaviortracker/)

Defined in: [packages/core/src/decorators/base.ts:27](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L27)

***

### config

> `readonly` **config**: `object`

Defined in: [packages/core/src/decorators/base.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L30)

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

### geoIpHandler

> **geoIpHandler**: `unknown` = `null`

Defined in: [packages/core/src/decorators/base.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L29)

***

### logger

> `readonly` **logger**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

Defined in: [packages/core/src/decorators/base.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L31)

***

### routeConfigs

> **routeConfigs**: `Map`\<`string`, [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)\>

Defined in: [packages/core/src/decorators/base.ts:26](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L26)

## Accessors

### routeConfigRevision

#### Get Signature

> **get** **routeConfigRevision**(): `number`

Defined in: [packages/core/src/decorators/base.ts:42](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L42)

##### Returns

`number`

## Methods

### applyRouteConfig()

> **applyRouteConfig**\<`T`\>(`fn`): `T`

Defined in: [packages/core/src/decorators/base.ts:61](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L61)

#### Type Parameters

##### T

`T` *extends* `Function`

#### Parameters

##### fn

`T`

#### Returns

`T`

***

### ensureRouteConfig()

> **ensureRouteConfig**(`fn`): [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

Defined in: [packages/core/src/decorators/base.ts:50](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L50)

#### Parameters

##### fn

`Function`

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

***

### getRouteConfig()

> **getRouteConfig**(`routeId`): [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `undefined`

Defined in: [packages/core/src/decorators/base.ts:46](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L46)

#### Parameters

##### routeId

`string`

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `undefined`

***

### getRouteId()

> **getRouteId**(`fn`): `string`

Defined in: [packages/core/src/decorators/base.ts:66](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L66)

#### Parameters

##### fn

`Function`

#### Returns

`string`

***

### initializeAgent()

> **initializeAgent**(`agentHandler`, `geoIpHandler?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:77](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L77)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

##### geoIpHandler?

`unknown`

#### Returns

`Promise`\<`void`\>

***

### initializeBehaviorTracking()

> **initializeBehaviorTracking**(`redisHandler?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:73](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L73)

#### Parameters

##### redisHandler?

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### sendAccessDeniedEvent()

> **sendAccessDeniedEvent**(`request`, `reason`, `decoratorType`, `meta?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:114](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L114)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### reason

`string`

##### decoratorType

`string`

##### meta?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### sendAuthenticationFailedEvent()

> **sendAuthenticationFailedEvent**(`request`, `reason`, `authType`, `meta?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:123](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L123)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### reason

`string`

##### authType

`string`

##### meta?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### sendDecoratorEvent()

> **sendDecoratorEvent**(`eventType`, `request`, `actionTaken`, `reason`, `decoratorType`, `meta?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:88](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L88)

#### Parameters

##### eventType

`string`

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### actionTaken

`string`

##### reason

`string`

##### decoratorType

`string`

##### meta?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### sendDecoratorViolationEvent()

> **sendDecoratorViolationEvent**(`request`, `violationType`, `reason`, `meta?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:141](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L141)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### violationType

`string`

##### reason

`string`

##### meta?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### sendRateLimitEvent()

> **sendRateLimitEvent**(`request`, `limit`, `window`, `meta?`): `Promise`\<`void`\>

Defined in: [packages/core/src/decorators/base.ts:132](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/decorators/base.ts#L132)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### limit

`number`

##### window

`number`

##### meta?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>
