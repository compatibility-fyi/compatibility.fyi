import type { CompatibilityDataset } from '../types/compatibility';

export interface CompatibilityDatasetSource {
  name: string;
  dataset: CompatibilityDataset;
}

export function mergeCompatibilityDatasets(
  sources: CompatibilityDatasetSource[],
): CompatibilityDataset {
  const projects = Object.create(null) as CompatibilityDataset['projects'];

  for (const source of sources) {
    const projectIds = Object.keys(source.dataset.projects);
    if (projectIds.length !== 1) {
      throw new Error(`${source.name} must contain exactly one project`);
    }

    const projectId = projectIds[0];
    const expectedProjectId = projectIdFromSourceName(source.name);
    if (expectedProjectId && projectId !== expectedProjectId) {
      throw new Error(
        `${source.name} must define project "${expectedProjectId}", found "${projectId}"`,
      );
    }

    if (Object.hasOwn(projects, projectId)) {
      throw new Error(`duplicate project id "${projectId}" in ${source.name}`);
    }

    projects[projectId] = source.dataset.projects[projectId];
  }

  return { projects };
}

function projectIdFromSourceName(sourceName: string): string | null {
  const filename = sourceName.split(/[\\/]/).at(-1);
  return filename?.endsWith('.yaml') ? filename.slice(0, -'.yaml'.length) : null;
}
