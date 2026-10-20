---
editUrl: false
next: false
prev: false
title: "WebSocketGuardVerdict"
---

> **WebSocketGuardVerdict** = \{ `allowed`: `true`; `clientIp`: `string`; \} \| \{ `allowed`: `false`; `close`: [`WebSocketCloseReason`](/guard-core-ts/api/core/src/interfaces/websocketclosereason/); `httpReason`: `string`; `httpStatus`: `403`; \}

Defined in: [packages/core/src/core/websocket-guard.ts:51](https://github.com/Guard-Core/guard-core-ts/blob/772db2916717516ad477ac515f458b80fb9ccaba/packages/core/src/core/websocket-guard.ts#L51)
