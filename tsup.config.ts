import { defineConfig } from 'tsup';

// Dual ESM + CJS build, same layout as the other @axium-lab libraries.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    outDir: 'dist/esm',
    target: 'es2022',
    dts: true,
    splitting: false,
    clean: false,
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs'],
    outDir: 'dist/cjs',
    target: 'es2022',
    dts: false,
    splitting: false,
    clean: false,
  },
]);
