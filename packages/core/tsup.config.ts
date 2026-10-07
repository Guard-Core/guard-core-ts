import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  /* The engine version the disk-backed pattern-validation cache stamps its
     entries with (the reference ENGINE_VERSION from the installed
     guard-core metadata). */
  define: { __GUARDCORE_VERSION__: JSON.stringify(pkg.version) },
});
