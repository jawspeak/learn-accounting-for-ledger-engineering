/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Relative base so the build works under any GitHub Pages path.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@contracts': r('./src/contracts/index.ts'),
      '@engine': r('./src/engine/index.ts'),
      '@content': r('./content/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'content/**/*.test.ts'],
  },
});
