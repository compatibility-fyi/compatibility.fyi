import { parse } from 'yaml';
import type {
  CompatibilityDataset,
  CompatibilitySource,
  CompatibilityStatus,
  ConfidenceLevel,
  DependencyCompatibilityEntry,
} from '../types/compatibility';

const compatibilityStatuses = new Set<CompatibilityStatus>([
  'compatible',
  'incompatible',
  'unknown',
]);
const confidenceLevels = new Set<ConfidenceLevel>(['low', 'medium', 'high']);
const movingVersionLabels = new Set([
  'latest',
  'dev',
  'dev-latest',
  'snapshot',
  'nightly',
  'main',
  'master',
  'head',
  'edge',
  'canary',
]);

export function parseCompatibilityYaml(source: string): CompatibilityDataset {
  const parsed = parse(source) as unknown;
  assertDataset(parsed);
  return parsed;
}

export function assertDataset(value: unknown): asserts value is CompatibilityDataset {
  const root = asRecord(value, 'dataset');
  const projects = asRecord(root.projects, 'projects');

  for (const [projectId, project] of Object.entries(projects)) {
    const projectRecord = asRecord(project, `projects.${projectId}`);
    assertString(projectRecord.name, `projects.${projectId}.name`);
    if (projectRecord.category !== undefined) {
      assertString(projectRecord.category, `projects.${projectId}.category`);
    }
    if (projectRecord.description !== undefined) {
      assertString(projectRecord.description, `projects.${projectId}.description`);
    }
    if (projectRecord.website !== undefined) {
      assertUrl(projectRecord.website, `projects.${projectId}.website`);
    }
    if (projectRecord.dependencyKind !== undefined) {
      assertDependencyKind(projectRecord.dependencyKind, `projects.${projectId}.dependencyKind`);
    }

    const versions = asRecord(projectRecord.versions, `projects.${projectId}.versions`);
    for (const [version, versionData] of Object.entries(versions)) {
      assertStableVersionLabel(version, `projects.${projectId}.versions.${version}`);
      const dependencies = asRecord(
        asRecord(versionData, `projects.${projectId}.versions.${version}`).dependencies,
        `projects.${projectId}.versions.${version}.dependencies`,
      );

      for (const [dependency, entry] of Object.entries(dependencies)) {
        assertCompatibilityEntry(
          entry,
          `projects.${projectId}.versions.${version}.dependencies.${dependency}`,
        );
      }
    }
  }
}

function assertCompatibilityEntry(
  value: unknown,
  path: string,
): asserts value is DependencyCompatibilityEntry {
  const entry = asRecord(value, path);

  if (!compatibilityStatuses.has(entry.status as CompatibilityStatus)) {
    throw new Error(`${path}.status must be compatible, incompatible, or unknown`);
  }

  assertStringArray(entry.ranges, `${path}.ranges`);
  for (const [index, range] of entry.ranges.entries()) {
    assertStableVersionLabel(range, `${path}.ranges.${index}`);
  }

  if (entry.relationship !== undefined) {
    assertString(entry.relationship, `${path}.relationship`);
  }

  if (!confidenceLevels.has(entry.confidence as ConfidenceLevel)) {
    throw new Error(`${path}.confidence must be low, medium, or high`);
  }

  assertStringArray(entry.notes, `${path}.notes`);
  assertSources(entry.sources, `${path}.sources`);

  if (entry.lastVerified !== null) {
    assertDateString(entry.lastVerified, `${path}.lastVerified`);
  }

  if (entry.status === 'unknown' && entry.ranges.length > 0) {
    throw new Error(`${path}.ranges must be empty when status is unknown`);
  }

  if (entry.confidence !== 'low' && entry.sources.length === 0) {
    throw new Error(`${path}.sources must include evidence when confidence is not low`);
  }
}

function assertSources(value: unknown, path: string): asserts value is CompatibilitySource[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  for (const [index, source] of value.entries()) {
    const sourceRecord = asRecord(source, `${path}.${index}`);
    assertString(sourceRecord.title, `${path}.${index}.title`);
    assertString(sourceRecord.url, `${path}.${index}.url`);
    if (sourceRecord.accessedAt !== undefined) {
      assertDateString(sourceRecord.accessedAt, `${path}.${index}.accessedAt`);
    }
  }
}

function assertDependencyKind(value: unknown, path: string): void {
  const dependencyKind = asRecord(value, path);
  assertString(dependencyKind.singular, `${path}.singular`);
  assertString(dependencyKind.plural, `${path}.plural`);

  if (dependencyKind.examples !== undefined) {
    assertStringArray(dependencyKind.examples, `${path}.examples`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${path} must be an array of strings`);
  }
}

function assertStableVersionLabel(value: string, path: string): void {
  const normalized = value.trim().toLowerCase();
  if (movingVersionLabels.has(normalized)) {
    throw new Error(`${path} must not use moving version label "${value}"`);
  }

  for (const label of movingVersionLabels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9])${escapedLabel}([^a-z0-9]|$)`, 'i');
    if (pattern.test(value)) {
      throw new Error(`${path} must not include moving version label "${label}"`);
    }
  }
}

function assertDateString(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} must use YYYY-MM-DD format`);
  }
}

function assertUrl(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  try {
    new URL(value);
  } catch {
    throw new Error(`${path} must be a valid URL`);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}
