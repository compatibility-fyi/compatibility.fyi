import dataset from 'virtual:compatibility-data';

import type { CompatibilityDataset, ProjectSummary } from '../types/compatibility';
import { compareVersions } from './version';

export function loadDataset(): CompatibilityDataset {
  return dataset;
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
