import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';

import { mergeCompatibilityDatasets } from '../src/lib/dataset';
import { parseCompatibilityYaml } from '../src/lib/validation';
import type { CompatibilityDataset } from '../src/types/compatibility';

const virtualModuleId = 'virtual:compatibility-data';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

export function compatibilityDataPlugin(): Plugin {
  let projectRoot = process.cwd();

  return {
    name: 'compatibility-data',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root;
    },
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) {
        return undefined;
      }

      const dataDirectory = resolve(projectRoot, 'data');
      const files = await listDataFiles(dataDirectory);

      for (const file of files) {
        this.addWatchFile(join(dataDirectory, file));
      }

      const dataset = await loadCompatibilityDataset(dataDirectory, files);
      return `export default ${JSON.stringify(dataset)};`;
    },
  };
}

export async function loadCompatibilityDataset(
  dataDirectory = resolve('data'),
  files?: string[],
): Promise<CompatibilityDataset> {
  const dataFiles = files ?? (await listDataFiles(dataDirectory));
  const sources = await Promise.all(
    dataFiles.map(async (file) => ({
      name: file,
      dataset: parseCompatibilityYaml(await readFile(join(dataDirectory, file), 'utf8')),
    })),
  );

  return mergeCompatibilityDatasets(sources);
}

async function listDataFiles(dataDirectory: string): Promise<string[]> {
  return (await readdir(dataDirectory))
    .filter((file) => file.endsWith('.yaml'))
    .sort((left, right) => left.localeCompare(right));
}
