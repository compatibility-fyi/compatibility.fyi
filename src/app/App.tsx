import { DocsApiPage } from './pages/DocsApiPage';
import { DependencyPage } from './pages/DependencyPage';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectPage } from './pages/ProjectPage';
import { loadDataset } from '../lib/data';
import { getSeoMetadata, normalizePath } from '../lib/seo';
import { usePageSeo } from './seo';

const dataset = loadDataset();

export function App({ path = window.location.pathname }: { path?: string }) {
  const normalizedPath = normalizePath(path);
  const dependencyMatch = normalizedPath.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)$/);
  const seo = getSeoMetadata(path, dataset);

  usePageSeo(seo);

  if (normalizedPath === '/docs/api') {
    return <DocsApiPage />;
  }

  if (normalizedPath === '/' || normalizedPath === '/projects') {
    return <LandingPage />;
  }

  if (dependencyMatch) {
    return (
      <DependencyPage
        dependencyId={decodeURIComponent(dependencyMatch[2])}
        projectId={decodeURIComponent(dependencyMatch[1])}
      />
    );
  }

  if (projectMatch) {
    return <ProjectPage projectId={decodeURIComponent(projectMatch[1])} />;
  }

  return <NotFoundPage />;
}
