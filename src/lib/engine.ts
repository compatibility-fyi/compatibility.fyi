import type {
  CompatibilityCheckRequest,
  CompatibilityCheckResponse,
  CompatibilityDataset,
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
    Boolean(matchedRange) || (dependencyExists && compatible === 'incompatible');

  return {
    ...request,
    compatible,
    matchedRange,
    confidence: entry.confidence,
    notes: includeEvidence ? entry.notes : [],
    sources: includeEvidence ? entry.sources : [],
  };
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

  return (
    versions.find((version) => {
      const normalizedVersion = normalizeVersion(version);

      if (normalizedRequest.semver && normalizedVersion.semver) {
        return normalizedRequest.semver === normalizedVersion.semver;
      }

      return normalizedVersion.normalized === normalizedRequest.normalized;
    }) ?? null
  );
}
