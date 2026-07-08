import { useMemo, useState } from 'react';
import { listProjects, loadDataset } from '../../lib/data';
import type { ProjectSummary } from '../../types/compatibility';
import { Layout } from '../components/Layout';

const projects = listProjects(loadDataset()).map((project) => ({
  ...project,
  category: project.category ?? 'Uncategorized',
}));

interface CatalogProject extends ProjectSummary {
  category: string;
}

export function LandingPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.category, (counts.get(project.category) ?? 0) + 1);
    }

    return [
      { count: projects.length, name: 'All' },
      ...[...counts.entries()]
        .map(([name, count]) => ({ count, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ];
  }, []);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [
          project.id,
          project.name,
          project.category,
          project.description,
          project.dependencyKind?.singular,
          project.dependencyKind?.plural,
          project.dependencyKind?.examples?.join(' '),
          project.versions.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  return (
    <Layout>
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <h1 id="catalog-title">compatibility.fyi</h1>
        <p>
          Compatibility information is scattered across support matrices, release notes, source
          trees, and upgrade guides. compatibility.fyi collects that evidence in one open catalog so
          humans and automation can answer whether two software versions are known to work together.
        </p>
      </section>

      <section className="catalog-search" aria-label="Project search">
        <label htmlFor="project-search">Search compatibility metadata</label>
        <input
          id="project-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Keycloak, CloudNativePG, Gateway API..."
        />
      </section>

      <section className="catalog-layout">
        <aside className="catalog-sidebar" aria-label="Categories">
          <h2>Categories</h2>
          <nav>
            {categories.map((category) => (
              <button
                className={category.name === selectedCategory ? 'active' : undefined}
                key={category.name}
                type="button"
                onClick={() => setSelectedCategory(category.name)}
              >
                <span>{category.name}</span>
                <span>{category.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="catalog-results">
          <div className="catalog-results-heading">
            <h2>{selectedCategory === 'All' ? 'All projects' : selectedCategory}</h2>
            <span>
              {visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          {visibleProjects.length > 0 ? (
            <div className="catalog-table" role="table" aria-label="Compatibility projects">
              <div className="catalog-row catalog-row-header" role="row">
                <span role="columnheader">Project</span>
                <span role="columnheader">Known versions</span>
              </div>
              {visibleProjects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No projects match that search.</p>
          )}
        </div>
      </section>

      <section className="catalog-notes">
        <article>
          <h2>API-first metadata</h2>
          <p>
            The data lives in YAML, is validated in CI, and is served through a small API for tools
            like Renovate, Dependabot, Helm, Argo CD, and Backstage.
          </p>
        </article>
        <article>
          <h2>Compatibility, not lifecycle</h2>
          <p>
            Lifecycle databases answer whether a version is maintained. compatibility.fyi answers
            whether two pieces of software are known to work together.
          </p>
        </article>
      </section>
    </Layout>
  );
}

function ProjectRow({ project }: { project: CatalogProject }) {
  return (
    <a className="catalog-row" href={`/projects/${project.id}`} role="row">
      <span role="cell">
        <span className="catalog-project">
          <span>
            <strong>{project.name}</strong>
            <small>{project.category}</small>
          </span>
        </span>
      </span>
      <span role="cell">{project.versions.length} versions</span>
    </a>
  );
}
