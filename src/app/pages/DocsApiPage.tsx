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
      "id": "cloudnativepg",
      "name": "CloudNativePG",
      "category": "Databases",
      "website": "https://cloudnative-pg.io/",
      "dependencyKind": {
        "singular": "dependency",
        "plural": "dependencies",
        "examples": ["PostgreSQL", "Kubernetes"]
      },
      "versions": ["1.30", "1.29", "1.28", "1.27", "1.26"]
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
    "project": "cloudnativepg",
    "version": "1.30",
    "dependencies": {
      "postgresql": "18",
      "kubernetes": "1.36"
    }
  }'`}</CodeBlock>
          <CodeBlock>{`{
  "project": "cloudnativepg",
  "version": "1.30",
  "dependencies": {
    "postgresql": "18",
    "kubernetes": "1.36"
  },
  "compatible": "compatible",
  "checks": [
    {
      "dependency": "postgresql",
      "dependencyVersion": "18",
      "compatible": "compatible",
      "matchedRange": ">=14.0.0 <19.0.0",
      "relationship": "operand"
    }
  ]
}`}</CodeBlock>
        </article>
      </section>
    </Layout>
  );
}
