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

The MVP focuses on architecture, API shape, validation, and contribution workflow. Seed data is
explicitly unverified and marked with `confidence: low`.

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
    versions:
      '26':
        dependencies:
          postgresql:
            status: unknown
            ranges: []
            confidence: low
            notes:
              - Placeholder seed data only.
            sources: []
            lastVerified: null
```

Statuses are `compatible`, `incompatible`, or `unknown`. Confidence levels are `low`, `medium`, or
`high`. Non-low confidence must include source evidence.

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
  "compatible": "unknown",
  "project": "keycloak",
  "version": "26",
  "dependency": "postgresql",
  "dependencyVersion": "17",
  "matchedRange": null,
  "confidence": "low",
  "notes": [],
  "sources": []
}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- Envoy Gateway <-> Gateway API
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
