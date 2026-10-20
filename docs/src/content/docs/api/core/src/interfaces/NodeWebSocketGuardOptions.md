---
editUrl: false
next: false
prev: false
title: "NodeWebSocketGuardOptions"
---

Defined in: [packages/core/src/core/node-websocket-guard.ts:64](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L64)

## Properties

### agentHandler?

> `optional` **agentHandler?**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

Defined in: [packages/core/src/core/node-websocket-guard.ts:66](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L66)

***

### components?

> `optional` **components?**: [`SecurityMiddlewareComponents`](/guard-core-ts/api/core/src/interfaces/securitymiddlewarecomponents/)

Defined in: [packages/core/src/core/node-websocket-guard.ts:73](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L73)

Share the HTTP middleware's initialized components (recommended so the
 WS guard reuses the same Redis/rate-limit/pattern managers). When
 omitted the guard lazily initializes its own components from the
 config, single-flight like the middleware.

***

### config

> **config**: `object`

Defined in: [packages/core/src/core/node-websocket-guard.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L65)

#### agentApiKey?

> `optional` **agentApiKey?**: `string` \| `null`

#### agentBackoffFactor?

> `optional` **agentBackoffFactor?**: `number` \| `null`

#### agentBufferOverflowPolicy?

> `optional` **agentBufferOverflowPolicy?**: `"drop"` \| `"block"` \| `"raise"` \| `null`

#### agentBufferSize?

> `optional` **agentBufferSize?**: `number`

#### agentCompressionEnabled?

> `optional` **agentCompressionEnabled?**: `boolean` \| `null`

#### agentCompressionThreshold?

> `optional` **agentCompressionThreshold?**: `number` \| `null`

#### agentEnableEvents?

> `optional` **agentEnableEvents?**: `boolean`

#### agentEnableMetrics?

> `optional` **agentEnableMetrics?**: `boolean`

#### agentEndpoint?

> `optional` **agentEndpoint?**: `string`

#### agentFlushInterval?

> `optional` **agentFlushInterval?**: `number`

#### agentGuardVersion?

> `optional` **agentGuardVersion?**: `string` \| `null`

#### agentHighWatermarkRatio?

> `optional` **agentHighWatermarkRatio?**: `number` \| `null`

#### agentInstallId?

> `optional` **agentInstallId?**: `string` \| `null`

#### agentMaxConcurrentFlushes?

> `optional` **agentMaxConcurrentFlushes?**: `number` \| `null`

#### agentMaxPayloadSize?

> `optional` **agentMaxPayloadSize?**: `number` \| `null`

#### agentPayloadSigningSecret?

> `optional` **agentPayloadSigningSecret?**: `string` \| `null`

#### agentProjectEncryptionKey?

> `optional` **agentProjectEncryptionKey?**: `string` \| `null`

#### agentProjectId?

> `optional` **agentProjectId?**: `string` \| `null`

#### agentRetryAttempts?

> `optional` **agentRetryAttempts?**: `number`

#### agentSensitiveHeaders?

> `optional` **agentSensitiveHeaders?**: `string`[] \| `null`

#### agentStatusInterval?

> `optional` **agentStatusInterval?**: `number`

#### agentStrict?

> `optional` **agentStrict?**: `boolean`

#### agentTimeout?

> `optional` **agentTimeout?**: `number`

#### authVerifier?

> `optional` **authVerifier?**: (`request`, `credential`) => `unknown`

##### Parameters

###### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

###### credential

`string`

##### Returns

`unknown`

#### autoBanDuration?

> `optional` **autoBanDuration?**: `number`

#### autoBanThreshold?

> `optional` **autoBanThreshold?**: `number`

#### behaviorMaxResponseBodyInspectBytes?

> `optional` **behaviorMaxResponseBodyInspectBytes?**: `number`

#### behaviorScanResponseBody?

> `optional` **behaviorScanResponseBody?**: `boolean`

#### blacklist?

> `optional` **blacklist?**: `string`[]

#### blockCloudProviders?

> `optional` **blockCloudProviders?**: (`"AWS"` \| `"GCP"` \| `"Azure"`)[]

#### blockedCountries?

> `optional` **blockedCountries?**: `string`[]

#### blockedUserAgents?

> `optional` **blockedUserAgents?**: `string`[]

#### bodyReadMaxConcurrent?

> `optional` **bodyReadMaxConcurrent?**: `number`

#### bodyReadTimeout?

> `optional` **bodyReadTimeout?**: `number`

#### cloudIpRefreshInterval?

> `optional` **cloudIpRefreshInterval?**: `number`

#### corsAllowCredentials?

> `optional` **corsAllowCredentials?**: `boolean`

#### corsAllowHeaders?

> `optional` **corsAllowHeaders?**: `string`[]

#### corsAllowMethods?

> `optional` **corsAllowMethods?**: `string`[]

#### corsAllowOrigins?

> `optional` **corsAllowOrigins?**: `string`[]

#### corsExposeHeaders?

> `optional` **corsExposeHeaders?**: `string`[]

#### corsMaxAge?

> `optional` **corsMaxAge?**: `number`

#### customErrorResponses?

> `optional` **customErrorResponses?**: `Record`\<`PropertyKey`, `string`\>

#### customLogFile?

> `optional` **customLogFile?**: `string` \| `null`

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

#### detectionAnomalyEmissionCooldown?

> `optional` **detectionAnomalyEmissionCooldown?**: `number`

#### detectionAnomalyThreshold?

> `optional` **detectionAnomalyThreshold?**: `number`

#### detectionBinaryMinRunLength?

> `optional` **detectionBinaryMinRunLength?**: `number`

#### detectionCompilerTimeout?

> `optional` **detectionCompilerTimeout?**: `number`

#### detectionMaxBodyInspectBytes?

> `optional` **detectionMaxBodyInspectBytes?**: `number`

#### detectionMaxContentLength?

> `optional` **detectionMaxContentLength?**: `number`

#### detectionMaxJsonDepth?

> `optional` **detectionMaxJsonDepth?**: `number`

#### detectionMaxScanChars?

> `optional` **detectionMaxScanChars?**: `number`

#### detectionMaxScanSeconds?

> `optional` **detectionMaxScanSeconds?**: `number`

#### detectionMaxScanValues?

> `optional` **detectionMaxScanValues?**: `number`

#### detectionMaxTrackedPatterns?

> `optional` **detectionMaxTrackedPatterns?**: `number`

#### detectionMinSamplesForAnomaly?

> `optional` **detectionMinSamplesForAnomaly?**: `number`

#### detectionMonitorHistorySize?

> `optional` **detectionMonitorHistorySize?**: `number`

#### detectionPatternValidationCachePath?

> `optional` **detectionPatternValidationCachePath?**: `string` \| `null`

#### detectionPreserveAttackPatterns?

> `optional` **detectionPreserveAttackPatterns?**: `boolean`

#### detectionScanBody?

> `optional` **detectionScanBody?**: `boolean`

#### detectionScanWorkerPool?

> `optional` **detectionScanWorkerPool?**: `boolean`

#### detectionSemanticThreshold?

> `optional` **detectionSemanticThreshold?**: `number`

#### detectionSlowPatternThreshold?

> `optional` **detectionSlowPatternThreshold?**: `number`

#### detectionThreatScoreThreshold?

> `optional` **detectionThreatScoreThreshold?**: `number`

#### dynamicRuleInterval?

> `optional` **dynamicRuleInterval?**: `number`

#### dynamicRulesCachePath?

> `optional` **dynamicRulesCachePath?**: `string` \| `null`

#### emergencyMode?

> `optional` **emergencyMode?**: `boolean`

#### emergencyWhitelist?

> `optional` **emergencyWhitelist?**: `string`[]

#### enableAgent?

> `optional` **enableAgent?**: `boolean`

#### enableCors?

> `optional` **enableCors?**: `boolean`

#### enabledDetectionCategories?

> `optional` **enabledDetectionCategories?**: `string`[]

#### enableDynamicRules?

> `optional` **enableDynamicRules?**: `boolean`

#### enableEnrichment?

> `optional` **enableEnrichment?**: `boolean`

#### enableIpBanning?

> `optional` **enableIpBanning?**: `boolean`

#### enableLogfire?

> `optional` **enableLogfire?**: `boolean`

#### enableOtel?

> `optional` **enableOtel?**: `boolean`

#### enablePenetrationDetection?

> `optional` **enablePenetrationDetection?**: `boolean`

#### enableRateLimitAutoBan?

> `optional` **enableRateLimitAutoBan?**: `boolean`

#### enableRateLimiting?

> `optional` **enableRateLimiting?**: `boolean`

#### enableRedis?

> `optional` **enableRedis?**: `boolean`

#### endpointRateLimits?

> `optional` **endpointRateLimits?**: `Record`\<`string`, \[`number`, `number`\]\>

#### enforceHttps?

> `optional` **enforceHttps?**: `boolean`

#### excludedDetectionBodyFields?

> `optional` **excludedDetectionBodyFields?**: `string`[]

#### excludedDetectionHeaders?

> `optional` **excludedDetectionHeaders?**: `string`[]

#### excludedDetectionParams?

> `optional` **excludedDetectionParams?**: `string`[]

#### excludedSemanticDetectionHeaders?

> `optional` **excludedSemanticDetectionHeaders?**: `string`[]

#### excludePaths?

> `optional` **excludePaths?**: `string`[]

#### exemptIps?

> `optional` **exemptIps?**: `string`[]

#### failSecure?

> `optional` **failSecure?**: `boolean`

#### geoIpDbMaxAge?

> `optional` **geoIpDbMaxAge?**: `number`

#### geoIpHandler?

> `optional` **geoIpHandler?**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

#### geoResolver?

> `optional` **geoResolver?**: (`ip`) => `string` \| `null`

##### Parameters

###### ip

`string`

##### Returns

`string` \| `null`

#### globalBehaviorRules?

> `optional` **globalBehaviorRules?**: `object`[]

#### ipinfoDbPath?

> `optional` **ipinfoDbPath?**: `string`

#### ipinfoToken?

> `optional` **ipinfoToken?**: `string` \| `null`

#### lazyInit?

> `optional` **lazyInit?**: `boolean`

#### logCountryCheckLevel?

> `optional` **logCountryCheckLevel?**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logfireServiceName?

> `optional` **logfireServiceName?**: `string`

#### logFormat?

> `optional` **logFormat?**: `"text"` \| `"json"`

#### logger?

> `optional` **logger?**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### logRequestLevel?

> `optional` **logRequestLevel?**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logSensitiveBodyFields?

> `optional` **logSensitiveBodyFields?**: `string`[]

#### logSensitiveHeaders?

> `optional` **logSensitiveHeaders?**: `string`[]

#### logSensitiveParams?

> `optional` **logSensitiveParams?**: `string`[]

#### logSuspiciousLevel?

> `optional` **logSuspiciousLevel?**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### mutedCheckLogs?

> `optional` **mutedCheckLogs?**: `string`[]

#### mutedEventTypes?

> `optional` **mutedEventTypes?**: `string`[]

#### mutedMetricTypes?

> `optional` **mutedMetricTypes?**: `string`[]

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

#### otelExporterEndpoint?

> `optional` **otelExporterEndpoint?**: `string` \| `null`

#### otelResourceAttributes?

> `optional` **otelResourceAttributes?**: `Record`\<`string`, `string`\>

#### otelServiceName?

> `optional` **otelServiceName?**: `string`

#### passiveMode?

> `optional` **passiveMode?**: `boolean`

#### rateLimit?

> `optional` **rateLimit?**: `number`

#### rateLimitWindow?

> `optional` **rateLimitWindow?**: `number`

#### redisFailOpen?

> `optional` **redisFailOpen?**: `boolean`

#### redisHealthCheckInterval?

> `optional` **redisHealthCheckInterval?**: `number`

#### redisMaxConnections?

> `optional` **redisMaxConnections?**: `number` \| `null`

#### redisPrefix?

> `optional` **redisPrefix?**: `string`

#### redisRetries?

> `optional` **redisRetries?**: `number`

#### redisSocketConnectTimeout?

> `optional` **redisSocketConnectTimeout?**: `number` \| `null`

#### redisSocketTimeout?

> `optional` **redisSocketTimeout?**: `number` \| `null`

#### redisUrl?

> `optional` **redisUrl?**: `string`

#### routeResolutionStrict?

> `optional` **routeResolutionStrict?**: `boolean`

#### securityHeaders?

> `optional` **securityHeaders?**: \{ `contentTypeOptions?`: `string`; `csp?`: `Record`\<`string`, `string`[]\> \| `null`; `custom?`: `Record`\<`string`, `string`\> \| `null`; `enabled?`: `boolean`; `frameOptions?`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains?`: `boolean`; `maxAge?`: `number`; `preload?`: `boolean`; \}; `permissionsPolicy?`: `string`; `referrerPolicy?`: `string`; `xssProtection?`: `string`; \} \| `null`

#### threatBanConfig?

> `optional` **threatBanConfig?**: `Record`\<`string`, \{ `duration`: `number`; `threshold`: `number`; \}\>

#### trustedProxies?

> `optional` **trustedProxies?**: `string`[]

#### trustedProxyDepth?

> `optional` **trustedProxyDepth?**: `number`

#### trustXForwardedProto?

> `optional` **trustXForwardedProto?**: `boolean`

#### whitelist?

> `optional` **whitelist?**: `string`[] \| `null`

#### whitelistCountries?

> `optional` **whitelistCountries?**: `string`[]

***

### geoIpHandler?

> `optional` **geoIpHandler?**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

Defined in: [packages/core/src/core/node-websocket-guard.ts:67](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L67)

***

### guardDecorator?

> `optional` **guardDecorator?**: `unknown`

Defined in: [packages/core/src/core/node-websocket-guard.ts:68](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/node-websocket-guard.ts#L68)
