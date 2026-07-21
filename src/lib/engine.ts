import type {
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  CompatibilityDataset,
  CompoundCompatibilityCheckRequest,
  CompoundCompatibilityCheckResponse,
  DependencyCompatibilityEntry,
} from '../types/compatibility';
import { normalizeVersion, versionSatisfiesRange } from './version';

const unknownEntry: DependencyCompatibilityEntry = {
  status: 'unknown',
  ranges: [],
  confidence: 'low',
  notes: [],
  sources: [],
  lastVerified: null,
};

export function checkCompatibility(
  dataset: CompatibilityDataset,
  request: CompatibilityCheckRequest,
): CompatibilityCheckResponse {
  const project = dataset.projects[request.project];
  const versionKey = findVersionKey(Object.keys(project?.versions ?? {}), request.version);
  const dependency = project?.versions[versionKey ?? '']?.dependencies[request.dependency];
  const entry = dependency ?? unknownEntry;
  const dependencyExists = Boolean(dependency);

  const matchedRange =
    entry.status === 'unknown'
      ? null
      : (entry.ranges.find((range) => versionSatisfiesRange(request.dependencyVersion, range)) ??
        null);
  const compatible = getCompatibilityResult(entry, dependencyExists, matchedRange);
  const includeEvidence =
    dependencyExists &&
    (entry.status === 'unknown' || Boolean(matchedRange) || compatible === 'incompatible');

  return {
    ...request,
    compatible,
    matchedRange,
    relationship: entry.relationship ?? null,
    confidence: entry.confidence,
    lastVerified: entry.lastVerified,
    notes: includeEvidence ? entry.notes : [],
    sources: includeEvidence ? entry.sources : [],
  };
}

export function checkCompoundCompatibility(
  dataset: CompatibilityDataset,
  request: CompoundCompatibilityCheckRequest,
): CompoundCompatibilityCheckResponse {
  const checks = Object.entries(request.dependencies).map(([dependency, dependencyVersion]) =>
    checkCompatibility(dataset, {
      project: request.project,
      version: request.version,
      dependency,
      dependencyVersion,
    }),
  );

  return {
    ...request,
    compatible: summarizeChecks(checks),
    checks,
  };
}

function summarizeChecks(checks: CompatibilityCheckResponse[]) {
  if (checks.some((check) => check.compatible === 'incompatible')) {
    return 'incompatible';
  }

  if (checks.length === 0 || checks.some((check) => check.compatible === 'unknown')) {
    return 'unknown';
  }

  return 'compatible';
}

function getCompatibilityResult(
  entry: DependencyCompatibilityEntry,
  dependencyExists: boolean,
  matchedRange: string | null,
) {
  if (matchedRange) {
    return entry.status;
  }

  if (dependencyExists && entry.status === 'compatible' && entry.ranges.length > 0) {
    return 'incompatible';
  }

  return 'unknown';
}

function findVersionKey(versions: string[], requestedVersion: string): string | null {
  const normalizedRequest = normalizeVersion(requestedVersion);

  const exactMatch = versions.find((version) => {
    const normalizedVersion = normalizeVersion(version);

    if (normalizedRequest.semver && normalizedVersion.semver) {
      return normalizedRequest.semver === normalizedVersion.semver;
    }

    return normalizedVersion.normalized === normalizedRequest.normalized;
  });

  if (exactMatch) {
    return exactMatch;
  }

  return (
    [...versions]
      .sort((left, right) => versionSpecificity(right) - versionSpecificity(left))
      .find((version) => versionSatisfiesRange(requestedVersion, version)) ?? null
  );
}

function versionSpecificity(version: string): number {
  return version.match(/^v?\d+(?:\.\d+){0,2}$/)?.[0].split('.').length ?? 0;
}
