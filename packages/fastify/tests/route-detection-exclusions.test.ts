import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { guardPlugin, RouteConfig } from '../src/index.js';

const XSS = '<script>alert(1)</script>';

const openConfig = new RouteConfig();
openConfig.excludedDetectionParams = new Set(['q']);

const mutedBodyConfig = new RouteConfig();
mutedBodyConfig.detectionScanBody = false;

/* The plugin's hooks live in its encapsulation scope, so the guarded routes
   register inside the same scope (the documented fastify usage). */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(async (scope) => {
    await scope.register(guardPlugin, {
      config: { enableRedis: false },
      routeConfigs: [{ path: '/api/open', config: openConfig }],
    });
    scope.get('/api/open', async () => ({ ok: true }));
    scope.get('/api/other', async () => ({ ok: true }));
    scope.post('/api/mute', { config: { guardRouteConfig: mutedBodyConfig } }, async () => ({ ok: true }));
    scope.post('/api/scan', async () => ({ ok: true }));
  });
  return app;
}

describe('per-route detection exclusions through the fastify plugin', () => {
  it('a registry route config excludes the query param on that path only', async () => {
    const app = await buildApp();

    const excluded = await app.inject({
      method: 'GET', url: '/api/open', remoteAddress: '10.0.0.1', query: { q: XSS },
    });
    expect(excluded.statusCode).toBe(200);

    const blocked = await app.inject({
      method: 'GET', url: '/api/other', remoteAddress: '10.0.0.1', query: { q: XSS },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.body).toBe('Suspicious activity detected');

    await app.close();
  });

  it('a native route-options config.guardRouteConfig mutes the body surface only', async () => {
    const app = await buildApp();
    const body = JSON.stringify({ comment: XSS });

    const muted = await app.inject({
      method: 'POST', url: '/api/mute?q=benign', remoteAddress: '10.0.0.2',
      headers: { 'content-type': 'application/json' }, payload: body,
    });
    expect(muted.statusCode).toBe(200);

    const scanned = await app.inject({
      method: 'POST', url: '/api/scan', remoteAddress: '10.0.0.2',
      headers: { 'content-type': 'application/json' }, payload: body,
    });
    expect(scanned.statusCode).toBe(400);

    // The body toggle does not mute the query surface on the same route.
    const queryStillScans = await app.inject({
      method: 'POST', url: `/api/mute?q=${encodeURIComponent(XSS)}`, remoteAddress: '10.0.0.2',
      headers: { 'content-type': 'application/json' }, payload: '{"comment":"benign"}',
    });
    expect(queryStillScans.statusCode).toBe(400);

    await app.close();
  });
});
