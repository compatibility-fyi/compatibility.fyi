# compatibility.fyi

Open, source-backed software compatibility metadata.

compatibility.fyi helps answer whether software versions are known to work together. It collects
compatibility evidence from official documentation, support matrices, release notes, and upstream
sources into a small YAML-backed catalog with a searchable website and JSON API.

The goal is to become for compatibility data what [endoflife.date](https://endoflife.date/) is for
lifecycle data: open, structured, community-maintained, easy to browse, and useful for automation.

## Why

Compatibility information is usually scattered across release notes, Helm charts, support matrices,
CI jobs, source trees, and vendor docs. That makes practical questions hard to answer:

- Is Keycloak 26 compatible with PostgreSQL 17?
- Which Gateway API version is supported by Envoy Gateway 1.8?
- Which OpenShift hosted cluster versions work with a given Red Hat ACM release?
- Is this Renovate, Dependabot, Helm, or GitOps update actually compatible?

compatibility.fyi turns those claims into versioned metadata that people can inspect and tools can
query.

## Current Coverage

The catalog currently includes compatibility data for:

- Argo CD
- Calico
- cert-manager
- Cilium
- CloudNativePG
- CoreDNS
- Crossplane
- Envoy Gateway
- External Secrets Operator
- Flux
- GitLab Runner
- Grafana
- Harbor
- Helm
- Istio
- Keycloak
- Kubernetes Version Skew
- Loki
- Longhorn
- Nextcloud
- Prometheus Operator
- Red Hat Advanced Cluster Management for Kubernetes
- Rook Ceph

## Project Shape

- Compatibility data is stored as YAML files in `data/`.
- Each project should usually have one YAML file.
- Data is validated in CI before it can be merged.
- The website and API are deployed with Cloudflare Workers and Static Assets.
- There is no database and no traditional backend server.

## API

The API is documented at [compatibility.fyi/docs/api](https://compatibility.fyi/docs/api).

Start there for endpoint details, request examples, response semantics, confidence levels, and
source evidence fields.

## Local Development

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

## Data Format

Compatibility entries are source-backed ranges for a project version and dependency.

```yaml
projects:
  keycloak:
    name: Keycloak
    category: Authentication
    website: https://www.keycloak.org/
    versions:
      '26':
        dependencies:
          postgresql:
            ranges:
              - '>=14.0.0 <19.0.0'
            relationship: database
            confidence: high
            notes:
              - Keycloak current 26.x supported configurations list PostgreSQL 18.x, 17.x, 16.x, 15.x, and 14.x.
            sources:
              - title: Keycloak Supported Configurations - Supported Databases
                url: https://www.keycloak.org/server/supported-configurations
                accessedAt: '2026-07-08'
            lastVerified: '2026-07-08'
```

Compatibility is implicit when an entry has supported ranges. Use `status: incompatible` or
`status: unknown` only when a source explicitly documents that state.

Confidence levels:

- `low`: incomplete, inferred, or not fully verified
- `medium`: supported by credible evidence
- `high`: backed by primary sources and a verification date

Validate data with:

```sh
npm run validate:data -- data/*.yaml
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

Project maintainers can also use [AGENTS.md](AGENTS.md) as a copy-paste prompt for coding agents
that draft new YAML compatibility files.

## Deployment

The project deploys to Cloudflare Workers with Static Assets:

```sh
npm run deploy
```

## Roadmap

Near-term data additions:

- Backstage
- Grafana Mimir and Tempo
- KEDA
- Knative
- vSphere CSI, if a complete reliable public compatibility matrix can be found

Compatibility domains to expand:

- PostgreSQL client compatibility
- Java runtime compatibility
- GitHub Action compatibility
- Terraform providers
- Tool integrations for Renovate, Dependabot, Helm, Argo CD, and Backstage

## License

MIT
