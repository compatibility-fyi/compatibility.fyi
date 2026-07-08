export type CompatibilityStatus = 'compatible' | 'incompatible' | 'unknown';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface CompatibilitySource {
  title: string;
  url: string;
  accessedAt?: string;
}

export interface DependencyCompatibilityEntry {
  status: CompatibilityStatus;
  ranges: string[];
  confidence: ConfidenceLevel;
  notes: string[];
  sources: CompatibilitySource[];
  lastVerified: string | null;
}

export interface ProjectVersion {
  dependencies: Record<string, DependencyCompatibilityEntry>;
}

export interface DependencyKind {
  singular: string;
  plural: string;
  examples?: string[];
}

export interface ProjectCompatibility {
  name: string;
  description?: string;
  website?: string;
  logo?: string;
  dependencyKind?: DependencyKind;
  versions: Record<string, ProjectVersion>;
}

export interface CompatibilityDataset {
  projects: Record<string, ProjectCompatibility>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  website?: string;
  logo?: string;
  dependencyKind?: DependencyKind;
  versions: string[];
}

export interface CompatibilityCheckRequest {
  project: string;
  version: string;
  dependency: string;
  dependencyVersion: string;
}

export interface CompatibilityCheckResponse extends CompatibilityCheckRequest {
  compatible: CompatibilityStatus;
  matchedRange: string | null;
  confidence: ConfidenceLevel;
  notes: string[];
  sources: CompatibilitySource[];
}
