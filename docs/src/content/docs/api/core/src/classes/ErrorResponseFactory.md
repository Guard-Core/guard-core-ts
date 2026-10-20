---
editUrl: false
next: false
prev: false
title: "ErrorResponseFactory"
---

Defined in: [packages/core/src/core/responses/factory.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L14)

## Constructors

### Constructor

> **new ErrorResponseFactory**(`config`, `logger`, `metricsCollector`, `guardResponseFactory`, `securityHeadersManager`, `agentHandler?`): `ErrorResponseFactory`

Defined in: [packages/core/src/core/responses/factory.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L15)

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

##### metricsCollector

[`MetricsCollector`](/guard-core-ts/api/core/src/classes/metricscollector/)

##### guardResponseFactory

[`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

##### securityHeadersManager

[`SecurityHeadersManager`](/guard-core-ts/api/core/src/classes/securityheadersmanager/)

##### agentHandler?

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

#### Returns

`ErrorResponseFactory`

## Methods

### applyCorsHeaders()

> **applyCorsHeaders**(`response`, `origin`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L60)

#### Parameters

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### origin

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### applyModifier()

> **applyModifier**(`response`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:68](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L68)

#### Parameters

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### applySecurityHeaders()

> **applySecurityHeaders**(`response`, `requestPath?`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L49)

#### Parameters

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### requestPath?

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `defaultMessage`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:35](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L35)

#### Parameters

##### statusCode

`number`

##### defaultMessage

`string`

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### createHttpsRedirect()

> **createHttpsRedirect**(`request`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:43](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L43)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### processResponse()

> **processResponse**(`request`, `response`, `responseTime`, `routeConfig`, `processBehavioralRules?`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [packages/core/src/core/responses/factory.ts:75](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L75)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

##### responseTime

`number`

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

##### processBehavioralRules?

(`request`, `response`, `clientIp`, `routeConfig`) => `Promise`\<`void`\>

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### setBehavioralProcessor()

> **setBehavioralProcessor**(`processor`): `void`

Defined in: [packages/core/src/core/responses/factory.ts:31](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/responses/factory.ts#L31)

#### Parameters

##### processor

[`BehavioralProcessor`](/guard-core-ts/api/core/src/classes/behavioralprocessor/)

#### Returns

`void`
