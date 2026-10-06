/* M2: WebSocket guard for the Hono adapter.

   Hono core has no upgrade hook: WebSocket upgrades happen at the host HTTP
   server (on Node via @hono/node-server, with @hono/node-ws attaching its
   own 'upgrade' listener). attachWebSocketGuard PREPENDS a guard listener so
   untrusted handshakes are rejected (HTTP 403, the pre-accept rejection
   behavior of the reference's WebSocketException) before the WebSocket
   server ever sees the upgrade. Register the guard BEFORE injectWebSocket
   or any gateway attachment:

     const server = serve({ fetch: app.fetch, port: 8787 });
     attachWebSocketGuard(server, { config });
     injectWebSocket(app, server);  // attach order does not matter

   A verdict of allowed does nothing and the next upgrade listener proceeds
   unchanged. Pass the middleware's components to reuse the same
   Redis/rate-limit/pattern managers. On non-Node runtimes (Workers, Deno,
   Bun) the host controls the upgrade event; wire the core
   guardWebSocketUpgrade() into that host hook instead. */

export {
  attachNodeWebSocketGuard as attachWebSocketGuard,
  NodeUpgradeGuardRequest,
} from '@guardcore/core';
export type { NodeWebSocketGuardOptions as WebSocketGuardOptions } from '@guardcore/core';
