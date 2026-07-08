import keycloakYaml from '../../data/keycloak.yaml?raw';
import type { CompatibilityDataset, ProjectSummary } from '../types/compatibility';
import { parseCompatibilityYaml } from './validation';
import { compareVersions } from './version';

const dataSources = [keycloakYaml];

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
      description: project.description,
      website: project.website,
      logo: project.logo,
      dependencyKind: project.dependencyKind,
      versions: Object.keys(project.versions).sort((left, right) => compareVersions(right, left)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
