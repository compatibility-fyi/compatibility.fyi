import React from 'react';

import { formatCompatibilityConstraints, formatDependencyName } from '../../lib/format';
import { compareVersions } from '../../lib/version';
import type { CompatibilityDataset, DependencyCompatibilityEntry } from '../../types/compatibility';
import { Layout } from '../components/Layout';

const githubRepositoryUrl = 'https://github.com/compatibility-fyi/compatibility.fyi';

interface CompatibilityRow {
  version: string;
  dependency: string;
  entry: DependencyCompatibilityEntry;
}

interface ProjectPageProps {
  dataset: CompatibilityDataset;
  projectId: string;
}

export function ProjectPage({ dataset, projectId }: ProjectPageProps) {
  const project = dataset.projects[projectId];

  if (!project) {
    return (
      <Layout>
        <section className="page-heading">
          <a className="back-link" href="/">
            &larr; Back to projects
          </a>
          <h1>Project not found</h1>
          <p>No compatibility metadata exists for {projectId}.</p>
        </section>
      </Layout>
    );
  }

  const rows: CompatibilityRow[] = Object.entries(project.versions)
    .flatMap(([version, versionData]) =>
      Object.entries(versionData.dependencies).map(([dependency, entry]) => ({
        version,
        dependency,
        entry,
      })),
    )
    .sort((left, right) => {
      const versionOrder = compareVersions(right.version, left.version);
      return versionOrder || left.dependency.localeCompare(right.dependency);
    });
  const versions = [...new Set(rows.map((row) => row.version))].sort((left, right) =>
    compareVersions(right, left),
  );
  const activeCheckVersion = versions[0] ?? '';
  const checkDependencies = Object.entries(
    project.versions[activeCheckVersion]?.dependencies ?? {},
  );
  const dependencyCount = new Set(rows.map((row) => row.dependency)).size;
  const dependencyGuides = [...new Set(rows.map((row) => row.dependency))]
    .map((dependency) => ({
      dependency,
      versions: new Set(
        rows.filter((row) => row.dependency === dependency).map((row) => row.version),
      ).size,
    }))
    .sort((left, right) =>
      formatDependencyName(left.dependency).localeCompare(formatDependencyName(right.dependency)),
    );
  const sourceUrl = `${githubRepositoryUrl}/blob/master/data/${projectId}.yaml`;

  return (
    <Layout>
      <section className="page-heading">
        <a className="back-link" href="/">
          &larr; Back to projects
        </a>
        <div className="project-heading">
          <div>
            <h1>{project.name}</h1>
            <div className="project-actions">
              {project.website ? (
                <a
                  className="project-action-link"
                  href={project.website}
                  rel="noreferrer"
                  target="_blank"
                >
                  Website
                </a>
              ) : null}
              <a className="project-action-link" href={sourceUrl} rel="noreferrer" target="_blank">
                View source
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="project-summary" aria-label={`${project.name} compatibility summary`}>
        <div>
          <span className="summary-value">{versions.length}</span>
          <span className="summary-label">Project versions</span>
        </div>
        <div>
          <span className="summary-value">{dependencyCount}</span>
          <span className="summary-label">Dependencies</span>
        </div>
        <div>
          <span className="summary-value">{rows.length}</span>
          <span className="summary-label">Compatibility entries</span>
        </div>
      </section>

      <section className="dependency-index" aria-labelledby="dependency-guides-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Compatibility guides</p>
            <h2 id="dependency-guides-title">Browse by dependency</h2>
          </div>
          <span>{dependencyGuides.length} guides</span>
        </div>
        <div className="dependency-index-grid">
          {dependencyGuides.map(({ dependency, versions: guideVersions }) => (
            <a href={`/projects/${projectId}/${dependency}/`} key={dependency}>
              <strong>
                {project.name} {formatDependencyName(dependency)} compatibility
              </strong>
              <span>
                {guideVersions} {guideVersions === 1 ? 'project version' : 'project versions'}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section
        className="compatibility-checker"
        aria-label="Compatibility checker"
        data-project-checker
        data-project-id={projectId}
      >
        <div className="section-title-row">
          <h2>Check a combination</h2>
          <span className="status-badge" data-check-status hidden />
        </div>
        <div className="checker-grid" data-check-fields>
          <label className="select-field">
            <span>Version to check</span>
            <select data-check-version defaultValue={activeCheckVersion}>
              {versions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
          {checkDependencies.some(([, entry]) => entry.sameVersion) ? (
            <label className="search-field">
              <span>Exact project version</span>
              <input
                data-check-exact-project-version
                type="text"
                placeholder={`e.g. ${activeCheckVersion}.1`}
              />
            </label>
          ) : null}
          {checkDependencies.map(([dependency, entry]) => (
            <CheckerDependencyField dependency={dependency} entry={entry} key={dependency} />
          ))}
        </div>
        <div className="compound-result" data-check-result hidden />
      </section>

      <section className="table-section" data-project-matrix>
        <div className="section-title-row">
          <h2>Compatibility matrix</h2>
          <span data-matrix-count>{rows.length} entries</span>
        </div>
        <div className="filter-bar" aria-label="Compatibility filters">
          <label className="search-field">
            <span>Search dependencies</span>
            <input
              data-matrix-search
              type="search"
              placeholder="Search dependencies, constraints, notes, sources..."
            />
          </label>
          <label className="select-field">
            <span>Project version</span>
            <select data-matrix-version defaultValue="all">
              <option value="all">All versions</option>
              {versions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{project.name}</th>
                <th>Dependency</th>
                <th>Supported versions</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ version, dependency, entry }) => (
                <tr
                  data-matrix-row
                  data-search={matrixSearchText(version, dependency, entry)}
                  data-version={version}
                  key={`${version}-${dependency}`}
                >
                  <td data-label="Version">
                    <span>{version}</span>
                  </td>
                  <td data-label="Dependency">
                    <strong>
                      <a className="dependency-link" href={`/projects/${projectId}/${dependency}/`}>
                        {formatDependencyName(dependency)}
                      </a>
                    </strong>
                    {entry.relationship ? (
                      <small className="relationship-label">{entry.relationship}</small>
                    ) : null}
                  </td>
                  <td data-label="Supported versions">
                    <div className="range-list" aria-label={`Supported versions for ${dependency}`}>
                      {formatCompatibilityConstraints(entry).map((constraint) => (
                        <span className="range-chip" title={constraint} key={constraint}>
                          {constraint}
                        </span>
                      ))}
                    </div>
                    {entry.notes.length > 0 ? <p className="row-note">{entry.notes[0]}</p> : null}
                  </td>
                  <td data-label="Evidence">
                    <Evidence entry={entry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="empty-state" data-matrix-empty hidden>
          No compatibility entries match those filters.
        </p>
      </section>
      <div className="confidence-tooltip" data-confidence-tooltip hidden role="tooltip" />
    </Layout>
  );
}

function CheckerDependencyField({
  dependency,
  entry,
}: {
  dependency: string;
  entry: DependencyCompatibilityEntry;
}) {
  return (
    <label className="search-field" data-check-field={dependency}>
      <span>
        {formatDependencyName(dependency)}
        {entry.relationship ? ` (${entry.relationship})` : ''}
      </span>
      <input
        data-check-dependency={dependency}
        type="text"
        placeholder={formatCompatibilityConstraints(entry).join(', ')}
      />
    </label>
  );
}

function Evidence({ entry }: { entry: DependencyCompatibilityEntry }) {
  const explanation = getConfidenceExplanation(entry.confidence);

  return (
    <div className="evidence">
      <div>
        <button
          className="evidence-level"
          data-confidence-explanation={explanation}
          type="button"
          aria-expanded="false"
          aria-label={`${entry.confidence} confidence. ${explanation}`}
        >
          {entry.confidence}
        </button>
        <span>{entry.lastVerified ? `Verified ${entry.lastVerified}` : 'Not verified'}</span>
      </div>
      <ul>
        {entry.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} rel="noreferrer" target="_blank">
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getConfidenceExplanation(confidence: DependencyCompatibilityEntry['confidence']): string {
  if (confidence === 'high') {
    return 'High confidence means this entry is backed by official documentation or tagged upstream source and includes a verification date.';
  }

  if (confidence === 'medium') {
    return 'Medium confidence means this entry is backed by a credible source but still needs stronger verification.';
  }

  return 'Low confidence means this entry is incomplete, inferred, or not independently verified.';
}

function matrixSearchText(
  version: string,
  dependency: string,
  entry: DependencyCompatibilityEntry,
): string {
  return [
    dependency,
    version,
    formatCompatibilityConstraints(entry).join(' '),
    entry.notes.join(' '),
    entry.sources.map((source) => source.title).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}
