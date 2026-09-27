import { describe, it, expect, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import { createSecurityMiddleware, guardBodyParser, RouteConfig } from '../src/index.js';

const XSS = '<script>alert(1)</script>';

const routeExclusionConfigs = {
  config: { enableRedis: false },
  routeConfigs: [
    {
      path: '/api/open',
      config: new RouteConfig(),
    },
    {
      method: 'POST',
      path: '/api/no-body-scan',
      config: Object.assign(new RouteConfig(), { detectionScanBody: false }),
    },
  ],
} as const;

// The excluded param entry is built after import so the set type matches.
const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);
(routeExclusionConfigs.routeConfigs as unknown as Array<{ path: string; config: RouteConfig }>)[0].config = openConfig;

function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const servers: Server[] = [];
afterAll(() => {
  for (const server of servers) server.close();
});

describe('per-route detection exclusions through the express middleware', () => {
  it('a route-excluded query param passes while the same payload blocks elsewhere', async () => {
    const app = express();
    app.use(createSecurityMiddleware(routeExclusionConfigs));
    app.get('/api/open', (_req, res) => { res.json({ ok: true }); });
    app.get('/api/other', (_req, res) => { res.json({ ok: true }); });
    const { server, url } = await listen(app);
    servers.push(server);

    const excluded = await fetch(`${url}/api/open?q=${encodeURIComponent(XSS)}`);
    expect(excluded.status).toBe(200);

    const blocked = await fetch(`${url}/api/other?q=${encodeURIComponent(XSS)}`);
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toBe('Suspicious activity detected');
  });

  it('a route with detectionScanBody=false skips the body surface but still scans the query', async () => {
    const app = express();
    // The body parser must run before the guard middleware so the pipeline
    // can read the raw body (the guard reads req.rawBody).
    app.use(guardBodyParser());
    app.use(createSecurityMiddleware(routeExclusionConfigs));
    app.post('/api/no-body-scan', (_req, res) => { res.json({ ok: true }); });
    app.post('/api/scanned', (_req, res) => { res.json({ ok: true }); });
    const { server, url } = await listen(app);
    servers.push(server);

    const body = JSON.stringify({ comment: XSS });

    const muted = await fetch(`${url}/api/no-body-scan?q=benign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    expect(muted.status).toBe(200);

    const scanned = await fetch(`${url}/api/scanned?q=benign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    expect(scanned.status).toBe(403);

    // The body toggle does not mute the query surface.
    const queryStillScans = await fetch(`${url}/api/no-body-scan?q=${encodeURIComponent(XSS)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"comment":"benign"}',
    });
    expect(queryStillScans.status).toBe(403);
  });
});
