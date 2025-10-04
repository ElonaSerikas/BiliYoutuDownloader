import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: {
        main: path.resolve(__dirname, 'src/main/main.ts'),
        preload: path.resolve(__dirname, 'src/main/preload.ts')
      },
      formats: ['cjs'],
      fileName: (_format, entry) => `${entry}.js`
    },
    rollupOptions: {
      external: ['electron']
    },
    sourcemap: true,
    minify: false,
  }
});