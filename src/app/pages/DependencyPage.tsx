import { loadDataset } from '../../lib/data';
import { formatDependencyName } from '../../lib/format';
import {
  getDependencyEntries,
  getDependencyLastVerified,
  getDependencySeoMetadata,
} from '../../lib/seo';
import type { CompatibilitySource } from '../../types/compatibility';
import { Layout } from '../components/Layout';

const dataset = loadDataset();

interface DependencyPageProps {
  projectId: string;
  dependencyId: string;
}

export function DependencyPage({ projectId, dependencyId }: DependencyPageProps) {
  const project = dataset.projects[projectId];
  const entries = project ? getDependencyEntries(project, dependencyId) : [];

  if (!project || entries.length === 0) {
    return (
      <Layout>
        <section className="page-heading">
          <a className="back-link" href={`/projects/${projectId}/`}>
            &larr; Back to project
          </a>
          <h1>Compatibility page not found</h1>
          <p>No compatibility metadata exists for this project and dependency combination.</p>
        </section>
      </Layout>
    );
  }

  const dependencyName = formatDependencyName(dependencyId);
  const metadata = getDependencySeoMetadata(projectId, project, dependencyId);
  const lastVerified = getDependencyLastVerified(project, dependencyId);
  const sources = uniqueSources(entries.flatMap(([, entry]) => entry.sources));

  return (
    <Layout>
      <section className="page-heading dependency-heading">
        <a className="back-link" href={`/projects/${projectId}/`}>
          &larr; Back to {project.name}
        </a>
        <p className="eyebrow">Source-backed version compatibility</p>
        <h1>
          {project.name} {dependencyName} Version Compatibility
        </h1>
        <p>{metadata.description}</p>
        <div className="project-actions">
          <a className="project-action-link" href={`/projects/${projectId}/`}>
            Full {project.name} matrix
          </a>
          <a className="project-action-link" href={`/api/v1/projects/${projectId}`}>
            JSON data
          </a>
        </div>
      </section>

      <section className="dependency-summary" aria-label="Compatibility summary">
        <div>
          <span className="summary-value">{entries.length}</span>
          <span className="summary-label">Project versions</span>
        </div>
        <div>
          <span className="summary-value">
            {entries.reduce((total, [, entry]) => total + entry.ranges.length, 0)}
          </span>
          <span className="summary-label">Documented ranges</span>
        </div>
        <div>
          <span className="summary-date">{lastVerified ?? 'Not verified'}</span>
          <span className="summary-label">Last verified</span>
        </div>
      </section>

      <section className="dependency-answer" aria-labelledby="compatibility-answer-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Quick answer</p>
            <h2 id="compatibility-answer-title">
              {dependencyName} compatibility by {project.name} version
            </h2>
          </div>
        </div>

        <div className="dependency-answer-list">
          {entries.map(([version, entry]) => (
            <article key={version}>
              <div className="dependency-version-heading">
                <span>{project.name} version</span>
                <h3>{version}</h3>
              </div>
              <div>
                <p className="dependency-range-label">
                  {entry.status === 'incompatible'
                    ? `Incompatible ${dependencyName} versions`
                    : `Documented ${dependencyName} versions`}
                </p>
                <div className="range-list">
                  {entry.ranges.map((range) => (
                    <span className="range-chip" key={range}>
                      {range}
                    </span>
                  ))}
                </div>
                {entry.notes.map((note) => (
                  <p className="dependency-answer-note" key={note}>
                    {note}
                  </p>
                ))}
                <p className="dependency-verification">
                  {entry.confidence} confidence
                  {entry.lastVerified ? ` · verified ${entry.lastVerified}` : ''}
                  {entry.relationship ? ` · ${entry.relationship}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dependency-sources" aria-labelledby="dependency-sources-title">
        <div>
          <p className="eyebrow">Primary evidence</p>
          <h2 id="dependency-sources-title">Sources</h2>
          <p>
            Every range above is backed by upstream documentation, tagged source, release notes, or
            another project-owned primary source.
          </p>
        </div>
        <ol>
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noreferrer" target="_blank">
                {source.title}
              </a>
              {source.accessedAt ? <span>Accessed {source.accessedAt}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </Layout>
  );
}

function uniqueSources(sources: CompatibilitySource[]): CompatibilitySource[] {
  return [...new Map(sources.map((source) => [source.url, source])).values()];
}
