# Agent Instructions

This repository maintains source-backed compatibility metadata for software projects. Agents should
optimize for small, reviewable data changes that are safe for automation tools to consume.

## Project Rules

- Add or update YAML files under `data/`.
- Prefer YAML-only changes when adding a new project.
- Do not change application code unless the data cannot be represented by the current schema.
- Do not invent compatibility information.
- Use primary sources only: official documentation, support matrices, release notes, tagged source
  files, upstream tests, or maintainer statements in project-owned trackers.
- Do not use moving version labels such as `latest`, `stable`, `main`, `master`, `nightly`, `dev`,
  `edge`, or `current`.
- Do not include unreleased, development, or preview versions unless the source explicitly documents
  them as supported production compatibility targets.
- Prefer several recent supported project versions instead of only one version when sources make
  that possible.
- If a source distinguishes general support from platform-specific support, model the
  platform-specific entry separately.

## Data Rules

- Compatibility is implicit when an entry has supported ranges. Do not write `status: compatible`.
- Use `status: incompatible` only when a primary source explicitly documents an incompatibility.
- Use `status: unknown` only when the project intentionally documents an unknown or unverified state.
- Use semver-style ranges where possible, for example `>=1.30 <1.34`.
- Use exact strings only when the dependency is not semver-like, for example a commit SHA or named
  runtime.
- Include `confidence`, `notes`, `sources`, and `lastVerified` for every entry.
- Set `confidence: high` only when the entry is backed by primary sources and includes a
  verification date.
- Every `medium` or `high` confidence entry must include at least one source with `title`, `url`,
  and `accessedAt`.

## Validation

Run these checks before finishing a data change:

```sh
npm run validate:data -- data/*.yaml
npm run lint
```

For code or schema changes, also run:

```sh
npm run typecheck
npm run test
npm run build
```

## Maintainer Prompt

Maintainers can copy this prompt into a coding agent and replace the placeholders:

```text
Add compatibility metadata for <project name> to compatibility.fyi.

Project:
- Name: <project name>
- Website: <project website>
- Suggested project id: <lowercase-dash-id>
- Categories: <categories>

Goal:
- Create or update only data/<lowercase-dash-id>.yaml unless a schema gap makes code changes
  unavoidable.
- Model the compatibility data that maintainers and automation tools would need to answer whether a
  project version works with a dependency version.

Research rules:
- Use primary sources only: official documentation, support matrices, release notes, tagged source
  files, upstream tests, or maintainer statements in project-owned trackers.
- Do not invent compatibility information.
- Do not use moving version labels such as latest, stable, main, master, nightly, dev, edge, or
  current.
- Do not include unreleased, development, or preview versions unless the source explicitly documents
  them as supported production compatibility targets.
- Prefer several recent supported project versions instead of only one version when the sources make
  that possible.
- If the source distinguishes general support from platform-specific support, model the
  platform-specific entry separately.

Data rules:
- Compatibility is implicit when an entry has supported ranges. Do not write status: compatible.
- Use status: incompatible only when a primary source explicitly documents an incompatibility.
- Use status: unknown only when the project intentionally documents an unknown or unverified state.
- Use semver-style ranges where possible, for example ">=1.30 <1.34".
- Use exact strings only when the dependency is not semver-like, for example a commit SHA or named
  runtime.
- Include confidence, notes, sources, and lastVerified for every entry.
- Set confidence: high only when the entry is backed by primary sources and includes a verification
  date.
- Every medium or high confidence entry must include at least one source with title, url, and
  accessedAt.

Workflow:
1. Inspect the existing data/*.yaml files and follow their style.
2. Find the official sources and summarize what each source proves.
3. Propose the compatibility model before editing if the project has multiple dependency axes.
4. Create or update data/<lowercase-dash-id>.yaml.
5. Run:
   npm run validate:data -- data/*.yaml
   npm run lint
6. Report the sources used, any assumptions, and any compatibility areas intentionally left out.
```
