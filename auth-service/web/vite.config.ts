import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:3847',
      '/api': 'http://127.0.0.1:3847',
      '/webhook': 'http://127.0.0.1:3847',
      '/bot': 'http://127.0.0.1:3847',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
