import { describe, it, expect } from 'vitest';

import { resolveDetectionExclusions } from '../../src/core/routing/detection-exclusions.js';
import { SecurityDecorator } from '../../src/decorators/index.js';
import { SusPatternsManager } from '../../src/handlers/sus-patterns.js';
import { defaultLogger } from '../../src/models/logger.js';
import { RouteConfig } from '../../src/models/route-config.js';
import { scanRequestWithManager } from '../../src/utils.js';
import { createMockRequest, createTestConfig } from '../helpers.js';

const JWT_COOKIE =
  'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
  + 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.'
  + 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

function config(overrides: Record<string, unknown> = {}) {
  return createTestConfig({ detectionSemanticThreshold: 0.3, ...overrides });
}

async function scan(
  headers: Record<string, string>,
  cfg: ReturnType<typeof config>,
  route: RouteConfig | null = null,
) {
  const manager = new SusPatternsManager(cfg, defaultLogger);
  return scanRequestWithManager(
    manager,
    createMockRequest({ headers }),
    cfg,
    resolveDetectionExclusions(cfg, route),
  );
}

describe('excludedSemanticDetectionHeaders', () => {
  it('defaults to empty', () => {
    expect(createTestConfig().excludedSemanticDetectionHeaders).toEqual([]);
  });

  it('flags a JWT cookie semantically by default', async () => {
    const [isThreat, info] = await scan({ cookie: JWT_COOKIE }, config());
    expect(isThreat).toBe(true);
    expect(info).toContain('Semantic attack');
  });

  it('skips semantic analysis for a listed header, case-insensitively and trimmed', async () => {
    const [isThreat] = await scan(
      { cookie: JWT_COOKIE },
      config({ excludedSemanticDetectionHeaders: [' Cookie '] }),
    );
    expect(isThreat).toBe(false);
  });

  it('still analyses an unlisted header semantically', async () => {
    const [isThreat] = await scan(
      { 'x-session': JWT_COOKIE },
      config({ excludedSemanticDetectionHeaders: ['cookie'] }),
    );
    expect(isThreat).toBe(true);
  });

  it('keeps regex scanning of a listed header', async () => {
    const [isThreat, info] = await scan(
      { cookie: "id=1' OR '1'='1' UNION SELECT 1--" },
      config({ excludedSemanticDetectionHeaders: ['cookie'] }),
    );
    expect(isThreat).toBe(true);
    expect(info).not.toContain('Semantic attack');
  });

  it('merges the route-level set through detectionExclusion', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mixin composition needs the any cast
    const decorator = new (SecurityDecorator as any)(config());
    const handler = (): string => 'ok';
    decorator.detectionExclusion({ semanticHeaders: new Set(['cookie']) })(handler);
    const route = decorator.getRouteConfig((handler as unknown as Record<string, unknown>)['_guardRouteId'] as string) as RouteConfig;
    expect(route.excludedSemanticDetectionHeaders).toEqual(new Set(['cookie']));

    const [isThreat] = await scan({ cookie: JWT_COOKIE }, config(), route);
    expect(isThreat).toBe(false);
  });

  it('does not leak the exclusion into the next request', async () => {
    const excluded = config({ excludedSemanticDetectionHeaders: ['cookie'] });
    expect((await scan({ cookie: JWT_COOKIE }, excluded))[0]).toBe(false);
    expect((await scan({ cookie: JWT_COOKIE }, config()))[0]).toBe(true);
  });
});
