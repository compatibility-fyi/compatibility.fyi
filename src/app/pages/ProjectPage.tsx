import { useMemo, useState } from 'react';
import { loadDataset } from '../../lib/data';
import { checkCompoundCompatibility } from '../../lib/engine';
import { compareVersions } from '../../lib/version';
import type {
  CompatibilityCheckResponse,
  DependencyCompatibilityEntry,
} from '../../types/compatibility';
import { Layout } from '../components/Layout';

const dataset = loadDataset();

interface CompatibilityRow {
  version: string;
  dependency: string;
  entry: DependencyCompatibilityEntry;
}

interface ConfidenceTooltip {
  text: string;
  top: number;
  left: number;
}

interface ProjectPageProps {
  projectId: string;
}

export function ProjectPage({ projectId }: ProjectPageProps) {
  const project = dataset.projects[projectId];
  const [query, setQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('all');
  const [checkVersion, setCheckVersion] = useState('');
  const [checkValues, setCheckValues] = useState<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<ConfidenceTooltip | null>(null);
  const rows: CompatibilityRow[] = useMemo(() => {
    if (!project) {
      return [];
    }

    return Object.entries(project.versions)
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
  }, [project]);
  const versions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.version))].sort((left, right) =>
        compareVersions(right, left),
      ),
    [rows],
  );
  const activeCheckVersion = checkVersion || versions[0] || '';
  const checkDependencies = project
    ? Object.entries(project.versions[activeCheckVersion]?.dependencies ?? {})
    : [];
  const populatedCheckValues = Object.fromEntries(
    Object.entries(checkValues).filter(([, value]) => value.trim() !== ''),
  );
  const compoundResult =
    project && Object.keys(populatedCheckValues).length > 0
      ? checkCompoundCompatibility(dataset, {
          project: projectId,
          version: activeCheckVersion,
          dependencies: populatedCheckValues,
        })
      : null;
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesVersion = selectedVersion === 'all' || row.version === selectedVersion;
      const matchesQuery =
        !normalizedQuery ||
        [
          row.dependency,
          row.version,
          row.entry.ranges.join(' '),
          row.entry.notes.join(' '),
          row.entry.sources.map((source) => source.title).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesVersion && matchesQuery;
    });
  }, [query, rows, selectedVersion]);

  const dependencyCount = new Set(rows.map((row) => row.dependency)).size;

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

  return (
    <Layout>
      <section className="page-heading">
        <a className="back-link" href="/">
          &larr; Back to projects
        </a>
        <div className="project-heading">
          <div>
            <h1>{project.name}</h1>
            {project.website ? (
              <a
                className="project-website"
                href={project.website}
                rel="noreferrer"
                target="_blank"
              >
                Website
              </a>
            ) : null}
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

      <section className="compatibility-checker" aria-label="Compatibility checker">
        <div className="section-title-row">
          <h2>Check a combination</h2>
          {compoundResult ? <StatusBadge status={compoundResult.compatible} /> : null}
        </div>
        <div className="checker-grid">
          <label className="select-field">
            <span>Version to check</span>
            <select
              value={activeCheckVersion}
              onChange={(event) => {
                setCheckVersion(event.target.value);
                setCheckValues({});
              }}
            >
              {versions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
          {checkDependencies.map(([dependency, entry]) => (
            <label className="search-field" key={dependency}>
              <span>
                {formatDependencyName(dependency)}
                {entry.relationship ? ` (${entry.relationship})` : ''}
              </span>
              <input
                type="text"
                value={checkValues[dependency] ?? ''}
                onChange={(event) =>
                  setCheckValues((current) => ({
                    ...current,
                    [dependency]: event.target.value,
                  }))
                }
                placeholder={entry.ranges.map(formatRange).join(', ')}
              />
            </label>
          ))}
        </div>
        {compoundResult ? <CompoundResult checks={compoundResult.checks} /> : null}
      </section>

      <section className="table-section">
        <div className="section-title-row">
          <h2>Compatibility matrix</h2>
          <span>{filteredRows.length} entries</span>
        </div>
        <div className="filter-bar" aria-label="Compatibility filters">
          <label className="search-field">
            <span>Search dependencies</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dependencies, ranges, notes, sources..."
            />
          </label>
          <label className="select-field">
            <span>Project version</span>
            <select
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
            >
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
              {filteredRows.map(({ version, dependency, entry }) => (
                <tr key={`${version}-${dependency}`}>
                  <td>{version}</td>
                  <td>
                    <strong>{formatDependencyName(dependency)}</strong>
                    {entry.relationship ? (
                      <small className="relationship-label">{entry.relationship}</small>
                    ) : null}
                  </td>
                  <td>
                    <div className="range-list" aria-label={`Supported versions for ${dependency}`}>
                      {entry.ranges.map((range) => (
                        <span className="range-chip" title={range} key={range}>
                          {formatRange(range)}
                        </span>
                      ))}
                    </div>
                    {entry.notes.length > 0 ? <p className="row-note">{entry.notes[0]}</p> : null}
                  </td>
                  <td>
                    <Evidence
                      entry={entry}
                      onHideTooltip={() => setTooltip(null)}
                      onShowTooltip={setTooltip}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 ? (
          <p className="empty-state">No compatibility entries match those filters.</p>
        ) : null}
      </section>
      {tooltip ? (
        <div
          className="confidence-tooltip"
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </Layout>
  );
}

function CompoundResult({ checks }: { checks: CompatibilityCheckResponse[] }) {
  return (
    <div className="compound-result">
      {checks.map((check) => (
        <div className="compound-result-row" key={check.dependency}>
          <span>
            <strong>{formatDependencyName(check.dependency)}</strong>
            <small>{check.dependencyVersion}</small>
          </span>
          <span className="compound-result-value">
            <span className="compound-result-range">
              {check.matchedRange ? formatRange(check.matchedRange) : 'No matching range'}
            </span>
            <StatusBadge status={check.compatible} />
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: CompatibilityCheckResponse['compatible'] }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

function Evidence({
  entry,
  onHideTooltip,
  onShowTooltip,
}: {
  entry: DependencyCompatibilityEntry;
  onHideTooltip: () => void;
  onShowTooltip: (tooltip: ConfidenceTooltip) => void;
}) {
  const explanation = getConfidenceExplanation(entry.confidence);

  function showTooltip(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const width = 300;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

    onShowTooltip({
      text: explanation,
      top: rect.bottom + 8,
      left,
    });
  }

  return (
    <div className="evidence">
      <div>
        <button
          className="evidence-level"
          type="button"
          aria-label={`${entry.confidence} confidence. ${explanation}`}
          onBlur={onHideTooltip}
          onFocus={(event) => showTooltip(event.currentTarget)}
          onMouseEnter={(event) => showTooltip(event.currentTarget)}
          onMouseLeave={onHideTooltip}
        >
          {entry.confidence}
        </button>
        {entry.lastVerified ? (
          <span>Verified {entry.lastVerified}</span>
        ) : (
          <span>Not verified</span>
        )}
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

function formatDependencyName(dependency: string): string {
  const wordLabels: Record<string, string> = {
    api: 'API',
    aurora: 'Aurora',
    aws: 'AWS',
    azure: 'Azure',
    coredns: 'CoreDNS',
    cni: 'CNI',
    dns: 'DNS',
    eks: 'EKS',
    gcp: 'GCP',
    gke: 'GKE',
    gitlab: 'GitLab',
    ip: 'IP',
    jdbc: 'JDBC',
    kubernetes: 'Kubernetes',
    ldap: 'LDAP',
    mariadb: 'MariaDB',
    mce: 'MCE',
    mssql: 'Microsoft SQL Server',
    mysql: 'MySQL',
    oidc: 'OIDC',
    openshift: 'OpenShift',
    php: 'PHP',
    postgresql: 'PostgreSQL',
    rhacm: 'RHACM',
    sql: 'SQL',
    tls: 'TLS',
  };

  return dependency
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => wordLabels[word.toLowerCase()] ?? formatLabelTitle(word))
    .join(' ');
}

function formatLabelTitle(label: string): string {
  if (label === label.toLowerCase()) {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return label;
}

function formatRange(range: string): string {
  const match = range.match(/^>=(\d+)\.(\d+)\.(\d+) <(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return range;
  }

  const [, lowerMajor, lowerMinor, lowerPatch, upperMajor, upperMinor, upperPatch] =
    match.map(Number);

  if (lowerMinor === 0 && lowerPatch === 0 && upperMajor === lowerMajor + 1) {
    return lowerMajor >= 1000 ? String(lowerMajor) : `${lowerMajor}.x`;
  }

  if (
    lowerPatch === 0 &&
    upperMajor === lowerMajor &&
    upperMinor === lowerMinor + 1 &&
    upperPatch === 0
  ) {
    return `${lowerMajor}.${lowerMinor}.x`;
  }

  if (lowerPatch === 0 && upperMajor === lowerMajor + 1 && upperMinor === 0 && upperPatch === 0) {
    return `${lowerMajor}.${lowerMinor}+`;
  }

  return range;
}
