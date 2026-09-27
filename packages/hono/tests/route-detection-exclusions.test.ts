import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';

import { createGuardMiddleware, RouteConfig } from '../src/index.js';

const XSS = '<script>alert(1)</script>';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

const mutedBodyConfig = new RouteConfig();
mutedBodyConfig.detectionScanBody = false;

function buildApp(): Hono {
  const app = new Hono();
  app.use('*', createGuardMiddleware({
    config: { enableRedis: false },
    connectingIpResolver: (c) => c.req.header('x-forwarded-for') ?? '10.0.0.1',
    routeConfigs: [
      { path: '/api/open', config: openConfig },
      { method: 'POST', path: '/api/mute', config: mutedBodyConfig },
    ],
  }));
  app.get('/api/open', (c) => c.json({ ok: true }));
  app.get('/api/other', (c) => c.json({ ok: true }));
  app.post('/api/mute', (c) => c.json({ ok: true }));
  app.post('/api/scan', (c) => c.json({ ok: true }));
  return app;
}

const jsonHeaders = { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.2' };

describe('per-route detection exclusions through the hono middleware', () => {
  it('a route-excluded query param passes while the same payload blocks elsewhere', async () => {
    const app = buildApp();

    const excluded = await app.request(`/api/open?q=${encodeURIComponent(XSS)}`, {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    expect(excluded.status).toBe(200);

    const blocked = await app.request(`/api/other?q=${encodeURIComponent(XSS)}`, {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    expect(blocked.status).toBe(400);
    expect(await blocked.text()).toBe('Suspicious activity detected');
  });

  it('a POST route with detectionScanBody=false mutes the body but not the query', async () => {
    const app = buildApp();
    const body = JSON.stringify({ comment: XSS });

    const muted = await app.request('/api/mute?q=benign', { method: 'POST', headers: jsonHeaders, body });
    expect(muted.status).toBe(200);

    const scanned = await app.request('/api/scan', { method: 'POST', headers: jsonHeaders, body });
    expect(scanned.status).toBe(400);

    const queryStillScans = await app.request(`/api/mute?q=${encodeURIComponent(XSS)}`, {
      method: 'POST', headers: jsonHeaders, body: '{"comment":"benign"}',
    });
    expect(queryStillScans.status).toBe(400);
  });
});
