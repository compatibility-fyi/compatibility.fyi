import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), cloudflare()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
