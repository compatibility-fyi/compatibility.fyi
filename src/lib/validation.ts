import semver from 'semver';
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
  'stable',
  'current',
]);
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseCompatibilityYaml(source: string): CompatibilityDataset {
  const parsed = parse(source) as unknown;
  assertDataset(parsed);
  return parsed;
}

export function assertDataset(value: unknown): asserts value is CompatibilityDataset {
  const root = asRecord(value, 'dataset');
  const projects = asRecord(root.projects, 'projects');

  for (const [projectId, project] of Object.entries(projects)) {
    assertIdentifier(projectId, `projects.${projectId}`);
    const projectRecord = asRecord(project, `projects.${projectId}`);
    assertString(projectRecord.name, `projects.${projectId}.name`);
    if (projectRecord.category !== undefined) {
      throw new Error(`projects.${projectId}.category is not supported; use categories instead`);
    }
    assertStringArray(projectRecord.categories, `projects.${projectId}.categories`);
    if (projectRecord.categories.length === 0) {
      throw new Error(`projects.${projectId}.categories must include at least one category`);
    }
    for (const [index, category] of projectRecord.categories.entries()) {
      assertString(category, `projects.${projectId}.categories.${index}`);
    }
    if (projectRecord.description !== undefined) {
      assertString(projectRecord.description, `projects.${projectId}.description`);
    }
    if (projectRecord.website !== undefined) {
      assertHttpUrl(projectRecord.website, `projects.${projectId}.website`);
    }
    const versions = asRecord(projectRecord.versions, `projects.${projectId}.versions`);
    const versionLabels = Object.keys(versions);
    if (versionLabels.length === 0) {
      throw new Error(`projects.${projectId}.versions must include at least one version`);
    }
    for (const [version, versionData] of Object.entries(versions)) {
      assertStableVersionLabel(version, `projects.${projectId}.versions.${version}`);
      const dependencies = asRecord(
        asRecord(versionData, `projects.${projectId}.versions.${version}`).dependencies,
        `projects.${projectId}.versions.${version}.dependencies`,
      );
      if (Object.keys(dependencies).length === 0) {
        throw new Error(
          `projects.${projectId}.versions.${version}.dependencies must include at least one dependency`,
        );
      }

      for (const [dependency, entry] of Object.entries(dependencies)) {
        assertIdentifier(
          dependency,
          `projects.${projectId}.versions.${version}.dependencies.${dependency}`,
        );
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
  if (entry.status === 'compatible') {
    throw new Error(`${path}.status must be omitted when compatibility constraints are provided`);
  }
  entry.status ??= 'compatible';

  if (!compatibilityStatuses.has(entry.status as CompatibilityStatus)) {
    throw new Error(`${path}.status must be compatible, incompatible, or unknown`);
  }

  assertStringArray(entry.ranges, `${path}.ranges`);
  for (const [index, range] of entry.ranges.entries()) {
    assertString(range, `${path}.ranges.${index}`);
    assertStableVersionLabel(range, `${path}.ranges.${index}`);
    if (/[<>=~^*|]/.test(range) && semver.validRange(range, { loose: true }) === null) {
      throw new Error(`${path}.ranges.${index} must be a valid semver range`);
    }
  }

  if (entry.sameVersion !== undefined && entry.sameVersion !== true) {
    throw new Error(`${path}.sameVersion must be true when provided`);
  }
  const sameVersion = entry.sameVersion === true;

  if (entry.relationship !== undefined) {
    assertString(entry.relationship, `${path}.relationship`);
  }

  if (!confidenceLevels.has(entry.confidence as ConfidenceLevel)) {
    throw new Error(`${path}.confidence must be low, medium, or high`);
  }

  assertStringArray(entry.notes, `${path}.notes`);
  for (const [index, note] of entry.notes.entries()) {
    assertString(note, `${path}.notes.${index}`);
  }
  assertSources(entry.sources, `${path}.sources`);

  if (entry.lastVerified !== null) {
    assertDateString(entry.lastVerified, `${path}.lastVerified`);
  }

  if (sameVersion && entry.ranges.length > 0) {
    throw new Error(`${path} must use either ranges or sameVersion, not both`);
  }

  if (entry.status === 'unknown' && (entry.ranges.length > 0 || sameVersion)) {
    throw new Error(`${path} must not include compatibility constraints when status is unknown`);
  }

  if (entry.status === 'incompatible' && sameVersion) {
    throw new Error(`${path}.sameVersion is only supported for compatible entries`);
  }

  if (entry.status !== 'unknown' && entry.ranges.length === 0 && !sameVersion) {
    throw new Error(`${path} must include at least one range or sameVersion: true`);
  }

  if (entry.confidence !== 'low' && entry.sources.length === 0) {
    throw new Error(`${path}.sources must include evidence when confidence is not low`);
  }

  if (
    entry.confidence !== 'low' &&
    !entry.sources.some((source) => source.accessedAt !== undefined)
  ) {
    throw new Error(`${path}.sources must include an accessedAt date when confidence is not low`);
  }

  if (entry.confidence === 'high' && entry.lastVerified === null) {
    throw new Error(`${path}.lastVerified must include a date when confidence is high`);
  }
}

function assertSources(value: unknown, path: string): asserts value is CompatibilitySource[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  for (const [index, source] of value.entries()) {
    const sourceRecord = asRecord(source, `${path}.${index}`);
    assertString(sourceRecord.title, `${path}.${index}.title`);
    assertHttpUrl(sourceRecord.url, `${path}.${index}.url`);
    if (sourceRecord.accessedAt !== undefined) {
      assertDateString(sourceRecord.accessedAt, `${path}.${index}.accessedAt`);
    }
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

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${path} must be a valid calendar date`);
  }
}

function assertHttpUrl(value: unknown, path: string): asserts value is string {
  assertString(value, path);
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    if (url.username || url.password) {
      throw new Error('credentials are not allowed');
    }
    if (url.port) {
      throw new Error('nonstandard ports are not allowed');
    }
  } catch {
    throw new Error(
      `${path} must be a valid HTTP or HTTPS URL without credentials or nonstandard ports`,
    );
  }
}

function assertIdentifier(value: string, path: string): void {
  if (!identifierPattern.test(value)) {
    throw new Error(`${path} must use a lowercase-dash identifier`);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
}
