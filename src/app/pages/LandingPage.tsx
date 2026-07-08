import { Layout } from '../components/Layout';

const examples = [
  'Is Keycloak 26 compatible with PostgreSQL 17?',
  'Which Gateway API version is supported by Envoy Gateway 1.8?',
  'Is this Renovate update actually compatible?',
];

export function LandingPage() {
  return (
    <Layout>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Open compatibility metadata</p>
          <h1>compatibility.fyi</h1>
          <p className="lede">
            Machine-readable software compatibility metadata for projects, versions, and the
            dependencies they need to work together.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/docs/api">
              Read the API docs
            </a>
            <a className="button secondary" href="/projects">
              Browse projects
            </a>
          </div>
        </div>
        <div className="hero-product">
          <img
            className="hero-logo"
            src="/compatibility-fyi-logo.png"
            alt="compatibility.fyi logo"
          />
        </div>
      </section>

      <section className="section-grid">
        <div>
          <h2>Compatibility data should be queryable.</h2>
          <p>
            Lifecycle metadata has endoflife.date. Compatibility data is still scattered through
            release notes, support matrices, Helm charts, GitHub issues, and tribal knowledge.
            compatibility.fyi is a small open-source attempt to make that metadata explicit.
          </p>
        </div>
        <div className="examples">
          {examples.map((example) => (
            <div className="example" key={example}>
              {example}
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <h2>Built for maintainers and automation.</h2>
        <p>
          The MVP ships a typed YAML format, validation, official Keycloak database compatibility
          data, a small compatibility engine, and a Worker API that tools such as Renovate,
          Dependabot, Helm, Argo CD, and Backstage could consume.
        </p>
      </section>
    </Layout>
  );
}
