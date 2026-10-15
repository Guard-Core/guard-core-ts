import { describe, it, expect } from 'vitest';
import express from 'express';
import { createSecurityMiddleware } from '../src/index.js';
import type { AgentHandlerProtocol } from '@guardcore/core';

function agentWith(rules: Record<string, unknown> | null) {
  return {
    async sendEvent() {}, async sendMetric() {}, async start() {}, async stop() {}, async flushBuffer() {},
    async getDynamicRules() { return rules; }, async healthCheck() { return true; }, async initializeRedis() {},
  } as unknown as AgentHandlerProtocol;
}

async function serve(rules: Record<string, unknown> | null, config: Record<string, unknown> = {}) {
  const guard = createSecurityMiddleware({
    config: {
      enableAgent: true, enableDynamicRules: true, agentApiKey: 'k'.repeat(32), enableRedis: false,
      rateLimit: 100, rateLimitWindow: 60, enableRateLimiting: true, enablePenetrationDetection: true,
      ...config,
    } as never,
    agentHandler: agentWith(rules),
  });
  const app = express();
  app.use(guard);
  app.get('/', (_req, res) => { res.send('ok'); });
  app.get('/api/login', (_req, res) => { res.send('ok'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port;
  const get = async (path: string, ua = 'Mozilla/5.0') => (await fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'user-agent': ua } })).status;
  // The first request bootstraps the engine; the initial rule fetch runs in the background.
  await get('/');
  await new Promise((r) => setTimeout(r, 300));
  return { get, close: () => server.close() };
}

const base = { ruleId: 'r1', version: 1, timestamp: new Date().toISOString() };

async function withServer<T>(
  rules: Record<string, unknown> | null,
  fn: (s: Awaited<ReturnType<typeof serve>>) => Promise<T>,
  config: Record<string, unknown> = {},
): Promise<T> {
  const s = await serve(rules, config);
  try { return await fn(s); } finally { s.close(); }
}

describe('dynamic rules end to end through the express adapter', () => {
  it('rules received at startup change request handling', async () => {
    await withServer({ ...base, globalRateLimit: 3, globalRateWindow: 60, blockedUserAgents: ['BadBot'] }, async (s1) => {
      expect(await s1.get('/', 'BadBot/1.0')).toBe(403);
      const seq: number[] = [];
      for (let i = 0; i < 5; i++) seq.push(await s1.get('/'));
      expect(seq.slice(-2).every((s) => s === 429)).toBe(true);
    });
    await withServer({ ...base, enablePenetrationDetection: false }, async (s2) => {
      expect(await s2.get('/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).toBe(200);
    });
  });

  it('without rules the same requests are blocked or allowed as configured', async () => {
    await withServer(null, async (s) => {
      expect(await s.get('/', 'BadBot/1.0')).toBe(200);
      expect(await s.get('/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E')).toBe(400);
    });
  });

  it('endpointRateLimits throttle only the listed endpoint', async () => {
    await withServer({ ...base, endpointRateLimits: { '/api/login': [2, 60] } }, async (s) => {
      const seq: number[] = [];
      for (let i = 0; i < 4; i++) seq.push(await s.get('/api/login'));
      expect(seq.slice(-2).every((c) => c === 429)).toBe(true);
      expect(await s.get('/')).toBe(200);
    });
  });

  it('enableRateLimiting false lifts a configured limit', async () => {
    await withServer({ ...base, enableRateLimiting: false }, async (s) => {
      const seq: number[] = [];
      for (let i = 0; i < 6; i++) seq.push(await s.get('/'));
      expect(seq.every((c) => c === 200)).toBe(true);
    }, { rateLimit: 2 });
  });

  it('ipBlacklist bans the caller', async () => {
    await withServer({ ...base, ipBlacklist: ['127.0.0.1'] }, async (s) => {
      expect(await s.get('/')).toBe(403);
    });
  });

  it('emergencyMode locks out callers missing from the whitelist', async () => {
    await withServer({ ...base, emergencyMode: true, emergencyWhitelist: ['10.9.9.9'] }, async (s) => {
      expect(await s.get('/')).toBe(503);
    });
    await withServer({ ...base, emergencyMode: true, emergencyWhitelist: ['127.0.0.1'] }, async (s) => {
      expect(await s.get('/')).toBe(200);
    });
  });
});
