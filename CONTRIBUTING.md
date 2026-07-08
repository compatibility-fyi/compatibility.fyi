# Contributing

compatibility.fyi is intended to be maintained in the open. Contributions should make compatibility
claims easy to audit and safe for tools to consume.

## Adding a project

1. Add a YAML file under `data/`, for example `data/envoy-gateway.yaml`.
2. Use the project id as the top-level key under `projects`.
3. Add versions and dependencies with ranges, relationship, confidence, notes, sources, and
   `lastVerified`.
4. Run `npm run lint` before opening a pull request.

## Using a coding agent

Project maintainers can use a coding agent to draft a compatibility file. See `AGENTS.md` for the
repo-specific agent instructions and a copy-paste prompt.

Maintainers should still review generated YAML before opening a pull request. In particular, check
that every range is backed by the cited source and that no moving version labels were introduced.

## Adding compatibility entries

Compatibility is implicit when an entry has supported ranges. Use `status: unknown` when there is
not enough evidence, or `status: incompatible` only when a source explicitly documents an
incompatibility.

Ranges should be semver-compatible where possible:

```yaml
ranges:
  - '>=1.0.0 <2.0.0'
```

Ecosystems that cannot be expressed with semver should still use clear strings. The engine is
designed so additional matchers can be added later.

Use `relationship` to explain how the project depends on the target. Common values include
`runtime`, `compiled`, and `bundled`.

## Sources

Prefer primary sources:

- official documentation
- release notes
- support matrices
- upstream tests or CI definitions
- maintainer statements in project-owned issue trackers

Avoid copying unsourced compatibility claims from third-party blog posts.

## Confidence levels

- `low`: placeholder, inferred, incomplete, or not independently verified
- `medium`: supported by a credible source but not fully cross-checked
- `high`: directly supported by primary sources and recently verified

Entries with `medium` or `high` confidence must include sources.

## Verification dates

Use `YYYY-MM-DD` for `lastVerified` and source `accessedAt` dates. Set `lastVerified: null` for
unverified placeholder data.
