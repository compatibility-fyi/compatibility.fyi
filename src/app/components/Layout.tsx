import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          compatibility.fyi
        </a>
        <nav aria-label="Primary">
          <a href="/projects/keycloak">Projects</a>
          <a href="/docs/api">API</a>
          <a href="https://github.com/rxbn/compatibility.fyi">GitHub</a>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
