import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mergeCompatibilityDatasets } from '../src/lib/dataset';
import { parseCompatibilityYaml } from '../src/lib/validation';

const files = process.argv.slice(2);

if (files.length === 0) {
  throw new Error('Usage: tsx scripts/validate-data.ts data/*.yaml');
}

const sources = await Promise.all(
  files.map(async (file) => ({
    name: file,
    dataset: parseCompatibilityYaml(await readFile(resolve(file), 'utf8')),
  })),
);

mergeCompatibilityDatasets(sources);

for (const file of files) {
  console.log(`valid ${file}`);
}
