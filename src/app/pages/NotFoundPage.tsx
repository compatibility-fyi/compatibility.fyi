import { Layout } from '../components/Layout';

export function NotFoundPage() {
  return (
    <Layout>
      <section className="page-heading">
        <a className="back-link" href="/">
          &larr; Back to projects
        </a>
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The requested compatibility page does not exist.</p>
      </section>
    </Layout>
  );
}
