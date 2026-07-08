import { loadDataset } from '../../lib/data';
import type { DependencyCompatibilityEntry } from '../../types/compatibility';
import { Layout } from '../components/Layout';

const project = loadDataset().projects.keycloak;

export function ProjectPage() {
  const rows = Object.entries(project.versions).flatMap(([version, versionData]) =>
    Object.entries(versionData.dependencies).map(([dependency, entry]) => ({
      version,
      dependency,
      entry,
    })),
  );

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Project</p>
        <h1>Keycloak</h1>
        <p>{project.description}</p>
      </section>

      <section className="warning">
        <strong>Unverified seed data.</strong> The entries on this page are placeholders for the MVP
        architecture and must not be used as real compatibility claims.
      </section>

      <section className="table-section">
        <h2>Compatibility table</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project version</th>
                <th>Dependency</th>
                <th>Status</th>
                <th>Ranges</th>
                <th>Confidence</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ version, dependency, entry }) => (
                <tr key={`${version}-${dependency}`}>
                  <td>{version}</td>
                  <td>{dependency}</td>
                  <td>
                    <StatusBadge entry={entry} />
                  </td>
                  <td>
                    {entry.ranges.length > 0 ? entry.ranges.join(', ') : 'No verified ranges'}
                  </td>
                  <td>{entry.confidence}</td>
                  <td>{entry.sources.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}

function StatusBadge({ entry }: { entry: DependencyCompatibilityEntry }) {
  return <span className={`badge ${entry.status}`}>{entry.status}</span>;
}
