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

Compatibility entries are source-backed constraints for a project version and dependency. Prefer
the broadest release line directly supported by the upstream evidence, such as `1.12` for all
`1.12.x` patches. Keep exact patches for exact bundles, tested-version lists, and patch-gated
compatibility.

```yaml
projects:
  keycloak:
    name: Keycloak
    categories:
      - Authentication
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

Compatibility is implicit when an entry has supported ranges or `sameVersion: true`. Use
`status: incompatible` or `status: unknown` only when a source explicitly documents that state.

When upstream requires the dependency to have exactly the same version as the project, use an empty
range list with `sameVersion: true`:

```yaml
ranges: []
sameVersion: true
```

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

## License

MIT
