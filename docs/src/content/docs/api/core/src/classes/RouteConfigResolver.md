---
editUrl: false
next: false
prev: false
title: "RouteConfigResolver"
---

Defined in: [packages/core/src/core/routing/resolver.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L15)

## Constructors

### Constructor

> **new RouteConfigResolver**(`config`): `RouteConfigResolver`

Defined in: [packages/core/src/core/routing/resolver.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L19)

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

#### Returns

`RouteConfigResolver`

## Methods

### getCloudProvidersToCheck()

> **getCloudProvidersToCheck**(`routeConfig`): `string`[] \| `null`

Defined in: [packages/core/src/core/routing/resolver.ts:101](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L101)

#### Parameters

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

#### Returns

`string`[] \| `null`

***

### getRouteConfig()

> **getRouteConfig**(`request`): [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

Defined in: [packages/core/src/core/routing/resolver.ts:58](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L58)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

***

### registerPathRouteConfigs()

> **registerPathRouteConfigs**(`entries`): `void`

Defined in: [packages/core/src/core/routing/resolver.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L30)

Adapter-registered per-route configs (the routeConfigs middleware /
 plugin / module option). Registered entries are matched in longest-path
 order; a routeId lookup through a decorator always wins over them.

#### Parameters

##### entries

[`PathRouteConfigEntry`](/guard-core-ts/api/core/src/interfaces/pathrouteconfigentry/)[]

#### Returns

`void`

***

### setGuardDecorator()

> **setGuardDecorator**(`decorator`): `void`

Defined in: [packages/core/src/core/routing/resolver.ts:23](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L23)

#### Parameters

##### decorator

`unknown`

#### Returns

`void`

***

### shouldBypassCheck()

> **shouldBypassCheck**(`checkName`, `routeConfig`): `boolean`

Defined in: [packages/core/src/core/routing/resolver.ts:96](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/routing/resolver.ts#L96)

#### Parameters

##### checkName

`string`

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

#### Returns

`boolean`
