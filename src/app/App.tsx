import { DocsApiPage } from './pages/DocsApiPage';
import { LandingPage } from './pages/LandingPage';
import { ProjectPage } from './pages/ProjectPage';

export function App() {
  const path = window.location.pathname;
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);

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
