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

const projectsResponse = `{
  "projects": [
    {
      "id": "example-project",
      "name": "Example Project",
      "category": "Example Category",
      "website": "https://example.com/",
      "dependencyKind": {
        "singular": "dependency",
        "plural": "dependencies",
        "examples": ["Kubernetes", "PostgreSQL"]
      },
      "versions": ["2.0", "1.0"]
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
          <CodeBlock>{projectsResponse}</CodeBlock>
        </article>

        <article>
          <h2>GET /api/v1/projects/:project</h2>
          <p>Returns the complete compatibility document for a project.</p>
          <CodeBlock>{`curl https://compatibility.fyi/api/v1/projects/example-project`}</CodeBlock>
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
