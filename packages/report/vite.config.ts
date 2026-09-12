import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Built at publish time into the core package, which serves it from 127.0.0.1 and inlines it into
// the print document. Relative base so the bundle works from any path and inside the inlined page.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../core/assets/report',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5179,
    proxy: { '/api': 'http://127.0.0.1:3579', '/report': 'http://127.0.0.1:3579' },
  },
});
