import { checkCompatibility } from '../lib/engine';
import { listProjects, loadDataset } from '../lib/data';
import type { CompatibilityCheckRequest } from '../types/compatibility';

const dataset = loadDataset();

export function handleApiRequest(request: Request): Response {
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (url.pathname === '/api/v1/projects') {
    return json({ projects: listProjects(dataset) });
  }

  const projectMatch = url.pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const project = dataset.projects[projectId];

    if (!project) {
      return json({ error: 'Project not found', project: projectId }, 404);
    }

    return json({ id: projectId, ...project });
  }

  if (url.pathname === '/api/v1/check') {
    const validation = readCheckRequest(url.searchParams);

    if ('error' in validation) {
      return json(validation, 400);
    }

    return json(checkCompatibility(dataset, validation));
  }

  return json({ error: 'Not found' }, 404);
}

function readCheckRequest(
  params: URLSearchParams,
): CompatibilityCheckRequest | { error: string; missing: string[] } {
  const required = ['project', 'version', 'dependency', 'dependencyVersion'] as const;
  const missing = required.filter((key) => !params.get(key));

  if (missing.length > 0) {
    return {
      error: 'Missing required query parameters',
      missing: [...missing],
    };
  }

  return {
    project: params.get('project') ?? '',
    version: params.get('version') ?? '',
    dependency: params.get('dependency') ?? '',
    dependencyVersion: params.get('dependencyVersion') ?? '',
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
