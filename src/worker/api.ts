import { checkCompatibility, checkCompoundCompatibility } from '../lib/engine';
import { listProjects } from '../lib/catalog';
import { loadDataset } from '../lib/data';
import type {
  CompatibilityCheckRequest,
  CompoundCompatibilityCheckRequest,
} from '../types/compatibility';

const dataset = loadDataset();
const maxPostBodyBytes = 16 * 1024;
const maxFieldLength = 128;
const maxDependencies = 32;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy':
    'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex',
};

export async function handleApiRequest(request: Request): Promise<Response> {
  try {
    return await routeApiRequest(request);
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        message: 'Unhandled API error',
        method: request.method,
        path: new URL(request.url).pathname,
      }),
    );
    return json({ error: 'Internal server error' }, 500, false);
  }
}

async function routeApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, false);
  }

  if (request.method !== 'GET' && url.pathname !== '/api/v1/check') {
    return json({ error: 'Method not allowed' }, 405, false);
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/projects') {
    return json({ projects: listProjects(dataset) });
  }

  const projectMatch = url.pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (request.method === 'GET' && projectMatch) {
    const projectId = projectMatch[1];
    const project = dataset.projects[projectId];

    if (!project) {
      return json({ error: 'Project not found', project: projectId }, 404, false);
    }

    return json({ id: projectId, ...project });
  }

  if (url.pathname === '/api/v1/check') {
    const validation =
      request.method === 'POST'
        ? await readPostCheckRequest(request)
        : readGetCheckRequest(url.searchParams);

    if ('error' in validation) {
      const { status = 400, ...body } = validation;
      return json(body, status, false);
    }

    if ('dependencies' in validation) {
      return json(checkCompoundCompatibility(dataset, validation), 200, request.method === 'GET');
    }

    return json(checkCompatibility(dataset, validation), 200, request.method === 'GET');
  }

  return json({ error: 'Not found' }, 404, false);
}

type CheckRequest =
  CompatibilityCheckRequest | CompoundCompatibilityCheckRequest | ApiValidationError;

interface ApiValidationError {
  error: string;
  invalid?: string[];
  missing?: string[];
  status?: number;
}

function readGetCheckRequest(params: URLSearchParams): CheckRequest {
  const dependencies = params.get('dependencies');

  if (dependencies) {
    const fields = readRequiredQueryStrings(params, ['project', 'version']);
    if ('error' in fields) {
      return fields;
    }
    if (dependencies.length > maxPostBodyBytes) {
      return { error: `dependencies must be at most ${maxPostBodyBytes} characters` };
    }

    const parsedDependencies = parseDependencies(dependencies);
    if ('error' in parsedDependencies) {
      return parsedDependencies;
    }

    return {
      project: fields.project,
      version: fields.version,
      dependencies: parsedDependencies.dependencies,
    };
  }

  return readSingleCheckRequest(params);
}

function readSingleCheckRequest(
  params: URLSearchParams,
): CompatibilityCheckRequest | ApiValidationError {
  const fields = readRequiredQueryStrings(params, [
    'project',
    'version',
    'dependency',
    'dependencyVersion',
  ]);
  if ('error' in fields) {
    return fields;
  }
  if (!identifierPattern.test(fields.project) || !identifierPattern.test(fields.dependency)) {
    return { error: 'project and dependency must use lowercase-dash identifiers' };
  }

  return {
    project: fields.project,
    version: fields.version,
    dependency: fields.dependency,
    dependencyVersion: fields.dependencyVersion,
  };
}

async function readPostCheckRequest(request: Request): Promise<CheckRequest> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return { error: 'Content-Type must be application/json', status: 415 };
  }

  const parsedBody = await readJsonBody(request);
  if ('error' in parsedBody) {
    return parsedBody;
  }
  const body = parsedBody.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;

  if (record.dependencies !== undefined) {
    const fields = readRequiredBodyStrings(record, ['project', 'version']);
    if ('error' in fields) {
      return fields;
    }
    if (!identifierPattern.test(fields.project)) {
      return { error: 'project must use a lowercase-dash identifier' };
    }
    const dependencies = validateDependencies(record.dependencies);
    if ('error' in dependencies) {
      return dependencies;
    }

    return {
      project: fields.project,
      version: fields.version,
      dependencies: dependencies.dependencies,
    };
  }

  const fields = readRequiredBodyStrings(record, [
    'project',
    'version',
    'dependency',
    'dependencyVersion',
  ]);
  if ('error' in fields) {
    return fields;
  }
  if (!identifierPattern.test(fields.project) || !identifierPattern.test(fields.dependency)) {
    return { error: 'project and dependency must use lowercase-dash identifiers' };
  }

  return {
    project: fields.project,
    version: fields.version,
    dependency: fields.dependency,
    dependencyVersion: fields.dependencyVersion,
  };
}

async function readJsonBody(request: Request): Promise<{ body: unknown } | ApiValidationError> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && Number(contentLength) > maxPostBodyBytes) {
    return { error: `Request body must be at most ${maxPostBodyBytes} bytes`, status: 413 };
  }
  if (!request.body) {
    return { error: 'Request body must be valid JSON' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxPostBodyBytes) {
      await reader.cancel();
      return { error: `Request body must be at most ${maxPostBodyBytes} bytes`, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      body: JSON.parse(
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
      ) as unknown,
    };
  } catch {
    return { error: 'Request body must be valid JSON' };
  }
}

function parseDependencies(
  value: string,
): { dependencies: Record<string, string> } | ApiValidationError {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return { error: 'dependencies must be a JSON object of dependency names to versions' };
  }
  return validateDependencies(parsed);
}

function validateDependencies(
  value: unknown,
): { dependencies: Record<string, string> } | ApiValidationError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'dependencies must be an object of dependency names to versions' };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return { error: 'dependencies must include at least one dependency' };
  }
  if (entries.length > maxDependencies) {
    return { error: `dependencies must include at most ${maxDependencies} dependencies` };
  }

  const dependencies: Record<string, string> = {};
  for (const [dependency, version] of entries) {
    if (!identifierPattern.test(dependency) || dependency.length > maxFieldLength) {
      return { error: 'dependency names must use lowercase-dash identifiers' };
    }
    if (typeof version !== 'string' || version.trim() === '') {
      return { error: 'dependency versions must be non-empty strings' };
    }
    if (version.trim().length > maxFieldLength) {
      return { error: `dependency versions must be at most ${maxFieldLength} characters` };
    }
    dependencies[dependency] = version.trim();
  }

  return { dependencies };
}

function readRequiredQueryStrings<const Keys extends readonly string[]>(
  params: URLSearchParams,
  keys: Keys,
): { [Key in Keys[number]]: string } | ApiValidationError {
  const values = Object.fromEntries(
    keys.map((key) => [key, params.get(key)?.trim() ?? '']),
  ) as Record<string, string>;
  const missing = keys.filter((key) => values[key] === '');
  if (missing.length > 0) {
    return { error: 'Missing required query parameters', missing: [...missing] };
  }
  const tooLong = keys.filter((key) => values[key].length > maxFieldLength);
  if (tooLong.length > 0) {
    return {
      error: `Query parameters must be at most ${maxFieldLength} characters`,
      invalid: [...tooLong],
    };
  }
  return values as { [Key in Keys[number]]: string };
}

function readRequiredBodyStrings<const Keys extends readonly string[]>(
  record: Record<string, unknown>,
  keys: Keys,
): { [Key in Keys[number]]: string } | ApiValidationError {
  const missing = keys.filter(
    (key) => typeof record[key] !== 'string' || (record[key] as string).trim() === '',
  );
  if (missing.length > 0) {
    return { error: 'Missing required body fields', missing: [...missing] };
  }
  const values = Object.fromEntries(
    keys.map((key) => [key, (record[key] as string).trim()]),
  ) as Record<string, string>;
  const tooLong = keys.filter((key) => values[key].length > maxFieldLength);
  if (tooLong.length > 0) {
    return {
      error: `Body fields must be at most ${maxFieldLength} characters`,
      invalid: [...tooLong],
    };
  }
  return values as { [Key in Keys[number]]: string };
}

function json(body: unknown, status = 200, cacheable = true): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheable ? 'public, max-age=60' : 'no-store',
      ...corsHeaders,
      ...securityHeaders,
    },
  });
}
