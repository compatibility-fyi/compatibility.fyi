import type {
  CompatibilityDataset,
  DependencyCompatibilityEntry,
  ProjectCompatibility,
} from '../types/compatibility';
import { formatDependencyName } from './format';
import { compareVersions } from './version';

export const siteUrl = 'https://compatibility.fyi';
export const siteName = 'compatibility.fyi';
export const robotsContent =
  'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: string;
}

export function getSeoMetadata(path: string, dataset: CompatibilityDataset): SeoMetadata {
  const normalizedPath = normalizePath(path);
  const dependencyMatch = normalizedPath.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)$/);

  if (normalizedPath === '/docs/api') {
    return {
      title: `HTTP API v1 | ${siteName}`,
      description:
        'Use the compatibility.fyi HTTP API to list projects, inspect compatibility matrices, and check software version compatibility as JSON.',
      canonicalPath: '/docs/api/',
    };
  }

  if (dependencyMatch) {
    const projectId = decodeURIComponent(dependencyMatch[1]);
    const dependencyId = decodeURIComponent(dependencyMatch[2]);
    const project = dataset.projects[projectId];

    if (project && getProjectDependencyIds(project).includes(dependencyId)) {
      return getDependencySeoMetadata(projectId, project, dependencyId);
    }

    return {
      title: `Compatibility page not found | ${siteName}`,
      description: `No compatibility metadata exists for ${projectId} and ${dependencyId}.`,
      robots: 'noindex,follow',
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
      robots: 'noindex,follow',
    };
  }

  if (normalizedPath === '/' || normalizedPath === '/projects') {
    return {
      title: `${siteName} | Open Software Compatibility Metadata`,
      description:
        'Find source-backed software compatibility matrices and gate Renovate updates with GitHub Actions or GitLab CI before incompatible changes are opened.',
      canonicalPath: '/',
    };
  }

  return {
    title: `Page not found | ${siteName}`,
    description: 'The requested compatibility.fyi page does not exist.',
    robots: 'noindex,follow',
  };
}

export function getProjectSeoMetadata(
  projectId: string,
  project: ProjectCompatibility,
): SeoMetadata {
  const versions = Object.keys(project.versions).length;
  const dependencyIds = getProjectDependencyIds(project);
  const dependencyNames = dependencyIds.map(formatDependencyName);
  const generatedDescription = `${project.name} version compatibility with ${formatList(dependencyNames)}. Source-backed ranges for ${versions} project ${versions === 1 ? 'version' : 'versions'}.`;
  const description = truncateDescription(
    project.description ? `${project.description} ${generatedDescription}` : generatedDescription,
  );

  return {
    title: `${project.name} Compatibility Matrix | ${siteName}`,
    description,
    canonicalPath: `/projects/${projectId}/`,
  };
}

export function getDependencySeoMetadata(
  projectId: string,
  project: ProjectCompatibility,
  dependencyId: string,
): SeoMetadata {
  const dependencyName = formatDependencyName(dependencyId);
  const searchName = dependencyId === 'postgresql' ? 'PostgreSQL (Postgres)' : dependencyName;
  const entries = getDependencyEntries(project, dependencyId);
  const latestNote = entries[0]?.[1].notes[0];
  const fallback = `${entries.length} ${project.name} versions include documented ${dependencyName} compatibility ranges, notes, sources, and verification dates.`;

  return {
    title: `${project.name} ${dependencyName} Version Compatibility | ${siteName}`,
    description: truncateDescription(
      `${project.name} ${searchName} version compatibility. ${latestNote ?? fallback}`,
    ),
    canonicalPath: `/projects/${projectId}/${dependencyId}/`,
  };
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export function countProjectDependencies(project: ProjectCompatibility): number {
  return getProjectDependencyIds(project).length;
}

export function getProjectDependencyIds(project: ProjectCompatibility): string[] {
  return [
    ...new Set(
      Object.values(project.versions).flatMap((version) => Object.keys(version.dependencies)),
    ),
  ].sort((left, right) =>
    formatDependencyName(left).localeCompare(formatDependencyName(right), undefined, {
      sensitivity: 'base',
    }),
  );
}

export function getDependencyEntries(
  project: ProjectCompatibility,
  dependencyId: string,
): [string, DependencyCompatibilityEntry][] {
  return Object.entries(project.versions)
    .flatMap(([version, versionData]) => {
      const entry = versionData.dependencies[dependencyId];
      return entry ? ([[version, entry]] as [string, DependencyCompatibilityEntry][]) : [];
    })
    .sort(([left], [right]) => compareVersions(right, left));
}

export function getProjectLastVerified(project: ProjectCompatibility): string | null {
  const dates = Object.values(project.versions).flatMap((version) =>
    Object.values(version.dependencies).flatMap((entry) =>
      entry.lastVerified ? [entry.lastVerified] : [],
    ),
  );

  return dates.sort().at(-1) ?? null;
}

export function getDependencyLastVerified(
  project: ProjectCompatibility,
  dependencyId: string,
): string | null {
  return (
    getDependencyEntries(project, dependencyId)
      .flatMap(([, entry]) => (entry.lastVerified ? [entry.lastVerified] : []))
      .sort()
      .at(-1) ?? null
  );
}

export function normalizePath(path: string): string {
  const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return withoutTrailingSlash || '/';
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return 'documented dependencies';
  }

  const visible = values.slice(0, 5);
  const remaining = values.length - visible.length;

  if (remaining > 0) {
    return `${visible.join(', ')}, and ${remaining} more ${remaining === 1 ? 'dependency' : 'dependencies'}`;
  }

  if (visible.length === 1) {
    return visible[0];
  }

  return `${visible.slice(0, -1).join(', ')}, and ${visible.at(-1)}`;
}

function truncateDescription(description: string, maximumLength = 190): string {
  if (description.length <= maximumLength) {
    return description;
  }

  const truncated = description.slice(0, maximumLength - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : undefined).replace(/[.,;:]$/, '')}…`;
}
