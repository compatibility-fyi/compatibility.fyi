import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

type LinkStatus = 'ok' | 'warn' | 'fail';

interface LinkReference {
  file: string;
  path: string;
}

interface LinkResult {
  url: string;
  status: LinkStatus;
  message: string;
  references: LinkReference[];
}

interface Source {
  url?: string;
}

interface DependencyEntry {
  sources?: Source[];
}

interface VersionData {
  dependencies?: Record<string, DependencyEntry>;
}

interface Project {
  website?: string;
  versions?: Record<string, VersionData>;
}

interface Dataset {
  projects?: Record<string, Project>;
}

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface LinkCheckOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  concurrency?: number;
}

const defaults = {
  timeoutMs: 15_000,
  maxAttempts: 3,
  retryDelayMs: 1_000,
  concurrency: 8,
};
const warnStatuses = new Set([401, 403, 429]);

export async function main(): Promise<void> {
  const links = await collectLinks('data');
  const results = await checkLinks([...links.entries()]);
  const failures = results.filter((result) => result.status === 'fail');

  for (const result of results) {
    console.log(`${result.status} ${result.url} - ${result.message}`);
    if (result.status !== 'ok') {
      for (const reference of result.references) {
        console.log(`  ${reference.file}: ${reference.path}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} broken YAML link${failures.length === 1 ? '' : 's'} found`);
  }

  console.log(`checked ${results.length} unique YAML links`);
}

async function collectLinks(directory: string): Promise<Map<string, LinkReference[]>> {
  const links = new Map<string, LinkReference[]>();

  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.yaml')).sort()) {
    const dataset = parse(await readFile(join(directory, file), 'utf8')) as Dataset;

    for (const [projectId, project] of Object.entries(dataset.projects ?? {})) {
      if (project.website) {
        addLink(links, project.website, { file, path: `projects.${projectId}.website` });
      }

      for (const [version, versionData] of Object.entries(project.versions ?? {})) {
        for (const [dependency, entry] of Object.entries(versionData.dependencies ?? {})) {
          for (const [sourceIndex, source] of (entry.sources ?? []).entries()) {
            if (source.url) {
              addLink(links, source.url, {
                file,
                path: `projects.${projectId}.versions.${version}.dependencies.${dependency}.sources.${sourceIndex}.url`,
              });
            }
          }
        }
      }
    }
  }

  return links;
}

function addLink(links: Map<string, LinkReference[]>, url: string, reference: LinkReference): void {
  const references = links.get(url) ?? [];
  references.push(reference);
  links.set(url, references);
}

async function checkLinks(
  entries: [string, LinkReference[]][],
  fetchImpl: Fetch = fetch,
  options: LinkCheckOptions = {},
): Promise<LinkResult[]> {
  const results: LinkResult[] = [];
  const concurrency = options.concurrency ?? defaults.concurrency;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < entries.length) {
      const [url, references] = entries[nextIndex++];
      results.push(await checkLink(url, references, fetchImpl, options));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.sort((left, right) => left.url.localeCompare(right.url));
}

export async function checkLink(
  url: string,
  references: LinkReference[],
  fetchImpl: Fetch = fetch,
  options: LinkCheckOptions = {},
): Promise<LinkResult> {
  const timeoutMs = options.timeoutMs ?? defaults.timeoutMs;
  const maxAttempts = options.maxAttempts ?? defaults.maxAttempts;
  const retryDelayMs = options.retryDelayMs ?? defaults.retryDelayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchLink(url, fetchImpl, timeoutMs);
      const result = classifyResponse(url, response.status, references);

      if (
        result.status !== 'fail' ||
        !isRetryableStatus(response.status) ||
        attempt === maxAttempts
      ) {
        if (attempt > 1) {
          result.message += ` after ${attempt} attempts`;
        }
        return result;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      await delay(retryDelayMs * 2 ** (attempt - 1));
    }
  }

  return {
    url,
    status: 'fail',
    message: `${formatError(lastError)} after ${maxAttempts} attempts`,
    references,
  };
}

async function fetchLink(url: string, fetchImpl: Fetch, timeoutMs: number): Promise<Response> {
  try {
    const head = await fetchWithTimeout(url, 'HEAD', fetchImpl, timeoutMs);
    if (!shouldRetryWithGet(head.status)) {
      return head;
    }
  } catch {
    // Some sites do not support HEAD or intermittently reset it. GET is authoritative.
  }

  return fetchWithTimeout(url, 'GET', fetchImpl, timeoutMs);
}

async function fetchWithTimeout(
  url: string,
  method: 'HEAD' | 'GET',
  fetchImpl: Fetch,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'compatibility.fyi link checker (+https://compatibility.fyi)',
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryWithGet(statusCode: number): boolean {
  return statusCode === 405 || statusCode === 406 || statusCode === 501 || statusCode >= 500;
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 425 || statusCode >= 500;
}

function classifyResponse(
  url: string,
  statusCode: number,
  references: LinkReference[],
): LinkResult {
  if (statusCode >= 200 && statusCode < 400) {
    return { url, status: 'ok', message: `HTTP ${statusCode}`, references };
  }

  if (warnStatuses.has(statusCode)) {
    return {
      url,
      status: 'warn',
      message: `HTTP ${statusCode}; protected or rate-limited link was not treated as broken`,
      references,
    };
  }

  return { url, status: 'fail', message: `HTTP ${statusCode}`, references };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await main();
}
