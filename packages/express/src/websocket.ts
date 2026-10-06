/* M2: WebSocket guard for the Express adapter.

   Express has no native upgrade hook: ws / socket.io attach their own
   'upgrade' listeners to the Node HTTP server. attachWebSocketGuard PREPENDS
   a guard listener so untrusted handshakes are rejected (HTTP 403, the
   pre-accept rejection behavior of the reference's WebSocketException)
   before the WebSocket server ever sees the upgrade. Register the guard
   BEFORE attaching your ws server / gateway:

     const server = http.createServer(app);
     attachWebSocketGuard(server, { config });
     new WebSocketServer({ server });  // attach order does not matter

   A verdict of allowed does nothing and the next upgrade listener (ws,
   socket.io) proceeds unchanged. Pass the middleware's components to reuse
   the same Redis/rate-limit/pattern managers. */

export {
  attachNodeWebSocketGuard as attachWebSocketGuard,
  NodeUpgradeGuardRequest,
} from '@guardcore/core';
export type { NodeWebSocketGuardOptions as WebSocketGuardOptions } from '@guardcore/core';
