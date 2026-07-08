import { CodeBlock } from '../components/CodeBlock';
import { Layout } from '../components/Layout';

const checkResponse = `{
  "project": "keycloak",
  "version": "26",
  "dependency": "postgresql",
  "dependencyVersion": "17",
  "compatible": "compatible",
  "matchedRange": ">=14.0.0 <19.0.0",
  "relationship": null,
  "confidence": "high",
  "notes": [
    "Keycloak current 26.x supported configurations list PostgreSQL 18.x, 17.x, 16.x, 15.x, and 14.x."
  ],
  "sources": [
    {
      "title": "Keycloak Supported Configurations - Supported Databases",
      "url": "https://www.keycloak.org/server/supported-configurations",
      "accessedAt": "2026-07-08"
    },
    {
      "title": "Keycloak database configuration guide",
      "url": "https://www.keycloak.org/server/db",
      "accessedAt": "2026-07-08"
    }
  ]
}`;

export function DocsApiPage() {
  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">API</p>
        <h1>HTTP API v1</h1>
        <p>
          The API is intentionally small, cacheable, and shaped for automation clients. Responses
          avoid HTML and return explicit unknown states when evidence is missing.
        </p>
      </section>

      <section className="docs-grid">
        <article>
          <h2>GET /api/v1/projects</h2>
          <p>Returns the known project index.</p>
          <CodeBlock>{`curl https://compatibility.fyi/api/v1/projects`}</CodeBlock>
          <CodeBlock>{`{
  "projects": [
    {
      "id": "keycloak",
      "name": "Keycloak",
      "category": "Authentication",
      "website": "https://www.keycloak.org/",
      "dependencyKind": {
        "singular": "database",
        "plural": "databases",
        "examples": ["PostgreSQL", "MySQL", "Oracle"]
      },
      "versions": ["26", "25"]
    },
    {
      "id": "envoy-gateway",
      "name": "Envoy Gateway",
      "category": "Networking",
      "website": "https://gateway.envoyproxy.io/",
      "dependencyKind": {
        "singular": "dependency",
        "plural": "dependencies",
        "examples": ["Gateway API", "Kubernetes", "Envoy Proxy"]
      },
      "versions": ["1.8", "1.7", "1.6", "1.5", "1.4", "1.3", "1.2", "1.1", "1.0", "0.6", "0.5", "0.4", "0.3", "0.2"]
    }
  ]
}`}</CodeBlock>
        </article>

        <article>
          <h2>GET /api/v1/projects/keycloak</h2>
          <p>Returns the complete compatibility document for a project.</p>
          <CodeBlock>{`curl https://compatibility.fyi/api/v1/projects/keycloak`}</CodeBlock>
        </article>

        <article>
          <h2>GET /api/v1/check</h2>
          <p>
            Checks one project/dependency version pair and returns compatible, incompatible, or
            unknown.
          </p>
          <CodeBlock>
            {`curl "https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17"`}
          </CodeBlock>
          <CodeBlock>{checkResponse}</CodeBlock>
        </article>

        <article>
          <h2>POST /api/v1/check</h2>
          <p>Checks a compound project version combination across multiple dependencies.</p>
          <CodeBlock>{`curl -X POST https://compatibility.fyi/api/v1/check \\
  -H "content-type: application/json" \\
  -d '{
    "project": "envoy-gateway",
    "version": "1.8",
    "dependencies": {
      "gateway-api": "1.5.1",
      "kubernetes": "1.34",
      "envoy-proxy": "distroless-v1.38.0",
      "rate-limit": "fe26676d"
    }
  }'`}</CodeBlock>
          <CodeBlock>{`{
  "project": "envoy-gateway",
  "version": "1.8",
  "dependencies": {
    "gateway-api": "1.5.1",
    "kubernetes": "1.34",
    "envoy-proxy": "distroless-v1.38.0",
    "rate-limit": "fe26676d"
  },
  "compatible": "compatible",
  "checks": [
    {
      "dependency": "gateway-api",
      "dependencyVersion": "1.5.1",
      "compatible": "compatible",
      "matchedRange": "1.5.1",
      "relationship": "compiled"
    }
  ]
}`}</CodeBlock>
        </article>
      </section>
    </Layout>
  );
}
