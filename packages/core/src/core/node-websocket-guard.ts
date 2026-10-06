/* Node HTTP server WebSocket upgrade guard: the shared implementation behind
   the express / hono / nestjs adapters' attachWebSocketGuard exports.

   Parity with the reference guard_websocket
   (fastapi-guard/guard/websocket.py): the same checks the HTTP pipeline
   applies run on the upgrade request through guardWebSocketUpgrade, and a
   rejected handshake gets an HTTP 403 response (the pre-accept rejection
   behavior of a Starlette WebSocketException) before any WebSocket server
   (ws, socket.io, @hono/node-ws) sees the upgrade.

   Node HTTP servers deliver upgrades through the 'upgrade' event; the guard
   wraps the server's emit dispatch for that event so every upgrade listener
   (whatever its attach order) runs only after the guard verdict. Allowed
   upgrades fall through untouched; rejected ones get the 403 and a torn
   socket. Guard errors fail closed. */

import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import type { GuardRequest, GuardRequestState, AgentHandlerProtocol, GeoIPHandler } from '../protocols/index.js';
import type { Logger } from '../models/logger.js';
import type { SecurityConfig } from '../models/config.js';
import type { SecurityMiddlewareComponents } from '../middleware-support.js';
import type { WebSocketGuardVerdict } from './websocket-guard.js';
import { SecurityConfigSchema } from '../models/config.js';
import { defaultLogger } from '../models/logger.js';
import { resolveConfiguredLogger } from '../models/logger-setup.js';
import { initializeSecurityMiddleware } from '../middleware-support.js';
import { guardWebSocketUpgrade } from './websocket-guard.js';

/* GuardRequest view over a raw Node upgrade request: no body (upgrades carry
   none), method "WEBSOCKET" like the reference's _WebSocketGuardRequest. */
export class NodeUpgradeGuardRequest implements GuardRequest {
  private readonly _state: GuardRequestState = {};
  private readonly _headers: Record<string, string>;
  private readonly _url: URL;

  constructor(
    req: IncomingMessage,
    private readonly _clientHost: string | null,
  ) {
    this._headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      this._headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
    }
    this._url = new URL(req.url ?? '/', 'http://localhost');
  }

  get urlPath(): string { return this._url.pathname; }
  get urlScheme(): string { return this._url.protocol.replace(':', ''); }
  get urlFull(): string { return this._url.toString(); }
  urlReplaceScheme(scheme: string): string { return this.urlFull.replace(/^https?/, scheme); }
  get method(): string { return 'WEBSOCKET'; }
  get clientHost(): string | null { return this._clientHost; }
  get headers(): Readonly<Record<string, string>> { return this._headers; }
  get queryParams(): Readonly<Record<string, string>> {
    return Object.fromEntries(this._url.searchParams.entries());
  }
  async body(): Promise<Uint8Array> { return new Uint8Array(0); }
  get state(): GuardRequestState { return this._state; }
  get scope(): Readonly<Record<string, unknown>> { return {}; }
}

export interface NodeWebSocketGuardOptions {
  config: SecurityConfig;
  agentHandler?: AgentHandlerProtocol;
  geoIpHandler?: GeoIPHandler;
  guardDecorator?: unknown;
  /** Share the HTTP middleware's initialized components (recommended so the
   *  WS guard reuses the same Redis/rate-limit/pattern managers). When
   *  omitted the guard lazily initializes its own components from the
   *  config, single-flight like the middleware. */
  components?: SecurityMiddlewareComponents;
}

function rejectUpgrade(socket: Duplex, verdict: Extract<WebSocketGuardVerdict, { allowed: false }>): void {
  const body = `${verdict.httpReason}\n`;
  try {
    socket.write(
      `HTTP/1.1 ${verdict.httpStatus} Forbidden\r\n`
      + 'Connection: close\r\n'
      + 'Content-Type: text/plain; charset=utf-8\r\n'
      + `Content-Length: ${Buffer.byteLength(body)}\r\n`
      + `\r\n${body}`,
    );
  } catch {
    /* socket already torn down */
  }
  socket.destroy();
}

const FAIL_CLOSED_REJECTION: Extract<WebSocketGuardVerdict, { allowed: false }> = {
  allowed: false,
  close: { code: 1013, reason: 'Security check failed' },
  httpStatus: 403,
  httpReason: 'WebSocket upgrade rejected: Security check failed (ws close 1013)',
};

/** Minimal GuardResponseFactory; the WS checks only need error responses
   (403/429/500 sentinels), never rendered redirects. */
function websocketResponseFactory() {
  const createResponse = (content: string, statusCode: number) => ({
    statusCode, headers: {} as Record<string, string>, setHeader() {}, body: null, bodyText: content,
  });
  return {
    createResponse,
    /* v8 ignore start -- measured-unreachable path, see the coverage PR notes:
       the WS check set (suspicious detection + ban/allow/rate-limit) never
       emits redirects, so createRedirectResponse cannot be reached. */
    createRedirectResponse: (url: string, statusCode: number) => ({
      statusCode, headers: { location: url }, setHeader() {}, body: null, bodyText: null,
    }),
    /* v8 ignore stop */
  };
}

export function attachNodeWebSocketGuard(server: Server, options: NodeWebSocketGuardOptions): void {
  const resolved = SecurityConfigSchema.parse(options.config);
  let logger: Logger = resolved.logger ?? defaultLogger;
  let components: SecurityMiddlewareComponents | null = options.components ?? null;
  let initPromise: Promise<SecurityMiddlewareComponents> | null = null;

  function getComponents(): Promise<SecurityMiddlewareComponents> {
    if (components !== null) return Promise.resolve(components);
    initPromise ??= (async () => {
      /* D5: the WS guard honors logFormat / customLogFile too. */
      logger = await resolveConfiguredLogger(resolved);
      const initialized = await initializeSecurityMiddleware(
        resolved, logger, websocketResponseFactory(),
        options.agentHandler, options.geoIpHandler, options.guardDecorator,
      );
      components = initialized;
      return initialized;
    })().catch((error: unknown) => {
      /* v8 ignore start -- measured-unreachable path, see the coverage PR notes:
         the initializer's known failure modes (redis, agent, geoip) degrade
         internally; this retry-reset only fires on initializer bugs. */
      initPromise = null;
      throw error;
      /* v8 ignore stop */
    });
    return initPromise;
  }

  /* Gating through emit instead of a listener: Node dispatches 'upgrade'
     listeners synchronously in attach order, so a plain prependListener
     would return (and let the ws / socket.io / node-ws listener run) BEFORE
     the async verdict lands. Wrapping emit keeps every upgrade listener
     behind the guard verdict regardless of when the WebSocket integration
     attached, and chained attachments compose (each layer gates the next). */
  const downstreamEmit = server.emit.bind(server) as (event: string, ...args: unknown[]) => boolean;
  server.emit = function guardedEmit(this: Server, event: string, ...args: unknown[]): boolean {
    if (event !== 'upgrade') {
      return downstreamEmit(event, ...args);
    }
    const [req, socket] = args as [IncomingMessage, Duplex];
    void (async () => {
      let verdict: WebSocketGuardVerdict;
      try {
        const initialized = await getComponents();
        const guardReq = new NodeUpgradeGuardRequest(req, req.socket.remoteAddress ?? null);
        verdict = await guardWebSocketUpgrade(guardReq, initialized);
      } catch (e) {
        /* Fail closed: a broken guard must not wave handshakes through. */
        logger.error(`WebSocket guard failed: ${e}`);
        rejectUpgrade(socket, FAIL_CLOSED_REJECTION);
        return;
      }
      if (verdict.allowed) {
        downstreamEmit('upgrade', ...args);
        return;
      }
      rejectUpgrade(socket, verdict);
    })();
    return true;
  } as typeof server.emit;
}
