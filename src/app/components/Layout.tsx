import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          <img src="/compatibility-fyi-logo.png" alt="" aria-hidden="true" />
          compatibility.fyi
        </a>
        <nav aria-label="Primary">
          <a href="/projects/keycloak">Projects</a>
          <a href="/docs/api">API</a>
          <a href="https://github.com/compatibility-fyi/compatibility.fyi">GitHub</a>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
