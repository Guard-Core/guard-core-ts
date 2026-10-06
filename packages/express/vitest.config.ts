import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
            /* The M2 websocket seam is a pure re-export of the core node upgrade
         guard; its behavior is covered by core's node-websocket-guard suite. */
      exclude: ['src/index.ts', 'src/websocket.ts'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
