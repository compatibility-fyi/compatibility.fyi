import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type {
  CompatibilityDataset,
  DependencyCompatibilityEntry,
  ProjectCompatibility,
} from '../src/types/compatibility';
import { parseCompatibilityYaml } from '../src/lib/validation';
import {
  absoluteUrl,
  getProjectSeoMetadata,
  getSeoMetadata,
  siteName,
  siteUrl,
  type SeoMetadata,
} from '../src/lib/seo';
import { compareVersions } from '../src/lib/version';

const distClient = resolve('dist/client');
const dataDirectory = resolve('data');

const dataset = await loadDataset();
const template = await readFile(join(distClient, 'index.html'), 'utf8');
const projects = Object.entries(dataset.projects).sort(([, left], [, right]) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
);

const routes = [
  {
    path: '/',
    metadata: getSeoMetadata('/', dataset),
    html: renderHome(),
    jsonLd: renderWebsiteJsonLd(),
  },
  {
    path: '/projects',
    metadata: getSeoMetadata('/', dataset),
    html: renderHome(),
    jsonLd: renderWebsiteJsonLd(),
  },
  {
    path: '/docs/api/',
    metadata: getSeoMetadata('/docs/api', dataset),
    html: renderApiDocs(),
    jsonLd: renderApiJsonLd(),
  },
  ...projects.map(([projectId, project]) => ({
    path: `/projects/${projectId}/`,
    metadata: getProjectSeoMetadata(projectId, project),
    html: renderProject(projectId, project),
    jsonLd: renderProjectJsonLd(projectId, project),
  })),
];

for (const route of routes) {
  await writeRoute(route.path, renderDocument(route.metadata, route.html, route.jsonLd));
}

await writeSitemap();
await writeRobots();

console.log(`generated SEO assets for ${routes.length} routes`);

async function loadDataset(): Promise<CompatibilityDataset> {
  const files = (await readdir(dataDirectory))
    .filter((file) => file.endsWith('.yaml'))
    .sort((left, right) => left.localeCompare(right));

  const sources = await Promise.all(
    files.map(async (file) =>
      parseCompatibilityYaml(await readFile(join(dataDirectory, file), 'utf8')),
    ),
  );

  return sources.reduce<CompatibilityDataset>(
    (current, source) => ({
      projects: {
        ...current.projects,
        ...source.projects,
      },
    }),
    { projects: {} },
  );
}

function renderDocument(metadata: SeoMetadata, staticHtml: string, jsonLd: unknown): string {
  const head = renderHead(metadata, jsonLd);
  const snapshot = `<div id="seo-snapshot" aria-hidden="true">${staticHtml}</div>`;

  return template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s, '')
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/s, '')
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s, '')
    .replace(
      /<meta\s+(?:property|name)="(?:og|twitter):[^"]+"\s+content="[^"]*"\s*\/?>\n?\s*/gs,
      '',
    )
    .replace('</head>', `${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>${snapshot}`);
}

function renderHead(metadata: SeoMetadata, jsonLd: unknown): string {
  const canonical = absoluteUrl(metadata.canonicalPath);
  const escapedTitle = escapeHtml(metadata.title);
  const escapedDescription = escapeHtml(metadata.description);

  return [
    '    <style id="seo-snapshot-style">#seo-snapshot{display:none!important}</style>',
    `    <meta name="description" content="${escapedDescription}" />`,
    '    <meta name="robots" content="index,follow" />',
    `    <link rel="canonical" href="${canonical}" />`,
    `    <meta property="og:site_name" content="${siteName}" />`,
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:title" content="${escapedTitle}" />`,
    `    <meta property="og:description" content="${escapedDescription}" />`,
    `    <meta property="og:url" content="${canonical}" />`,
    `    <meta property="og:image" content="${absoluteUrl('/icon-512.png')}" />`,
    '    <meta name="twitter:card" content="summary" />',
    `    <meta name="twitter:title" content="${escapedTitle}" />`,
    `    <meta name="twitter:description" content="${escapedDescription}" />`,
    `    <meta name="twitter:image" content="${absoluteUrl('/icon-512.png')}" />`,
    `    <script type="application/ld+json">${escapeScriptJson(JSON.stringify(jsonLd))}</script>`,
  ].join('\n');
}

async function writeRoute(path: string, html: string) {
  const filePath =
    path === '/' ? join(distClient, 'index.html') : join(distClient, path, 'index.html');
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, html);
}

async function writeSitemap() {
  const sitemapPaths = [
    '/',
    '/docs/api/',
    ...projects.map(([projectId]) => `/projects/${projectId}/`),
  ];
  const urls = sitemapPaths
    .map((path) => {
      const priority = path === '/' ? '1.0' : path === '/docs/api/' ? '0.7' : '0.8';
      return [
        '  <url>',
        `    <loc>${absoluteUrl(path)}</loc>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  await writeFile(
    join(distClient, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}

async function writeRobots() {
  await writeFile(
    join(distClient, 'robots.txt'),
    ['User-agent: *', 'Allow: /', `Sitemap: ${absoluteUrl('/sitemap.xml')}`, ''].join('\n'),
  );
}

function renderHome(): string {
  const categoryCounts = new Map<string, number>();
  for (const [, project] of projects) {
    for (const category of project.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  const categories = [...categoryCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, count]) => `<li>${escapeHtml(category)} (${count})</li>`)
    .join('');

  const projectRows = projects
    .map(([projectId, project]) => {
      const versions = Object.keys(project.versions).length;
      const categories = project.categories
        .map((category) => `<small>${escapeHtml(category)}</small>`)
        .join('');
      return `<a class="catalog-row" href="/projects/${escapeAttribute(projectId)}/"><span><span class="catalog-project"><strong>${escapeHtml(project.name)}</strong><span class="catalog-category-badges">${categories}</span></span></span><span>${versions} versions</span></a>`;
    })
    .join('');

  return renderShell(
    `<section class="catalog-intro" aria-labelledby="catalog-title">
      <h1 id="catalog-title">${siteName}</h1>
      <p>Compatibility information is scattered across support matrices, release notes, source trees, and upgrade guides. compatibility.fyi collects that evidence in one open catalog so humans and automation can answer whether two software versions are known to work together.</p>
    </section>
    <section class="catalog-layout">
      <aside class="catalog-sidebar" aria-label="Categories">
        <h2>Categories</h2>
        <ul>${categories}</ul>
      </aside>
      <div class="catalog-results">
        <div class="catalog-results-heading"><h2>All projects</h2><span>${projects.length} projects</span></div>
        <div class="catalog-table" role="table" aria-label="Compatibility projects">${projectRows}</div>
      </div>
    </section>`,
  );
}

function renderApiDocs(): string {
  return renderShell(
    `<section class="page-heading docs-heading">
      <p class="eyebrow">API</p>
      <h1>HTTP API v1</h1>
      <p>Query compatibility metadata as JSON. Start with the project index, inspect a project for its version and dependency keys, then run single or compound compatibility checks.</p>
    </section>
    <section class="docs-content">
      <section class="docs-section">
        <h2>Endpoints</h2>
        <ul>
          <li><code>GET /api/v1/projects</code> lists project ids and high-level metadata.</li>
          <li><code>GET /api/v1/projects/{project}</code> returns compatibility data for one project.</li>
          <li><code>GET /api/v1/check</code> checks one dependency version.</li>
          <li><code>POST /api/v1/check</code> checks a full dependency combination.</li>
        </ul>
      </section>
    </section>`,
  );
}

function renderProject(projectId: string, project: ProjectCompatibility): string {
  const versions = Object.keys(project.versions).sort((left, right) =>
    compareVersions(right, left),
  );
  const compatibilityEntries = versions.flatMap((version) =>
    Object.entries(project.versions[version].dependencies).map(([dependency, entry]) => ({
      version,
      dependency,
      entry,
    })),
  );
  const rows = compatibilityEntries
    .map(
      ({ version, dependency, entry }) =>
        `<tr><td>${escapeHtml(version)}</td><td><strong>${formatDependencyName(dependency)}</strong>${entry.relationship ? `<small class="relationship-label">${escapeHtml(entry.relationship)}</small>` : ''}</td><td>${entry.ranges.map((range) => `<span class="range-chip">${escapeHtml(range)}</span>`).join(' ')}</td><td>${renderEvidence(entry)}</td></tr>`,
    )
    .join('');

  return renderShell(
    `<section class="page-heading">
      <a class="back-link" href="/">&larr; Back to projects</a>
      <div class="project-heading">
        <h1>${escapeHtml(project.name)}</h1>
        ${project.website ? `<a class="project-website" href="${escapeAttribute(project.website)}">Website</a>` : ''}
      </div>
    </section>
    <section class="project-summary" aria-label="${escapeAttribute(project.name)} compatibility summary">
      <div><span class="summary-value">${versions.length}</span><span class="summary-label">Project versions</span></div>
      <div><span class="summary-value">${countDependencies(project)}</span><span class="summary-label">Dependencies</span></div>
      <div><span class="summary-value">${compatibilityEntries.length}</span><span class="summary-label">Compatibility entries</span></div>
    </section>
    <section class="table-section">
      <div class="section-title-row"><h2>Compatibility matrix</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>${escapeHtml(project.name)}</th><th>Dependency</th><th>Supported versions</th><th>Evidence</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`,
  );
}

function renderEvidence(entry: DependencyCompatibilityEntry): string {
  const verification = entry.lastVerified ? `, verified ${escapeHtml(entry.lastVerified)}` : '';
  const sources = entry.sources
    .slice(0, 3)
    .map(
      (source) =>
        `<li><a href="${escapeAttribute(source.url)}">${escapeHtml(source.title)}</a></li>`,
    )
    .join('');

  return `${entry.confidence} confidence${verification}${sources ? `<ul>${sources}</ul>` : ''}`;
}

function renderShell(main: string): string {
  return `<header class="site-header"><a class="brand" href="/"><img alt="" aria-hidden="true" src="/icon-192.png" />${siteName}</a><nav aria-label="Primary"><a href="/docs/api/">API</a><a href="https://github.com/compatibility-fyi/compatibility.fyi/blob/master/CONTRIBUTING.md">Contribute</a><a href="https://github.com/compatibility-fyi/compatibility.fyi">GitHub</a></nav></header><main>${main}</main>`;
}

function renderWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    description: getSeoMetadata('/', dataset).description,
  };
}

function renderApiJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: `${siteName} HTTP API v1`,
    url: absoluteUrl('/docs/api/'),
    description: getSeoMetadata('/docs/api', dataset).description,
    documentation: absoluteUrl('/docs/api/'),
  };
}

function renderProjectJsonLd(projectId: string, project: ProjectCompatibility) {
  const dependencies = [
    ...new Set(
      Object.values(project.versions).flatMap((version) => Object.keys(version.dependencies)),
    ),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${project.name} compatibility matrix`,
    url: absoluteUrl(`/projects/${projectId}/`),
    description: getProjectSeoMetadata(projectId, project).description,
    keywords: [...project.categories, ...dependencies].join(', '),
    isAccessibleForFree: true,
    license: 'https://opensource.org/license/mit',
    creator: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
  };
}

function countDependencies(project: ProjectCompatibility): number {
  return new Set(
    Object.values(project.versions).flatMap((version) => Object.keys(version.dependencies)),
  ).size;
}

function formatDependencyName(dependency: string): string {
  const wordLabels: Record<string, string> = {
    api: 'API',
    aurora: 'Aurora',
    coredns: 'CoreDNS',
    cni: 'CNI',
    gitlab: 'GitLab',
    kubernetes: 'Kubernetes',
    mariadb: 'MariaDB',
    mce: 'MCE',
    mssql: 'Microsoft SQL Server',
    mysql: 'MySQL',
    openshift: 'OpenShift',
    php: 'PHP',
    postgresql: 'PostgreSQL',
    powershell: 'PowerShell',
    python: 'Python',
    rhacm: 'RHACM',
    sql: 'SQL',
  };

  return dependency
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => wordLabels[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function escapeScriptJson(value: string): string {
  return value.replaceAll('<', '\\u003c');
}
