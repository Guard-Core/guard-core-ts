---
editUrl: false
next: false
prev: false
title: "RouteConfigResolver"
---

Defined in: [core/src/core/routing/resolver.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L5)

## Constructors

### Constructor

> **new RouteConfigResolver**(`config`): `RouteConfigResolver`

Defined in: [core/src/core/routing/resolver.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L8)

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

#### Returns

`RouteConfigResolver`

## Methods

### getCloudProvidersToCheck()

> **getCloudProvidersToCheck**(`routeConfig`): `string`[] \| `null`

Defined in: [core/src/core/routing/resolver.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L34)

#### Parameters

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

#### Returns

`string`[] \| `null`

***

### getRouteConfig()

> **getRouteConfig**(`request`): [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

Defined in: [core/src/core/routing/resolver.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L16)

#### Parameters

##### request

[`GuardRequest`](/guard-core-ts/api/core/src/interfaces/guardrequest/)

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

***

### setGuardDecorator()

> **setGuardDecorator**(`decorator`): `void`

Defined in: [core/src/core/routing/resolver.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L12)

#### Parameters

##### decorator

`unknown`

#### Returns

`void`

***

### shouldBypassCheck()

> **shouldBypassCheck**(`checkName`, `routeConfig`): `boolean`

Defined in: [core/src/core/routing/resolver.ts:29](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/core/routing/resolver.ts#L29)

#### Parameters

##### checkName

`string`

##### routeConfig

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `null`

#### Returns

`boolean`
