import { useMemo, useRef, useState } from 'react';
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
  const resultsRef = useRef<HTMLDivElement>(null);

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

    return projects
      .filter((project) => {
        const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [
            project.id,
            project.name,
            project.category,
            project.description,
            project.versions.join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCategory && matchesQuery;
      })
      .sort(compareCatalogProjects);
  }, [query, selectedCategory]);

  function selectCategory(category: string) {
    setSelectedCategory(category);

    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

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

      <section className="catalog-layout">
        <div className="catalog-search" aria-label="Project search">
          <label className="sr-only" htmlFor="project-search">
            Search projects
          </label>
          <input
            id="project-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects..."
          />
        </div>

        <aside className="catalog-sidebar" aria-label="Categories">
          <h2>Categories</h2>
          <nav>
            {categories.map((category) => (
              <button
                className={category.name === selectedCategory ? 'active' : undefined}
                key={category.name}
                type="button"
                onClick={() => selectCategory(category.name)}
              >
                <span>{category.name}</span>
                <span>{category.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div ref={resultsRef} className="catalog-results">
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
          <h2>Structured Compatibility Data</h2>
          <p>
            Compatibility evidence is often buried in release notes, support tables, issue trackers,
            and source trees. compatibility.fyi turns source-backed compatibility claims into
            versioned YAML and JSON that can be reviewed, diffed, validated, and queried.
          </p>
        </article>
        <article>
          <h2>Built For Humans And Automation</h2>
          <p>
            The catalog is readable in the browser, but the real goal is automation. Renovate,
            Dependabot, Helm, Argo CD, Backstage, and CI pipelines should be able to check whether a
            dependency update is compatible before it reaches production.
          </p>
        </article>
        <article>
          <h2>Maintained By The Community</h2>
          <p>
            The catalog only works if project maintainers and users contribute compatibility
            matrices backed by primary sources. Add a YAML file, cite the upstream evidence, and
            open a pull request so the data can be reviewed and kept current.
          </p>
          <div className="catalog-links" aria-label="Contribution links">
            <a href="https://github.com/compatibility-fyi/compatibility.fyi/blob/master/CONTRIBUTING.md">
              Contributing guide
            </a>
            <a href="https://github.com/compatibility-fyi/compatibility.fyi/blob/master/AGENTS.md">
              Agent prompt
            </a>
            <a href="https://github.com/compatibility-fyi/compatibility.fyi">GitHub repository</a>
          </div>
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

function compareCatalogProjects(left: CatalogProject, right: CatalogProject): number {
  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
    left.id.localeCompare(right.id)
  );
}
