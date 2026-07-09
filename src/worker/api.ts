import { checkCompatibility, checkCompoundCompatibility } from '../lib/engine';
import { listProjects, loadDataset } from '../lib/data';
import type {
  CompatibilityCheckRequest,
  CompoundCompatibilityCheckRequest,
} from '../types/compatibility';

const dataset = loadDataset();
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (request.method !== 'GET' && url.pathname !== '/api/v1/check') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/projects') {
    return json({ projects: listProjects(dataset) });
  }

  const projectMatch = url.pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (request.method === 'GET' && projectMatch) {
    const projectId = projectMatch[1];
    const project = dataset.projects[projectId];

    if (!project) {
      return json({ error: 'Project not found', project: projectId }, 404);
    }

    return json({ id: projectId, ...project });
  }

  if (url.pathname === '/api/v1/check') {
    const validation =
      request.method === 'POST'
        ? await readPostCheckRequest(request)
        : readGetCheckRequest(url.searchParams);

    if ('error' in validation) {
      return json(validation, 400);
    }

    if ('dependencies' in validation) {
      return json(checkCompoundCompatibility(dataset, validation));
    }

    return json(checkCompatibility(dataset, validation));
  }

  return json({ error: 'Not found' }, 404);
}

type CheckRequest =
  | CompatibilityCheckRequest
  | CompoundCompatibilityCheckRequest
  | { error: string; missing?: string[] };

function readGetCheckRequest(params: URLSearchParams): CheckRequest {
  const dependencies = params.get('dependencies');

  if (dependencies) {
    const required = ['project', 'version'] as const;
    const missing = required.filter((key) => !params.get(key));

    if (missing.length > 0) {
      return {
        error: 'Missing required query parameters',
        missing: [...missing],
      };
    }

    const parsedDependencies = parseDependencies(dependencies);

    if (!parsedDependencies) {
      return { error: 'dependencies must be a JSON object of dependency names to versions' };
    }

    return {
      project: params.get('project') ?? '',
      version: params.get('version') ?? '',
      dependencies: parsedDependencies,
    };
  }

  return readSingleCheckRequest(params);
}

function readSingleCheckRequest(
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

async function readPostCheckRequest(request: Request): Promise<CheckRequest> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: 'Request body must be valid JSON' };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;

  if (record.dependencies !== undefined) {
    if (!isStringRecord(record.dependencies)) {
      return { error: 'dependencies must be an object of dependency names to versions' };
    }

    const missing = ['project', 'version'].filter((key) => typeof record[key] !== 'string');

    if (missing.length > 0) {
      return { error: 'Missing required body fields', missing };
    }

    return {
      project: record.project as string,
      version: record.version as string,
      dependencies: record.dependencies,
    };
  }

  const missing = ['project', 'version', 'dependency', 'dependencyVersion'].filter(
    (key) => typeof record[key] !== 'string',
  );

  if (missing.length > 0) {
    return { error: 'Missing required body fields', missing };
  }

  return {
    project: record.project as string,
    version: record.version as string,
    dependency: record.dependency as string,
    dependencyVersion: record.dependencyVersion as string,
  };
}

function parseDependencies(value: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isStringRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders,
    },
  });
}
