import type { CompatibilityDataset, ProjectSummary } from '../types/compatibility';
import { mergeCompatibilityDatasets } from './dataset';
import { parseCompatibilityYaml } from './validation';
import { compareVersions } from './version';

const yamlModules = import.meta.glob<string>('../../data/*.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const dataSources = Object.entries(yamlModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, source]) => ({ name, source }));

let cachedDataset: CompatibilityDataset | undefined;

export function loadDataset(): CompatibilityDataset {
  cachedDataset ??= mergeCompatibilityDatasets(
    dataSources.map(({ name, source }) => ({
      name,
      dataset: parseCompatibilityYaml(source),
    })),
  );

  return cachedDataset;
}

export function listProjects(dataset: CompatibilityDataset): ProjectSummary[] {
  return Object.entries(dataset.projects)
    .map(([id, project]) => ({
      id,
      name: project.name,
      categories: [...project.categories],
      description: project.description,
      website: project.website,
      versions: Object.keys(project.versions).sort((left, right) => compareVersions(right, left)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
