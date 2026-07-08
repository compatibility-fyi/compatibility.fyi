import { listProjects, loadDataset } from '../../lib/data';
import { Layout } from '../components/Layout';

const projects = listProjects(loadDataset());

export function ProjectsPage() {
  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Projects</p>
        <h1>Compatibility metadata</h1>
        <p>Browse source-backed compatibility data by project.</p>
      </section>

      <section className="project-list" aria-label="Projects">
        {projects.map((project) => (
          <a className="project-list-item" href={`/projects/${project.id}`} key={project.id}>
            <div>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
            </div>
            <div className="project-meta">
              <span>{project.versions.length} versions</span>
              <span>{project.versions.join(', ')}</span>
            </div>
          </a>
        ))}
      </section>
    </Layout>
  );
}
