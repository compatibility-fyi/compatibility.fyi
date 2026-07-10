import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

import { compatibilityDataPlugin } from './scripts/compatibility-data-plugin';

export default defineConfig({
  plugins: [
    compatibilityDataPlugin(),
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
