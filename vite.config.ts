import { resolve } from 'node:path';

import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, type Plugin } from 'vite';

import { compatibilityDataPlugin } from './scripts/compatibility-data-plugin';

export default defineConfig({
  plugins: [compatibilityDataPlugin(), clientEntriesPlugin(), cloudflare()],
});

function clientEntriesPlugin(): Plugin {
  return {
    name: 'client-entries',
    configEnvironment(name) {
      if (name !== 'client') {
        return;
      }

      return {
        build: {
          manifest: true,
          rollupOptions: {
            input: {
              catalog: resolve('src/client/catalog.ts'),
              docs: resolve('src/client/docs.ts'),
              index: resolve('index.html'),
              project: resolve('src/client/project.ts'),
            },
          },
        },
      };
    },
  };
}
