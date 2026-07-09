import { DocsApiPage } from './pages/DocsApiPage';
import { LandingPage } from './pages/LandingPage';
import { ProjectPage } from './pages/ProjectPage';
import { loadDataset } from '../lib/data';
import { getSeoMetadata } from '../lib/seo';
import { usePageSeo } from './seo';

const dataset = loadDataset();

export function App({ path = window.location.pathname }: { path?: string }) {
  const normalizedPath = normalizePath(path);
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)$/);
  const seo = getSeoMetadata(path, dataset);

  usePageSeo(seo);

  if (normalizedPath === '/docs/api') {
    return <DocsApiPage />;
  }

  if (normalizedPath === '/projects') {
    return <LandingPage />;
  }

  if (projectMatch) {
    return <ProjectPage projectId={projectMatch[1]} />;
  }

  return <LandingPage />;
}

function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}
