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
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
