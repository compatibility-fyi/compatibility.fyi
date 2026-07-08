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

  const matchedRange =
    entry.status === 'unknown'
      ? null
      : (entry.ranges.find((range) => versionSatisfiesRange(request.dependencyVersion, range)) ??
        null);

  return {
    ...request,
    compatible: matchedRange ? entry.status : 'unknown',
    matchedRange,
    confidence: entry.confidence,
    notes: matchedRange ? entry.notes : [],
    sources: matchedRange ? entry.sources : [],
  };
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
