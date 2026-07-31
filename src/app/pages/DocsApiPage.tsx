import React, { type ReactNode } from 'react';

import { CodeBlock } from '../components/CodeBlock';
import { Layout } from '../components/Layout';

interface Parameter {
  name: string;
  location: string;
  required: string;
  description: string;
}

interface ResponseField {
  name: string;
  description: string;
}

const projectIndexResponse = `{
  "projects": [
    {
      "id": "cloudnativepg",
      "name": "CloudNativePG",
      "categories": ["Databases"],
      "website": "https://cloudnative-pg.io/",
      "versions": ["1.30", "1.29", "1.28"]
    }
  ]
}`;

const projectResponse = `{
  "id": "red-hat-advanced-cluster-management",
  "name": "Red Hat Advanced Cluster Management for Kubernetes",
  "categories": ["Cluster Management"],
  "versions": {
    "2.16": {
      "dependencies": {
        "multicluster-engine": {
          "ranges": ["2.11"],
          "relationship": "bundled"
        },
        "openshift-management-cluster": {
          "ranges": [">=4.19 <4.22"],
          "relationship": "hub runtime"
        }
      }
    }
  }
}`;

const singleCheckResponse = `{
  "project": "keycloak",
  "version": "26",
  "dependency": "postgresql",
  "dependencyVersion": "17",
  "compatible": "compatible",
  "matchedRange": ">=14.0.0 <19.0.0",
  "matchedConstraint": null,
  "relationship": "database",
  "confidence": "high",
  "lastVerified": "2026-07-08",
  "notes": [
    "Keycloak current 26.x supported configurations list PostgreSQL 18.x, 17.x, 16.x, 15.x, and 14.x."
  ],
  "sources": [
    {
      "title": "Keycloak Supported Configurations - Supported Databases",
      "url": "https://www.keycloak.org/server/supported-configurations",
      "accessedAt": "2026-07-08"
    }
  ]
}`;

const compoundCheckResponse = `{
  "project": "red-hat-advanced-cluster-management",
  "version": "2.16",
  "dependencies": {
    "multicluster-engine": "2.11",
    "openshift-management-cluster": "4.21.22",
    "openshift-hosted-cluster": "4.21.22"
  },
  "compatible": "compatible",
  "checks": [
    {
      "dependency": "multicluster-engine",
      "dependencyVersion": "2.11",
      "compatible": "compatible",
      "matchedRange": "2.11",
      "matchedConstraint": null,
      "relationship": "bundled"
    },
    {
      "dependency": "openshift-management-cluster",
      "dependencyVersion": "4.21.22",
      "compatible": "compatible",
      "matchedRange": ">=4.19 <4.22",
      "matchedConstraint": null,
      "relationship": "hub runtime"
    }
  ]
}`;

const endpointRows = [
  ['GET', '/api/v1/projects', 'Discover project ids and high-level metadata.'],
  [
    'GET',
    '/api/v1/projects/{project}',
    'Inspect versions, dependency keys, constraints, and evidence.',
  ],
  ['GET', '/api/v1/check', 'Check one project/dependency version pair.'],
  ['POST', '/api/v1/check', 'Check a full project version combination.'],
];

const singleCheckParameters: Parameter[] = [
  {
    name: 'project',
    location: 'query',
    required: 'yes',
    description: 'Project id from the project index, for example keycloak.',
  },
  {
    name: 'version',
    location: 'query',
    required: 'yes',
    description: 'Project version to evaluate.',
  },
  {
    name: 'dependency',
    location: 'query',
    required: 'yes',
    description: 'Dependency key from the project document.',
  },
  {
    name: 'dependencyVersion',
    location: 'query',
    required: 'yes',
    description: 'Dependency version to test against the documented constraints.',
  },
];

const compoundCheckParameters: Parameter[] = [
  {
    name: 'project',
    location: 'body',
    required: 'yes',
    description: 'Project id from the project index.',
  },
  {
    name: 'version',
    location: 'body',
    required: 'yes',
    description: 'Project version to evaluate.',
  },
  {
    name: 'dependencies',
    location: 'body',
    required: 'yes',
    description: 'JSON object where keys are dependency ids and values are dependency versions.',
  },
];

const responseFields: ResponseField[] = [
  {
    name: 'compatible',
    description: 'Aggregate or single check result: compatible, incompatible, or unknown.',
  },
  {
    name: 'matchedRange',
    description: 'The documented range that matched the requested dependency version, or null.',
  },
  {
    name: 'matchedConstraint',
    description:
      'Set to same-version when the dependency must exactly match the requested project version; otherwise null.',
  },
  {
    name: 'relationship',
    description: 'How the project uses the dependency, such as runtime, bundled, or installer.',
  },
  {
    name: 'confidence',
    description: 'Evidence quality: high, medium, or low.',
  },
  {
    name: 'lastVerified',
    description: 'Date when the compatibility evidence was last verified, or null.',
  },
  {
    name: 'sources',
    description: 'Source documents used to verify the entry.',
  },
];

export function DocsApiPage() {
  return (
    <Layout>
      <section className="page-heading docs-heading">
        <p className="eyebrow">API</p>
        <h1>HTTP API v1</h1>
        <p>
          Query compatibility metadata as JSON. Start with the project index, inspect a project for
          its version and dependency keys, then run single or compound compatibility checks.
        </p>
      </section>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="API sections">
          <strong>API reference</strong>
          <nav>
            <a href="#quickstart">Quickstart</a>
            <a href="#endpoints">Endpoints</a>
            <a href="#projects">Projects</a>
            <a href="#project">Project document</a>
            <a href="#single-check">Single check</a>
            <a href="#compound-check">Combination check</a>
            <a href="#semantics">Result semantics</a>
          </nav>
        </aside>

        <div className="docs-content">
          <section id="quickstart" className="docs-section docs-callout">
            <div>
              <p className="eyebrow">Quickstart</p>
              <h2>Discover, inspect, check</h2>
              <p>
                Dependency keys are project-specific. Use the project document as the source of
                truth before calling the check endpoint.
              </p>
            </div>
            <div className="quickstart-steps">
              <div className="quickstart-step">
                <h3>1. List projects</h3>
                <p>Find the stable project id to use in later requests.</p>
                <CodeBlock copyable>{`curl https://compatibility.fyi/api/v1/projects`}</CodeBlock>
              </div>
              <div className="quickstart-step">
                <h3>2. Inspect one project</h3>
                <p>
                  Read the available versions, dependency keys, constraints, evidence, and sources.
                </p>
                <CodeBlock
                  copyable
                >{`curl https://compatibility.fyi/api/v1/projects/red-hat-advanced-cluster-management`}</CodeBlock>
              </div>
              <div className="quickstart-step">
                <h3>3. Check compatibility</h3>
                <p>Ask whether one dependency version is compatible with one project version.</p>
                <CodeBlock copyable>
                  {`curl "https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17"`}
                </CodeBlock>
              </div>
            </div>
          </section>

          <section id="endpoints" className="docs-section">
            <h2>Endpoints</h2>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {endpointRows.map(([method, path, purpose]) => (
                    <tr key={`${method}-${path}`}>
                      <td data-label="Method">
                        <span className={`method-badge ${method.toLowerCase()}`}>{method}</span>
                      </td>
                      <td data-label="Path">
                        <code>{path}</code>
                      </td>
                      <td data-label="Purpose">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <EndpointSection
            id="projects"
            method="GET"
            path="/api/v1/projects"
            title="List projects"
            description="Returns the public project index. Use this endpoint to discover stable project ids for tools and integrations."
          >
            <CodeBlock copyable>{`curl https://compatibility.fyi/api/v1/projects`}</CodeBlock>
            <CodeBlock>{projectIndexResponse}</CodeBlock>
          </EndpointSection>

          <EndpointSection
            id="project"
            method="GET"
            path="/api/v1/projects/{project}"
            title="Get project compatibility data"
            description="Returns the complete compatibility document for one project, including known versions, dependency keys, constraints, confidence, notes, sources, and verification dates."
          >
            <ParameterTable
              parameters={[
                {
                  name: 'project',
                  location: 'path',
                  required: 'yes',
                  description: 'Project id from /api/v1/projects.',
                },
              ]}
            />
            <CodeBlock
              copyable
            >{`curl https://compatibility.fyi/api/v1/projects/red-hat-advanced-cluster-management`}</CodeBlock>
            <CodeBlock>{projectResponse}</CodeBlock>
          </EndpointSection>

          <EndpointSection
            id="single-check"
            method="GET"
            path="/api/v1/check"
            title="Check one dependency"
            description="Checks one dependency version against one project version. This is the simplest endpoint for Renovate-style compatibility decisions."
          >
            <ParameterTable parameters={singleCheckParameters} />
            <CodeBlock copyable>
              {`curl "https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17"`}
            </CodeBlock>
            <CodeBlock>{singleCheckResponse}</CodeBlock>
          </EndpointSection>

          <EndpointSection
            id="compound-check"
            method="POST"
            path="/api/v1/check"
            title="Check a combination"
            description="Checks a project version against multiple dependencies in one request and returns an aggregate result plus individual checks."
          >
            <ParameterTable parameters={compoundCheckParameters} />
            <CodeBlock copyable>{`curl -X POST https://compatibility.fyi/api/v1/check \\
  -H "content-type: application/json" \\
  -d '{
    "project": "red-hat-advanced-cluster-management",
    "version": "2.16",
    "dependencies": {
      "multicluster-engine": "2.11",
      "openshift-management-cluster": "4.21.22",
      "openshift-hosted-cluster": "4.21.22"
    }
  }'`}</CodeBlock>
            <CodeBlock>{compoundCheckResponse}</CodeBlock>
            <p className="docs-note">
              A GET variant is also accepted by passing a URL-encoded JSON object in the{' '}
              <code>dependencies</code> query parameter. POST is recommended for compound checks
              because it is easier to read and avoids URL length limits.
            </p>
          </EndpointSection>

          <section id="semantics" className="docs-section">
            <h2>Result semantics</h2>
            <div className="docs-definition-grid">
              <div>
                <span className="status-badge compatible">compatible</span>
                <p>The dependency version matched a documented compatible constraint.</p>
              </div>
              <div>
                <span className="status-badge incompatible">incompatible</span>
                <p>
                  The dependency is known for that project version, but the requested version did
                  not match any documented compatible constraint.
                </p>
              </div>
              <div>
                <span className="status-badge unknown">unknown</span>
                <p>The project, project version, dependency, or evidence is not known.</p>
              </div>
            </div>

            <h3>Response fields</h3>
            <ResponseFieldTable fields={responseFields} />

            <h3>Evidence model</h3>
            <p>
              High confidence means the entry is backed by official project documentation or tagged
              upstream source and includes a verification date. Compatibility data can still become
              stale, so clients should expose sources and verification dates where possible.
            </p>

            <h3>Input limits and errors</h3>
            <p>
              Required values must be non-empty strings of at most 128 characters. Compound checks
              accept between 1 and 32 dependency entries. POST bodies must use{' '}
              <code>application/json</code> and are limited to 16 KiB.
            </p>
            <ul>
              <li>
                <code>400</code> — missing, malformed, empty, or out-of-range input.
              </li>
              <li>
                <code>404</code> — unknown API route or project document.
              </li>
              <li>
                <code>405</code> — unsupported HTTP method.
              </li>
              <li>
                <code>413</code> — POST body exceeds 16 KiB.
              </li>
              <li>
                <code>415</code> — POST body is not declared as JSON.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </Layout>
  );
}

interface EndpointSectionProps {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  children: ReactNode;
}

function EndpointSection({ id, method, path, title, description, children }: EndpointSectionProps) {
  return (
    <section id={id} className="docs-section endpoint-section">
      <div className="endpoint-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="endpoint-route">
          <span className={`method-badge ${method.toLowerCase()}`}>{method}</span>
          <code>{path}</code>
        </div>
      </div>
      {children}
    </section>
  );
}

function ParameterTable({ parameters }: { parameters: Parameter[] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>In</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr key={`${parameter.location}-${parameter.name}`}>
              <td data-label="Name">
                <code>{parameter.name}</code>
              </td>
              <td data-label="In">{parameter.location}</td>
              <td data-label="Required">{parameter.required}</td>
              <td data-label="Description">{parameter.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponseFieldTable({ fields }: { fields: ResponseField[] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name}>
              <td data-label="Field">
                <code>{field.name}</code>
              </td>
              <td data-label="Description">{field.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
