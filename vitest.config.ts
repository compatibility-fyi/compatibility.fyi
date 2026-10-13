import { cloudflareTest } from '@cloudflare/vitest-plugin';
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
    // Workers cannot read Vitest 5.0.4's host filesystem module cache.
    fsModuleCache: false,
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
