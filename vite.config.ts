import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { compatibilityDataPlugin } from './scripts/compatibility-data-plugin';

export default defineConfig({
  plugins: [compatibilityDataPlugin(), react(), cloudflare()],
});
