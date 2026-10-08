---
editUrl: false
next: false
prev: false
title: "ErrorResponseFactory"
---

Defined in: [core/src/core/responses/factory.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L10)

## Constructors

### Constructor

> **new ErrorResponseFactory**(`config`, `logger`, `metricsCollector`, `guardResponseFactory`, `securityHeadersManager`, `agentHandler?`): `ErrorResponseFactory`

Defined in: [core/src/core/responses/factory.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L11)

#### Parameters

##### config

###### agentApiKey

`string` \| `null` = `...`

###### agentBufferSize

`number` = `...`

###### agentEnableEvents

`boolean` = `...`

###### agentEnableMetrics

`boolean` = `...`

###### agentEndpoint

`string` = `...`

###### agentFlushInterval

`number` = `...`

###### agentProjectId

`string` \| `null` = `...`

###### agentRetryAttempts

`number` = `...`

###### agentTimeout

`number` = `...`

###### autoBanDuration

`number` = `...`

###### autoBanThreshold

`number` = `...`

###### blacklist

`string`[] = `...`

###### blockCloudProviders

`Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\> = `...`

###### blockedCountries

`string`[] = `...`

###### blockedUserAgents

`string`[] = `...`

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

###### detectionAnomalyThreshold

`number` = `...`

###### detectionCompilerTimeout

`number` = `...`

###### detectionMaxContentLength

`number` = `...`

###### detectionMaxTrackedPatterns

`number` = `...`

###### detectionMonitorHistorySize

`number` = `...`

###### detectionPreserveAttackPatterns

`boolean` = `...`

###### detectionSemanticThreshold

`number` = `...`

###### detectionSlowPatternThreshold

`number` = `...`

###### dynamicRuleInterval

`number` = `...`

###### emergencyMode

`boolean` = `...`

###### emergencyWhitelist

`string`[] = `...`

###### enableAgent

`boolean` = `...`

###### enableCors

`boolean` = `...`

###### enableDynamicRules

`boolean` = `...`

###### enableIpBanning

`boolean` = `...`

###### enablePenetrationDetection

`boolean` = `...`

###### enableRateLimiting

`boolean` = `...`

###### enableRedis

`boolean` = `...`

###### endpointRateLimits

`Record`\<`string`, \[`number`, `number`\]\> = `...`

###### enforceHttps

`boolean` = `...`

###### excludePaths

`string`[] = `...`

###### geoIpHandler?

[`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/) = `...`

###### geoResolver?

(`ip`) => `string` \| `null` = `...`

###### logFormat

`"text"` \| `"json"` = `...`

###### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/) = `...`

###### logRequestLevel

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null` = `...`

###### logSuspiciousLevel

`"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null` = `...`

###### passiveMode

`boolean` = `...`

###### rateLimit

`number` = `...`

###### rateLimitWindow

`number` = `...`

###### redisPrefix

`string` = `...`

###### redisUrl

`string` = `...`

###### securityHeaders

\{ `contentTypeOptions`: `string`; `csp`: `Record`\<`string`, `string`[]\> \| `null`; `custom`: `Record`\<`string`, `string`\> \| `null`; `enabled`: `boolean`; `frameOptions`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains`: `boolean`; `maxAge`: `number`; `preload`: `boolean`; \}; `permissionsPolicy`: `string`; `referrerPolicy`: `string`; `xssProtection`: `string`; \} \| `null` = `...`

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

`SecurityHeadersManager`

##### agentHandler?

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

#### Returns

`ErrorResponseFactory`

## Methods

### applyCorsHeaders()

> **applyCorsHeaders**(`response`, `origin`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [core/src/core/responses/factory.ts:45](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L45)

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

Defined in: [core/src/core/responses/factory.ts:53](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L53)

#### Parameters

##### response

[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### applySecurityHeaders()

> **applySecurityHeaders**(`response`, `requestPath?`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [core/src/core/responses/factory.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L34)

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

Defined in: [core/src/core/responses/factory.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L20)

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

Defined in: [core/src/core/responses/factory.ts:28](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L28)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

`Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

***

### processResponse()

> **processResponse**(`request`, `response`, `responseTime`, `routeConfig`, `processBehavioralRules?`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [core/src/core/responses/factory.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/responses/factory.ts#L60)

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
