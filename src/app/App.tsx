import { DocsApiPage } from './pages/DocsApiPage';
import { LandingPage } from './pages/LandingPage';
import { ProjectPage } from './pages/ProjectPage';
import { loadDataset } from '../lib/data';
import { getSeoMetadata } from '../lib/seo';
import { usePageSeo } from './seo';

const dataset = loadDataset();

export function App({ path = window.location.pathname }: { path?: string }) {
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  const seo = getSeoMetadata(path, dataset);

  usePageSeo(seo);

  if (path === '/docs/api') {
    return <DocsApiPage />;
  }

  if (path === '/projects') {
    return <LandingPage />;
  }

  if (projectMatch) {
    return <ProjectPage projectId={projectMatch[1]} />;
  }

  return <LandingPage />;
}
