import type { Context } from 'hono';

const CLOUDFLARE_WORKERS_UA = 'Cloudflare-Workers';

interface RuntimeEnv {
  incoming?: { socket?: { remoteAddress?: unknown } };
  remoteAddr?: unknown;
  requestIP?: (req: unknown) => { address?: unknown } | null | undefined;
}

/* The connecting peer address for the runtimes Hono runs on, read from what
   each runtime already hands the app (nothing is trusted from request
   headers except on Cloudflare Workers, where the platform always sets
   cf-connecting-ip itself):

   - Node (@hono/node-server): `c.env.incoming.socket.remoteAddress`
   - Deno (`Deno.serve(app.fetch)`): `c.env.remoteAddr.hostname`
   - Bun (`Bun.serve({ fetch: app.fetch })`): `c.env.requestIP(req).address`
   - Cloudflare Workers: the cf-connecting-ip header

   Returns null when the runtime exposes none (a Unix socket, a test
   harness); pass `connectingIpResolver` to the middleware to override. */
export function resolveHonoClientAddress(c: Context): string | null {
  const env = c.env as RuntimeEnv | undefined;

  const nodeAddress = env?.incoming?.socket?.remoteAddress;
  if (typeof nodeAddress === 'string' && nodeAddress) return nodeAddress;

  const remoteAddr = env?.remoteAddr;
  if (typeof remoteAddr === 'string' && remoteAddr) return remoteAddr;
  const denoHost = (remoteAddr as { hostname?: unknown } | undefined)?.hostname;
  if (typeof denoHost === 'string' && denoHost) return denoHost;

  if (typeof env?.requestIP === 'function') {
    const bunAddress = env.requestIP(c.req.raw)?.address;
    if (typeof bunAddress === 'string' && bunAddress) return bunAddress;
  }

  if ((globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent === CLOUDFLARE_WORKERS_UA) {
    return c.req.header('cf-connecting-ip') ?? null;
  }
  return null;
}
