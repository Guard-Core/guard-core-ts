---
editUrl: false
next: false
prev: false
title: "DynamicRulesSchema"
---

> `const` **DynamicRulesSchema**: `ZodObject`\<\{ `blockedCloudProviders`: `ZodPipe`\<`ZodDefault`\<`ZodArray`\<`ZodEnum`\<\{ `AWS`: `"AWS"`; `Azure`: `"Azure"`; `GCP`: `"GCP"`; \}\>\>\>, `ZodTransform`\<`Set`\<`"AWS"` \| `"GCP"` \| `"Azure"`\>, (`"AWS"` \| `"GCP"` \| `"Azure"`)[]\>\>; `blockedCountries`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `blockedUserAgents`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `emergencyMode`: `ZodDefault`\<`ZodBoolean`\>; `emergencyWhitelist`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `enableIpBanning`: `ZodDefault`\<`ZodNullable`\<`ZodBoolean`\>\>; `enablePenetrationDetection`: `ZodDefault`\<`ZodNullable`\<`ZodBoolean`\>\>; `enableRateLimiting`: `ZodDefault`\<`ZodNullable`\<`ZodBoolean`\>\>; `endpointRateLimits`: `ZodDefault`\<`ZodRecord`\<`ZodString`, `ZodTuple`\<\[`ZodNumber`, `ZodNumber`\], `null`\>\>\>; `expiresAt`: `ZodDefault`\<`ZodNullable`\<`ZodString`\>\>; `globalRateLimit`: `ZodDefault`\<`ZodNullable`\<`ZodNumber`\>\>; `globalRateWindow`: `ZodDefault`\<`ZodNullable`\<`ZodNumber`\>\>; `ipBanDuration`: `ZodDefault`\<`ZodNumber`\>; `ipBlacklist`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `ipWhitelist`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `ruleId`: `ZodString`; `suspiciousPatterns`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; `timestamp`: `ZodString`; `ttl`: `ZodDefault`\<`ZodNumber`\>; `version`: `ZodNumber`; `whitelistCountries`: `ZodDefault`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>

Defined in: [core/src/models/dynamic-rules.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/dynamic-rules.ts#L5)
