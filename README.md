# compatibility.fyi

Machine-readable software compatibility metadata.

compatibility.fyi aims to become for software compatibility what endoflife.date is for lifecycle
data: an open, structured, community-maintained source that humans and automation can query.

## Motivation

Compatibility metadata is usually hidden across release notes, support matrices, GitHub issues,
container images, Helm chart defaults, and vendor documentation. That makes simple questions hard:

- Is Keycloak 26 compatible with PostgreSQL 17?
- Which database versions are supported by Keycloak 25?
- Which Gateway API version is supported by Envoy Gateway 1.8?
- Is this Renovate update actually compatible?

The MVP focuses on architecture, API shape, validation, and contribution workflow. It currently
includes source-backed Keycloak database compatibility data, Envoy Gateway multi-axis
compatibility data, CloudNativePG Kubernetes and PostgreSQL operand compatibility data, Argo CD
tested Kubernetes compatibility data, Flux Kubernetes compatibility data, cert-manager runtime
compatibility data, Cilium Kubernetes compatibility data, Helm Kubernetes version-skew data, and
Calico tested Kubernetes compatibility data.

## Local development

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run build
npm run preview
npm run test
npm run lint
```

## Deployment

The project deploys as a Cloudflare Worker with Static Assets. There is no traditional backend
server and no database.

```sh
npm run deploy
```

## Data format

Compatibility data lives in YAML files under `data/`. Each project should eventually have its own
file.

```yaml
projects:
  keycloak:
    name: Keycloak
    category: Authentication
    versions:
      '26':
        dependencies:
          postgresql:
            status: compatible
            ranges:
              - '>=14.0.0 <19.0.0'
            relationship: runtime
            confidence: high
            notes:
              - Keycloak current 26.x supported configurations list PostgreSQL 18.x, 17.x, 16.x, 15.x, and 14.x.
            sources:
              - title: Keycloak Supported Configurations - Supported Databases
                url: https://www.keycloak.org/server/supported-configurations
                accessedAt: '2026-07-08'
            lastVerified: '2026-07-08'
```

Statuses are `compatible`, `incompatible`, or `unknown`. Confidence levels are `low`, `medium`, or
`high`. Non-low confidence must include source evidence. `relationship` describes how the project
uses the dependency, for example `runtime`, `compiled`, or `bundled`.

Validate data with:

```sh
npm run validate:data -- data/*.yaml
```

## API

### `GET /api/v1/projects`

Returns project summaries.

### `GET /api/v1/projects/:project`

Returns full compatibility data for a project.

### `GET /api/v1/check`

Checks a single project/dependency pair.

```sh
curl "https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17"
```

```json
{
  "project": "keycloak",
  "version": "26",
  "dependency": "postgresql",
  "dependencyVersion": "17",
  "compatible": "compatible",
  "matchedRange": ">=14.0.0 <19.0.0",
  "relationship": null,
  "confidence": "high",
  "notes": [
    "Keycloak current 26.x supported configurations list PostgreSQL 18.x, 17.x, 16.x, 15.x, and 14.x."
  ],
  "sources": [
    {
      "title": "Keycloak Supported Configurations - Supported Databases",
      "url": "https://www.keycloak.org/server/supported-configurations",
      "accessedAt": "2026-07-08"
    }
  ]
}
```

### `POST /api/v1/check`

Checks a compound project version combination across multiple dependencies.

```sh
curl -X POST https://compatibility.fyi/api/v1/check \
  -H "content-type: application/json" \
  -d '{
    "project": "envoy-gateway",
    "version": "1.8",
    "dependencies": {
      "gateway-api": "1.5.1",
      "kubernetes": "1.34",
      "envoy-proxy": "distroless-v1.38.0",
      "rate-limit": "fe26676d"
    }
  }'
```

The response includes one check per dependency and an aggregate `compatible` value.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- Kubernetes version skew
- Istio
- Argo CD
- cert-manager
- Crossplane
- PostgreSQL client compatibility
- Java runtime compatibility
- GitHub Action compatibility
- Terraform providers
- Tool integrations for Renovate, Dependabot, Helm, Argo CD, and Backstage

## License

MIT
