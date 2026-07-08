import { useMemo, useState } from 'react';
import { listProjects, loadDataset } from '../../lib/data';
import { Layout } from '../components/Layout';
import { formatWebsiteUrl } from '../lib/format';

const projects = listProjects(loadDataset());

export function ProjectsPage() {
  const [query, setQuery] = useState('');
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      [project.id, project.name, project.website ?? '', project.versions.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Projects</p>
        <h1>Compatibility metadata</h1>
        <p>Browse source-backed compatibility data by project.</p>
      </section>

      <section className="filter-bar project-filter-bar" aria-label="Project filters">
        <label className="search-field">
          <span>Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by project or version"
          />
        </label>
      </section>

      <section className="project-list" aria-label="Projects">
        {filteredProjects.map((project) => (
          <article className="project-list-item" key={project.id}>
            <div className="project-list-title">
              {project.logo ? <img src={project.logo} alt="" aria-hidden="true" /> : null}
              <div>
                <h2>
                  <a href={`/projects/${project.id}`}>{project.name}</a>
                </h2>
                {project.website ? (
                  <a
                    className="project-list-website"
                    href={project.website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {formatWebsiteUrl(project.website)}
                  </a>
                ) : null}
              </div>
            </div>
            <div className="project-meta">
              <span>{project.versions.length} versions</span>
              <span>{project.versions.join(', ')}</span>
            </div>
          </article>
        ))}
        {filteredProjects.length === 0 ? (
          <p className="empty-state">No projects match that search.</p>
        ) : null}
      </section>
    </Layout>
  );
}
