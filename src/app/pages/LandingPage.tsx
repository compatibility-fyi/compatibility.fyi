import React from 'react';

import { listProjects } from '../../lib/catalog';
import type { CompatibilityDataset, ProjectSummary } from '../../types/compatibility';
import { Layout } from '../components/Layout';

interface CatalogProject extends ProjectSummary {
  categories: string[];
}

export function LandingPage({ dataset }: { dataset: CompatibilityDataset }) {
  const projects: CatalogProject[] = listProjects(dataset).map((project) => ({
    ...project,
    categories: project.categories.length > 0 ? project.categories : ['Uncategorized'],
  }));
  const counts = new Map<string, number>();

  for (const project of projects) {
    for (const category of project.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const categories = [
    { count: projects.length, name: 'All' },
    ...[...counts.entries()]
      .map(([name, count]) => ({ count, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];

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

      <section className="catalog-layout" data-catalog>
        <div className="catalog-search" aria-label="Project search">
          <label className="sr-only" htmlFor="project-search">
            Search projects
          </label>
          <input
            data-catalog-search
            id="project-search"
            type="search"
            placeholder="Search projects..."
          />
        </div>

        <aside className="catalog-sidebar" aria-label="Categories">
          <h2>Categories</h2>
          <nav>
            {categories.map((category) => (
              <button
                className={category.name === 'All' ? 'active' : undefined}
                data-catalog-category={category.name}
                key={category.name}
                type="button"
              >
                <span>{category.name}</span>
                <span>{category.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="catalog-results" data-catalog-results>
          <div className="catalog-results-heading">
            <h2 data-catalog-heading>All projects</h2>
            <span data-catalog-count>{projects.length} projects</span>
          </div>

          <div
            className="catalog-table"
            data-catalog-table
            role="table"
            aria-label="Compatibility projects"
          >
            <div className="catalog-row catalog-row-header" role="row">
              <span role="columnheader">Project</span>
              <span role="columnheader">Known versions</span>
            </div>
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
          <p className="empty-state" data-catalog-empty hidden>
            No projects match that search.
          </p>
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
  const searchText = [
    project.id,
    project.name,
    project.categories.join(' '),
    project.description,
    project.versions.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return (
    <a
      className="catalog-row"
      data-catalog-project
      data-categories={project.categories.join('|')}
      data-search={searchText}
      href={`/projects/${project.id}/`}
      role="row"
    >
      <span role="cell">
        <span className="catalog-project">
          <strong>{project.name}</strong>
          <span className="catalog-category-badges" aria-label="Categories">
            {project.categories.map((category) => (
              <small key={category}>{category}</small>
            ))}
          </span>
        </span>
      </span>
      <span role="cell">
        {project.versions.length} {project.versions.length === 1 ? 'version' : 'versions'}
      </span>
    </a>
  );
}
