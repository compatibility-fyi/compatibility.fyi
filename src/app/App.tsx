import { DocsApiPage } from './pages/DocsApiPage';
import { LandingPage } from './pages/LandingPage';
import { ProjectPage } from './pages/ProjectPage';

export function App() {
  const path = window.location.pathname;

  if (path === '/docs/api') {
    return <DocsApiPage />;
  }

  if (path === '/projects/keycloak') {
    return <ProjectPage />;
  }

  return <LandingPage />;
}
