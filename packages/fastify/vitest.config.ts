import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/websocket.ts'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
