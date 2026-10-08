---
editUrl: false
next: false
prev: false
title: "BehaviorRule"
---

Defined in: [core/src/models/behavior-rule.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L4)

## Constructors

### Constructor

> **new BehaviorRule**(`ruleType`, `threshold`, `window?`, `pattern?`, `action?`, `customAction?`): `BehaviorRule`

Defined in: [core/src/models/behavior-rule.ts:12](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L12)

#### Parameters

##### ruleType

[`BehaviorRuleType`](/guard-core-ts/api/core/src/type-aliases/behaviorruletype/)

##### threshold

`number`

##### window?

`number` = `3600`

##### pattern?

`string` \| `null`

##### action?

[`BehaviorAction`](/guard-core-ts/api/core/src/type-aliases/behavioraction/) = `'log'`

##### customAction?

((...`args`) => `unknown`) \| `null`

#### Returns

`BehaviorRule`

## Properties

### action

> `readonly` **action**: [`BehaviorAction`](/guard-core-ts/api/core/src/type-aliases/behavioraction/)

Defined in: [core/src/models/behavior-rule.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L9)

***

### customAction

> `readonly` **customAction**: ((...`args`) => `unknown`) \| `null`

Defined in: [core/src/models/behavior-rule.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L10)

***

### pattern

> `readonly` **pattern**: `string` \| `null`

Defined in: [core/src/models/behavior-rule.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L8)

***

### ruleType

> `readonly` **ruleType**: [`BehaviorRuleType`](/guard-core-ts/api/core/src/type-aliases/behaviorruletype/)

Defined in: [core/src/models/behavior-rule.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L5)

***

### threshold

> `readonly` **threshold**: `number`

Defined in: [core/src/models/behavior-rule.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L6)

***

### window

> `readonly` **window**: `number`

Defined in: [core/src/models/behavior-rule.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/b49ed8cdbf992765ff7882327eaf5f8a9461242e/packages/core/src/models/behavior-rule.ts#L7)
