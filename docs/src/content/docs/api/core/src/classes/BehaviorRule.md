---
editUrl: false
next: false
prev: false
title: "BehaviorRule"
---

Defined in: [packages/core/src/models/behavior-rule.ts:4](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L4)

## Constructors

### Constructor

> **new BehaviorRule**(`ruleType`, `threshold`, `window?`, `pattern?`, `action?`, `customAction?`, `banDuration?`, `correlateWithDetection?`): `BehaviorRule`

Defined in: [packages/core/src/models/behavior-rule.ts:19](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L19)

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

##### banDuration?

`number` \| `null`

##### correlateWithDetection?

`boolean` = `false`

#### Returns

`BehaviorRule`

## Properties

### action

> `readonly` **action**: [`BehaviorAction`](/guard-core-ts/api/core/src/type-aliases/behavioraction/)

Defined in: [packages/core/src/models/behavior-rule.ts:9](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L9)

***

### banDuration

> `readonly` **banDuration**: `number` \| `null`

Defined in: [packages/core/src/models/behavior-rule.ts:13](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L13)

***

### correlateWithDetection

> `readonly` **correlateWithDetection**: `boolean`

Defined in: [packages/core/src/models/behavior-rule.ts:17](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L17)

***

### customAction

> `readonly` **customAction**: ((...`args`) => `unknown`) \| `null`

Defined in: [packages/core/src/models/behavior-rule.ts:10](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L10)

***

### pattern

> `readonly` **pattern**: `string` \| `null`

Defined in: [packages/core/src/models/behavior-rule.ts:8](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L8)

***

### ruleType

> `readonly` **ruleType**: [`BehaviorRuleType`](/guard-core-ts/api/core/src/type-aliases/behaviorruletype/)

Defined in: [packages/core/src/models/behavior-rule.ts:5](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L5)

***

### threshold

> `readonly` **threshold**: `number`

Defined in: [packages/core/src/models/behavior-rule.ts:6](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L6)

***

### window

> `readonly` **window**: `number`

Defined in: [packages/core/src/models/behavior-rule.ts:7](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/models/behavior-rule.ts#L7)
