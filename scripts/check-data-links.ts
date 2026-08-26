import { lookup } from 'node:dns/promises';
import { readFile, readdir } from 'node:fs/promises';
import { BlockList, isIP } from 'node:net';
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
  maxRedirects?: number;
  resolveHostname?: ResolveHostname;
}

interface ResolvedAddress {
  address: string;
  family: number;
}

export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

const defaults = {
  timeoutMs: 15_000,
  maxAttempts: 3,
  retryDelayMs: 1_000,
  concurrency: 8,
  maxRedirects: 5,
};
const warnStatuses = new Set([401, 403, 429]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const blockedHostnames = new Set(['localhost', 'localhost.localdomain']);
const blockedHostnameSuffixes = [
  '.home.arpa',
  '.internal',
  '.invalid',
  '.local',
  '.localhost',
  '.test',
];
const blockedAddresses = createBlockedAddressLists();

class UnsafeLinkError extends Error {}

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
      const response = await fetchLink(url, fetchImpl, timeoutMs, options);
      const result = classifyResponse(url, response.status, references);

      if (result.status !== 'fail' || !isRetryableStatus(response.status)) {
        if (attempt > 1) {
          result.message += ` after ${attempt} attempts`;
        }
        return result;
      }

      if (attempt === maxAttempts) {
        return {
          url,
          status: 'warn',
          message: `HTTP ${response.status} after ${attempt} attempts; temporary server failure was not treated as broken`,
          references,
        };
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (error instanceof UnsafeLinkError) {
        return {
          url,
          status: 'fail',
          message: formatError(error),
          references,
        };
      }
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

async function fetchLink(
  url: string,
  fetchImpl: Fetch,
  timeoutMs: number,
  options: LinkCheckOptions,
): Promise<Response> {
  try {
    const head = await fetchWithTimeout(url, 'HEAD', fetchImpl, timeoutMs, options);
    if (!shouldRetryWithGet(head.status)) {
      return head;
    }
  } catch (error) {
    if (error instanceof UnsafeLinkError) {
      throw error;
    }
    // Some sites do not support HEAD or intermittently reset it. GET is authoritative.
  }

  return fetchWithTimeout(url, 'GET', fetchImpl, timeoutMs, options);
}

async function fetchWithTimeout(
  url: string,
  method: 'HEAD' | 'GET',
  fetchImpl: Fetch,
  timeoutMs: number,
  options: LinkCheckOptions = {},
): Promise<Response> {
  const resolveHostname = options.resolveHostname ?? resolvePublicHostname;
  const maxRedirects = options.maxRedirects ?? defaults.maxRedirects;
  let currentUrl = new URL(url);
  const visitedUrls = new Set<string>();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (visitedUrls.has(currentUrl.href)) {
      throw new UnsafeLinkError(`Redirect loop detected at ${currentUrl.href}`);
    }
    visitedUrls.add(currentUrl.href);

    await assertSafeLinkTarget(currentUrl, resolveHostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await fetchImpl(currentUrl, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'compatibility.fyi link checker (+https://compatibility.fyi)',
          accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!redirectStatuses.has(response.status)) {
      return response;
    }

    const location = response.headers.get('Location');
    if (!location) {
      return response;
    }
    if (redirectCount === maxRedirects) {
      throw new UnsafeLinkError(`Too many redirects; maximum is ${maxRedirects}`);
    }

    await response.body?.cancel();
    currentUrl = new URL(location, currentUrl);
  }

  throw new UnsafeLinkError(`Too many redirects; maximum is ${maxRedirects}`);
}

async function assertSafeLinkTarget(url: URL, resolveHostname: ResolveHostname): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeLinkError('Only HTTP and HTTPS links are allowed');
  }
  if (url.username || url.password) {
    throw new UnsafeLinkError('Links must not include credentials');
  }
  if (url.port) {
    throw new UnsafeLinkError('Links must use the standard HTTP or HTTPS port');
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (
    blockedHostnames.has(hostname) ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new UnsafeLinkError(`Blocked non-public hostname: ${hostname}`);
  }

  const addressFamily = isIP(hostname);
  const addresses = addressFamily
    ? [{ address: hostname, family: addressFamily }]
    : await resolveHostname(hostname);
  if (addresses.length === 0) {
    throw new Error(`Hostname did not resolve: ${hostname}`);
  }

  for (const address of addresses) {
    const family = address.family === 6 ? 'ipv6' : 'ipv4';
    if (blockedAddresses[family].check(address.address, family)) {
      throw new UnsafeLinkError(`Blocked non-public address for ${hostname}: ${address.address}`);
    }
  }
}

async function resolvePublicHostname(hostname: string): Promise<ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function createBlockedAddressLists(): Record<'ipv4' | 'ipv6', BlockList> {
  const ipv4 = new BlockList();
  const ipv6 = new BlockList();
  for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ] as const) {
    ipv4.addSubnet(network, prefix, 'ipv4');
  }
  for (const [network, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['::ffff:0:0', 96],
    ['100::', 64],
    ['2001:db8::', 32],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
  ] as const) {
    ipv6.addSubnet(network, prefix, 'ipv6');
  }
  return { ipv4, ipv6 };
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
