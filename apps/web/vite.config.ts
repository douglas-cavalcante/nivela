import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { src: fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    // mesma origem da API: o XHR do jsdom não faz preflight de CORS nos testes com MSW
    environmentOptions: { jsdom: { url: 'http://localhost:8000' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_URL: 'http://localhost:8000/api/v1' },
  },
});
