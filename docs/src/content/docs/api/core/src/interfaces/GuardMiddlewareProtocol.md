---
editUrl: false
next: false
prev: false
title: "GuardMiddlewareProtocol"
---

Defined in: [core/src/protocols/middleware.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L7)

## Properties

### agentHandler

> `readonly` **agentHandler**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/) \| `null`

Defined in: [core/src/protocols/middleware.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L16)

***

### config

> `readonly` **config**: `object`

Defined in: [core/src/protocols/middleware.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L8)

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

### eventBus

> `readonly` **eventBus**: `unknown`

Defined in: [core/src/protocols/middleware.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L12)

***

### geoIpHandler

> `readonly` **geoIpHandler**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/) \| `null`

Defined in: [core/src/protocols/middleware.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L17)

***

### guardResponseFactory

> `readonly` **guardResponseFactory**: [`GuardResponseFactory`](/guard-core-ts/api/core/src/interfaces/guardresponsefactory/)

Defined in: [core/src/protocols/middleware.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L18)

***

### lastCloudIpRefresh

> **lastCloudIpRefresh**: `number`

Defined in: [core/src/protocols/middleware.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L10)

***

### logger

> `readonly` **logger**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

Defined in: [core/src/protocols/middleware.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L9)

***

### rateLimitHandler

> `readonly` **rateLimitHandler**: `unknown`

Defined in: [core/src/protocols/middleware.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L15)

***

### responseFactory

> `readonly` **responseFactory**: `unknown`

Defined in: [core/src/protocols/middleware.ts:14](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L14)

***

### routeResolver

> `readonly` **routeResolver**: `unknown`

Defined in: [core/src/protocols/middleware.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L13)

***

### suspiciousRequestCounts

> **suspiciousRequestCounts**: `Map`\<`string`, `number`\>

Defined in: [core/src/protocols/middleware.ts:11](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L11)

## Methods

### createErrorResponse()

> **createErrorResponse**(`statusCode`, `defaultMessage`): `Promise`\<[`GuardResponse`](/guard-core-ts/api/core/src/interfaces/guardresponse/)\>

Defined in: [core/src/protocols/middleware.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L19)

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

Defined in: [core/src/protocols/middleware.ts:20](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/protocols/middleware.ts#L20)

#### Returns

`Promise`\<`void`\>
