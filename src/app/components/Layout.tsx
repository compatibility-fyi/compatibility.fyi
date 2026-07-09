import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          <img alt="" aria-hidden="true" src="/icon-192.png" />
          compatibility.fyi
        </a>
        <nav aria-label="Primary">
          <a href="/docs/api/">API</a>
          <a href="https://github.com/compatibility-fyi/compatibility.fyi">GitHub</a>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
