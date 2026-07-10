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

## Publishing Pull Requests

When asked to publish a contribution, determine the GitHub repository topology before creating the
pull request. Do not assume that `origin` is the upstream repository.

1. Verify that GitHub CLI is installed and authenticated:

   ```sh
   gh --version
   gh auth status
   ```

   The agent must run `gh auth status` in its own execution environment. If an authenticated HTTPS
   push cannot obtain credentials, run `gh auth setup-git` and retry once.

2. Inspect all remotes and identify the repository attached to each URL:

   ```sh
   git remote -v
   gh repo view <origin-owner>/<repository> --json nameWithOwner,isFork,parent,defaultBranchRef
   ```

   Always pass the repository name explicitly to `gh repo view`. With both `origin` and `upstream`
   configured, implicit repository detection can select the wrong remote.

3. If `origin` is a fork, push the contribution branch to `origin`, then open a cross-repository PR
   against the parent repository:

   ```sh
   git push -u origin <branch>
   gh pr create \
     --repo <parent-owner>/<repository> \
     --base <parent-default-branch> \
     --head <fork-owner>:<branch>
   ```

   Do not open a PR against the contributor's fork unless the user explicitly requests it.

4. If `origin` is not a fork, open the PR against `origin` and its default branch.

5. Verify the created PR in the target repository:

   ```sh
   gh pr view <number> \
     --repo <target-owner>/<repository> \
     --json url,state,isDraft,baseRefName,headRefName,headRepositoryOwner
   ```

   Confirm that the base repository and branch belong to upstream and that the head repository and
   branch belong to the contributor's fork.

Do not delete the fork's remote contribution branch while an upstream PR is open. After the
upstream PR is merged or closed, cleanup may include closing an accidentally created fork-local PR,
synchronizing the fork's default branch, deleting the remote contribution branch, deleting the
local contribution branch, and leaving the checkout clean on the default branch.

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
