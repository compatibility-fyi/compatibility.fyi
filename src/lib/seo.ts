import type { CompatibilityDataset, ProjectCompatibility } from '../types/compatibility';

export const siteUrl = 'https://compatibility.fyi';
export const siteName = 'compatibility.fyi';
export const defaultSeoDescription =
  'Open software compatibility metadata for projects, versions, dependencies, and automation.';

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
}

export function getSeoMetadata(path: string, dataset: CompatibilityDataset): SeoMetadata {
  const normalizedPath = normalizePath(path);
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)$/);

  if (normalizedPath === '/docs/api') {
    return {
      title: `HTTP API v1 | ${siteName}`,
      description:
        'Use the compatibility.fyi HTTP API to list projects, inspect compatibility matrices, and check software version compatibility as JSON.',
      canonicalPath: '/docs/api',
    };
  }

  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const project = dataset.projects[projectId];

    if (project) {
      return getProjectSeoMetadata(projectId, project);
    }

    return {
      title: `Project not found | ${siteName}`,
      description: `No compatibility metadata exists for ${projectId}.`,
      canonicalPath: normalizedPath,
    };
  }

  return {
    title: `${siteName} | Open Software Compatibility Metadata`,
    description:
      'Find source-backed compatibility matrices for software projects, runtimes, databases, Kubernetes versions, operators, and automation tools.',
    canonicalPath: '/',
  };
}

export function getProjectSeoMetadata(
  projectId: string,
  project: ProjectCompatibility,
): SeoMetadata {
  const versions = Object.keys(project.versions).length;
  const dependencies = new Set(
    Object.values(project.versions).flatMap((version) => Object.keys(version.dependencies)),
  ).size;
  const description =
    project.description ??
    `${project.name} compatibility metadata for ${versions} project versions and ${dependencies} dependencies.`;

  return {
    title: `${project.name} Compatibility Matrix | ${siteName}`,
    description,
    canonicalPath: `/projects/${projectId}`,
  };
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

function normalizePath(path: string): string {
  const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return withoutTrailingSlash || '/';
}
