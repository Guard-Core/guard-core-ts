---
editUrl: false
next: false
prev: false
title: "BaseSecurityDecorator"
---

Defined in: [core/src/decorators/base.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L17)

## Constructors

### Constructor

> **new BaseSecurityDecorator**(`config`, `logger?`): `BaseSecurityDecorator`

Defined in: [core/src/decorators/base.ts:24](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L24)

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

##### logger?

[`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### Returns

`BaseSecurityDecorator`

## Properties

### agentHandler

> **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null` = `null`

Defined in: [core/src/decorators/base.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L20)

***

### behaviorTracker

> **behaviorTracker**: `BehaviorTracker`

Defined in: [core/src/decorators/base.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L19)

***

### config

> `readonly` **config**: `object`

Defined in: [core/src/decorators/base.ts:21](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L21)

#### agentApiKey

> **agentApiKey**: `string` \| `null`

#### agentBufferSize

> **agentBufferSize**: `number`

#### agentEnableEvents

> **agentEnableEvents**: `boolean`

#### agentEnableMetrics

> **agentEnableMetrics**: `boolean`

#### agentEndpoint

> **agentEndpoint**: `string`

#### agentFlushInterval

> **agentFlushInterval**: `number`

#### agentProjectId

> **agentProjectId**: `string` \| `null`

#### agentRetryAttempts

> **agentRetryAttempts**: `number`

#### agentTimeout

> **agentTimeout**: `number`

#### autoBanDuration

> **autoBanDuration**: `number`

#### autoBanThreshold

> **autoBanThreshold**: `number`

#### blacklist

> **blacklist**: `string`[]

#### blockCloudProviders

> **blockCloudProviders**: `Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>

#### blockedCountries

> **blockedCountries**: `string`[]

#### blockedUserAgents

> **blockedUserAgents**: `string`[]

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

#### detectionAnomalyThreshold

> **detectionAnomalyThreshold**: `number`

#### detectionCompilerTimeout

> **detectionCompilerTimeout**: `number`

#### detectionMaxContentLength

> **detectionMaxContentLength**: `number`

#### detectionMaxTrackedPatterns

> **detectionMaxTrackedPatterns**: `number`

#### detectionMonitorHistorySize

> **detectionMonitorHistorySize**: `number`

#### detectionPreserveAttackPatterns

> **detectionPreserveAttackPatterns**: `boolean`

#### detectionSemanticThreshold

> **detectionSemanticThreshold**: `number`

#### detectionSlowPatternThreshold

> **detectionSlowPatternThreshold**: `number`

#### dynamicRuleInterval

> **dynamicRuleInterval**: `number`

#### emergencyMode

> **emergencyMode**: `boolean`

#### emergencyWhitelist

> **emergencyWhitelist**: `string`[]

#### enableAgent

> **enableAgent**: `boolean`

#### enableCors

> **enableCors**: `boolean`

#### enableDynamicRules

> **enableDynamicRules**: `boolean`

#### enableIpBanning

> **enableIpBanning**: `boolean`

#### enablePenetrationDetection

> **enablePenetrationDetection**: `boolean`

#### enableRateLimiting

> **enableRateLimiting**: `boolean`

#### enableRedis

> **enableRedis**: `boolean`

#### endpointRateLimits

> **endpointRateLimits**: `Record`\<`string`, \[`number`, `number`\]\>

#### enforceHttps

> **enforceHttps**: `boolean`

#### excludePaths

> **excludePaths**: `string`[]

#### geoIpHandler?

> `optional` **geoIpHandler?**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

#### geoResolver?

> `optional` **geoResolver?**: (`ip`) => `string` \| `null`

##### Parameters

###### ip

`string`

##### Returns

`string` \| `null`

#### logFormat

> **logFormat**: `"text"` \| `"json"`

#### logger?

> `optional` **logger?**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### logRequestLevel

> **logRequestLevel**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logSuspiciousLevel

> **logSuspiciousLevel**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### passiveMode

> **passiveMode**: `boolean`

#### rateLimit

> **rateLimit**: `number`

#### rateLimitWindow

> **rateLimitWindow**: `number`

#### redisPrefix

> **redisPrefix**: `string`

#### redisUrl

> **redisUrl**: `string`

#### securityHeaders

> **securityHeaders**: \{ `contentTypeOptions`: `string`; `csp`: `Record`\<`string`, `string`[]\> \| `null`; `custom`: `Record`\<`string`, `string`\> \| `null`; `enabled`: `boolean`; `frameOptions`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains`: `boolean`; `maxAge`: `number`; `preload`: `boolean`; \}; `permissionsPolicy`: `string`; `referrerPolicy`: `string`; `xssProtection`: `string`; \} \| `null`

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

> `readonly` **logger**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

Defined in: [core/src/decorators/base.ts:22](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L22)

***

### routeConfigs

> **routeConfigs**: `Map`\<`string`, [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)\>

Defined in: [core/src/decorators/base.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L18)

## Methods

### applyRouteConfig()

> **applyRouteConfig**\<`T`\>(`fn`): `T`

Defined in: [core/src/decorators/base.ts:44](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L44)

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

Defined in: [core/src/decorators/base.ts:34](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L34)

#### Parameters

##### fn

`Function`

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/)

***

### getRouteConfig()

> **getRouteConfig**(`routeId`): [`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `undefined`

Defined in: [core/src/decorators/base.ts:30](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L30)

#### Parameters

##### routeId

`string`

#### Returns

[`RouteConfig`](/guard-core-ts/api/core/src/classes/routeconfig/) \| `undefined`

***

### getRouteId()

> **getRouteId**(`fn`): `string`

Defined in: [core/src/decorators/base.ts:49](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L49)

#### Parameters

##### fn

`Function`

#### Returns

`string`

***

### initializeAgent()

> **initializeAgent**(`agentHandler`): `Promise`\<`void`\>

Defined in: [core/src/decorators/base.ts:60](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L60)

#### Parameters

##### agentHandler

[`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### initializeBehaviorTracking()

> **initializeBehaviorTracking**(`redisHandler?`): `Promise`\<`void`\>

Defined in: [core/src/decorators/base.ts:56](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L56)

#### Parameters

##### redisHandler?

[`RedisHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/redishandlerprotocol/)

#### Returns

`Promise`\<`void`\>

***

### sendAccessDeniedEvent()

> **sendAccessDeniedEvent**(`request`, `reason`, `decoratorType`, `meta?`): `Promise`\<`void`\>

Defined in: [core/src/decorators/base.ts:86](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L86)

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

Defined in: [core/src/decorators/base.ts:95](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L95)

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

> **sendDecoratorEvent**(`eventType`, `_request`, `actionTaken`, `reason`, `decoratorType`, `meta?`): `Promise`\<`void`\>

Defined in: [core/src/decorators/base.ts:65](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L65)

#### Parameters

##### eventType

`string`

##### \_request

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

Defined in: [core/src/decorators/base.ts:113](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L113)

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

Defined in: [core/src/decorators/base.ts:104](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/decorators/base.ts#L104)

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
