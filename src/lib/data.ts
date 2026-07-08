import type { CompatibilityDataset, ProjectSummary } from '../types/compatibility';
import { parseCompatibilityYaml } from './validation';
import { compareVersions } from './version';

const yamlModules = import.meta.glob<string>('../../data/*.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
});

const dataSources = Object.entries(yamlModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, source]) => source);

export function loadDataset(): CompatibilityDataset {
  return dataSources.map(parseCompatibilityYaml).reduce<CompatibilityDataset>(
    (dataset, source) => ({
      projects: {
        ...dataset.projects,
        ...source.projects,
      },
    }),
    { projects: {} },
  );
}

export function listProjects(dataset: CompatibilityDataset): ProjectSummary[] {
  return Object.entries(dataset.projects)
    .map(([id, project]) => ({
      id,
      name: project.name,
      category: project.category,
      description: project.description,
      website: project.website,
      dependencyKind: project.dependencyKind,
      versions: Object.keys(project.versions).sort((left, right) => compareVersions(right, left)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
