import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCompatibilityYaml } from '../src/lib/validation';

const files = process.argv.slice(2);

if (files.length === 0) {
  throw new Error('Usage: tsx scripts/validate-data.ts data/*.yaml');
}

for (const file of files) {
  const source = await readFile(resolve(file), 'utf8');
  parseCompatibilityYaml(source);
  console.log(`valid ${file}`);
}
