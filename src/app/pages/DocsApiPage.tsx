import { CodeBlock } from '../components/CodeBlock';
import { Layout } from '../components/Layout';

const checkResponse = `{
  "compatible": "unknown",
  "project": "keycloak",
  "version": "26",
  "dependency": "postgresql",
  "dependencyVersion": "17",
  "matchedRange": null,
  "confidence": "low",
  "notes": [],
  "sources": []
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
      "description": "Placeholder compatibility metadata for the Keycloak project.",
      "versions": ["26", "25"]
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
      </section>
    </Layout>
  );
}
