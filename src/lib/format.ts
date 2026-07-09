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

function formatLabelTitle(label: string): string {
  if (label === label.toLowerCase()) {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return label;
}
