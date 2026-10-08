---
editUrl: false
next: false
prev: false
title: "SecurityMiddlewareOptions"
---

Defined in: [express/src/middleware.ts:15](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/middleware.ts#L15)

## Properties

### agentHandler?

> `optional` **agentHandler?**: [`AgentHandlerProtocol`](/guard-core-ts/api/core/src/interfaces/agenthandlerprotocol/)

Defined in: [express/src/middleware.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/middleware.ts#L17)

***

### config

> **config**: `object`

Defined in: [express/src/middleware.ts:16](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/middleware.ts#L16)

#### agentApiKey?

> `optional` **agentApiKey?**: `string` \| `null`

#### agentBufferSize?

> `optional` **agentBufferSize?**: `number`

#### agentEnableEvents?

> `optional` **agentEnableEvents?**: `boolean`

#### agentEnableMetrics?

> `optional` **agentEnableMetrics?**: `boolean`

#### agentEndpoint?

> `optional` **agentEndpoint?**: `string`

#### agentFlushInterval?

> `optional` **agentFlushInterval?**: `number`

#### agentProjectId?

> `optional` **agentProjectId?**: `string` \| `null`

#### agentRetryAttempts?

> `optional` **agentRetryAttempts?**: `number`

#### agentTimeout?

> `optional` **agentTimeout?**: `number`

#### autoBanDuration?

> `optional` **autoBanDuration?**: `number`

#### autoBanThreshold?

> `optional` **autoBanThreshold?**: `number`

#### blacklist?

> `optional` **blacklist?**: `string`[]

#### blockCloudProviders?

> `optional` **blockCloudProviders?**: (`"AWS"` \| `"GCP"` \| `"Azure"`)[]

#### blockedCountries?

> `optional` **blockedCountries?**: `string`[]

#### blockedUserAgents?

> `optional` **blockedUserAgents?**: `string`[]

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

#### detectionAnomalyThreshold?

> `optional` **detectionAnomalyThreshold?**: `number`

#### detectionCompilerTimeout?

> `optional` **detectionCompilerTimeout?**: `number`

#### detectionMaxContentLength?

> `optional` **detectionMaxContentLength?**: `number`

#### detectionMaxTrackedPatterns?

> `optional` **detectionMaxTrackedPatterns?**: `number`

#### detectionMonitorHistorySize?

> `optional` **detectionMonitorHistorySize?**: `number`

#### detectionPreserveAttackPatterns?

> `optional` **detectionPreserveAttackPatterns?**: `boolean`

#### detectionSemanticThreshold?

> `optional` **detectionSemanticThreshold?**: `number`

#### detectionSlowPatternThreshold?

> `optional` **detectionSlowPatternThreshold?**: `number`

#### dynamicRuleInterval?

> `optional` **dynamicRuleInterval?**: `number`

#### emergencyMode?

> `optional` **emergencyMode?**: `boolean`

#### emergencyWhitelist?

> `optional` **emergencyWhitelist?**: `string`[]

#### enableAgent?

> `optional` **enableAgent?**: `boolean`

#### enableCors?

> `optional` **enableCors?**: `boolean`

#### enableDynamicRules?

> `optional` **enableDynamicRules?**: `boolean`

#### enableIpBanning?

> `optional` **enableIpBanning?**: `boolean`

#### enablePenetrationDetection?

> `optional` **enablePenetrationDetection?**: `boolean`

#### enableRateLimiting?

> `optional` **enableRateLimiting?**: `boolean`

#### enableRedis?

> `optional` **enableRedis?**: `boolean`

#### endpointRateLimits?

> `optional` **endpointRateLimits?**: `Record`\<`string`, \[`number`, `number`\]\>

#### enforceHttps?

> `optional` **enforceHttps?**: `boolean`

#### excludePaths?

> `optional` **excludePaths?**: `string`[]

#### geoIpHandler?

> `optional` **geoIpHandler?**: [`GeoIPHandler`](/guard-core-ts/api/core/src/interfaces/geoiphandler/)

#### geoResolver?

> `optional` **geoResolver?**: (`ip`) => `string` \| `null`

##### Parameters

###### ip

`string`

##### Returns

`string` \| `null`

#### logFormat?

> `optional` **logFormat?**: `"text"` \| `"json"`

#### logger?

> `optional` **logger?**: [`Logger`](/guard-core-ts/api/core/src/interfaces/logger/)

#### logRequestLevel?

> `optional` **logRequestLevel?**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### logSuspiciousLevel?

> `optional` **logSuspiciousLevel?**: `"INFO"` \| `"DEBUG"` \| `"WARNING"` \| `"ERROR"` \| `"CRITICAL"` \| `null`

#### passiveMode?

> `optional` **passiveMode?**: `boolean`

#### rateLimit?

> `optional` **rateLimit?**: `number`

#### rateLimitWindow?

> `optional` **rateLimitWindow?**: `number`

#### redisPrefix?

> `optional` **redisPrefix?**: `string`

#### redisUrl?

> `optional` **redisUrl?**: `string`

#### securityHeaders?

> `optional` **securityHeaders?**: \{ `contentTypeOptions?`: `string`; `csp?`: `Record`\<`string`, `string`[]\> \| `null`; `custom?`: `Record`\<`string`, `string`\> \| `null`; `enabled?`: `boolean`; `frameOptions?`: `"DENY"` \| `"SAMEORIGIN"`; `hsts?`: \{ `includeSubdomains?`: `boolean`; `maxAge?`: `number`; `preload?`: `boolean`; \}; `permissionsPolicy?`: `string`; `referrerPolicy?`: `string`; `xssProtection?`: `string`; \} \| `null`

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

Defined in: [express/src/middleware.ts:18](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/middleware.ts#L18)

***

### guardDecorator?

> `optional` **guardDecorator?**: `unknown`

Defined in: [express/src/middleware.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/express/src/middleware.ts#L19)
