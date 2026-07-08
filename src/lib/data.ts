import envoyGatewayYaml from '../../data/envoy-gateway.yaml?raw';
import argocdYaml from '../../data/argocd.yaml?raw';
import calicoYaml from '../../data/calico.yaml?raw';
import certManagerYaml from '../../data/cert-manager.yaml?raw';
import ciliumYaml from '../../data/cilium.yaml?raw';
import cloudnativepgYaml from '../../data/cloudnativepg.yaml?raw';
import keycloakYaml from '../../data/keycloak.yaml?raw';
import fluxYaml from '../../data/flux.yaml?raw';
import helmYaml from '../../data/helm.yaml?raw';
import type { CompatibilityDataset, ProjectSummary } from '../types/compatibility';
import { parseCompatibilityYaml } from './validation';
import { compareVersions } from './version';

const dataSources = [
  keycloakYaml,
  envoyGatewayYaml,
  cloudnativepgYaml,
  argocdYaml,
  fluxYaml,
  certManagerYaml,
  ciliumYaml,
  helmYaml,
  calicoYaml,
];

export function loadDataset(): CompatibilityDataset {
  return dataSources.map(parseCompatibilityYaml).reduce<CompatibilityDataset>(
    (dataset, source) => ({
      projects: {
        ...dataset.projects,
        ...source.projects,
      },
    }),
    { projects: {} },
  );
}

export function listProjects(dataset: CompatibilityDataset): ProjectSummary[] {
  return Object.entries(dataset.projects)
    .map(([id, project]) => ({
      id,
      name: project.name,
      category: project.category,
      description: project.description,
      website: project.website,
      dependencyKind: project.dependencyKind,
      versions: Object.keys(project.versions).sort((left, right) => compareVersions(right, left)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
