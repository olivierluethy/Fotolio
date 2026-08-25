import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + media to the PHP server so the SPA is same-origin
// (keeps the httpOnly refresh cookie working without CORS complications).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      // The Site Editor iframe + Preview render the real PHP theme, which
      // pulls its stylesheet, script and favicons from the API origin.
      '/assets': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/favicon.svg': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/favicon-32.png': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  // Pre-bundle cobe so its ESM loads as a single optimized dep. Without this the
  // globe's dynamic chunk can 504 in dev after a dependency change (Vite serving
  // a stale optimized module); listing it keeps the optimizer's hash stable.
  optimizeDeps: {
    include: ['cobe'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
