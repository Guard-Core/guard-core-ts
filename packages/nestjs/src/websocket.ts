/* M2: WebSocket guard for the NestJS adapter.

   Nest WS gateways (socket.io or ws via the platform adapter) attach their
   upgrade listener to the app's underlying HTTP server; the framework does
   not expose an upgrade-phase middleware. attachWebSocketGuard PREPENDS a
   guard listener on that server so untrusted handshakes are rejected
   (HTTP 403, the pre-accept rejection behavior of the reference's
   WebSocketException) before the gateway ever sees the upgrade. Register it
   right after creating the app (the guard gates the server's upgrade
   dispatch itself, so gateway attach order does not matter):

     const app = await NestFactory.create(AppModule);
     const httpServer = app.getHttpServer();
     attachWebSocketGuard(httpServer, { config });
     await app.listen(3000);

   A verdict of allowed does nothing; the gateway listener proceeds
   unchanged. */

export {
  attachNodeWebSocketGuard as attachWebSocketGuard,
  NodeUpgradeGuardRequest,
} from '@guardcore/core';
export type { NodeWebSocketGuardOptions as WebSocketGuardOptions } from '@guardcore/core';
