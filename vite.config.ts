/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite/React scaffolding for the in-progress migration off Angular.
//
// Angular (ng serve / ng build) continues to own `src/index.html`,
// `src/main.ts`, `src/app/**`, and the default `dist/` output directory.
// This config gives Vite its own HTML entry point (`index.vite.html`) and
// its own output directory (`dist-vite`) so the two toolchains never
// collide while both live in this repo.
//
// Dev server: visit http://localhost:5173/index.vite.html (there is no
// `index.html` at the project root for Vite to fall back to).
export default defineConfig({
  root: '.',
  plugins: [react()],
  build: {
    outDir: 'dist-vite',
    rollupOptions: {
      input: resolve(__dirname, 'index.vite.html'),
    },
  },
  server: {
    open: '/index.vite.html',
    proxy: {
      // Mirrors proxy.conf.json (used by `ng serve`) so `/api` behaves the
      // same way under both toolchains during the migration.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    // Vitest config for the React/Vite tree. Angular owns `src/app/**` (and
    // has its own Karma-based `ng test` runner), so it's excluded here -
    // Vitest should only ever see the React side of the migration.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/app/**', 'node_modules/**', 'dist/**', 'dist-vite/**'],
  },
});
