import type { DependencyCompatibilityEntry } from '../types/compatibility';

const dependencyWordLabels: Record<string, string> = {
  api: 'API',
  aurora: 'Aurora',
  aws: 'AWS',
  azure: 'Azure',
  coredns: 'CoreDNS',
  cni: 'CNI',
  dns: 'DNS',
  eks: 'EKS',
  gcp: 'GCP',
  gke: 'GKE',
  gitlab: 'GitLab',
  ip: 'IP',
  jdbc: 'JDBC',
  kubernetes: 'Kubernetes',
  ldap: 'LDAP',
  mariadb: 'MariaDB',
  mce: 'MCE',
  mssql: 'Microsoft SQL Server',
  mysql: 'MySQL',
  oidc: 'OIDC',
  openshift: 'OpenShift',
  php: 'PHP',
  postgresql: 'PostgreSQL',
  powershell: 'PowerShell',
  python: 'Python',
  rhacm: 'RHACM',
  sql: 'SQL',
  tls: 'TLS',
};

export function formatDependencyName(dependency: string): string {
  return dependency
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => dependencyWordLabels[word.toLowerCase()] ?? formatLabelTitle(word))
    .join(' ');
}

export function formatRange(range: string): string {
  const match = range.match(/^>=(\d+)\.(\d+)\.(\d+) <(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return range;
  }

  const [, lowerMajor, lowerMinor, lowerPatch, upperMajor, upperMinor, upperPatch] =
    match.map(Number);

  if (lowerMinor === 0 && lowerPatch === 0 && upperMajor === lowerMajor + 1) {
    return lowerMajor >= 1000 ? String(lowerMajor) : `${lowerMajor}.x`;
  }

  if (
    lowerPatch === 0 &&
    upperMajor === lowerMajor &&
    upperMinor === lowerMinor + 1 &&
    upperPatch === 0
  ) {
    return `${lowerMajor}.${lowerMinor}.x`;
  }

  if (lowerPatch === 0 && upperMajor === lowerMajor + 1 && upperMinor === 0 && upperPatch === 0) {
    return `${lowerMajor}.${lowerMinor}+`;
  }

  return range;
}

export function formatCompatibilityConstraints(entry: DependencyCompatibilityEntry): string[] {
  if (entry.sameVersion) {
    return ['Same exact version as project'];
  }

  return entry.ranges.map(formatRange);
}

export function countCompatibilityConstraints(entry: DependencyCompatibilityEntry): number {
  return entry.ranges.length + (entry.sameVersion ? 1 : 0);
}

function formatLabelTitle(label: string): string {
  if (label === label.toLowerCase()) {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return label;
}
