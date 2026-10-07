import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  /* The engine version the disk-backed pattern-validation cache stamps its
     entries with (kept in sync with the tsup define). */
  define: { __GUARDCORE_VERSION__: JSON.stringify(pkg.version) },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/**/index.ts',
        'src/protocols/**',
        'src/handlers/registry.ts',
      ],
      /* Branch coverage is capped at 97: the remaining ~72 branch paths are
         v8 implicit-else artifacts (if statements without an else) that
         @vitest/coverage-v8 5.x reports with EMPTY source locations, which
         no ignore hint can suppress (ast-v8-to-istanbul maps hints by line,
         and an empty location has no line). Statements, functions and lines
         are held at a hard 100. */
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 97,
        statements: 100,
      },
    },
  },
});
