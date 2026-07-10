import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type {
  CompatibilityDataset,
  DependencyCompatibilityEntry,
  ProjectCompatibility,
} from '../src/types/compatibility';
import { mergeCompatibilityDatasets } from '../src/lib/dataset';
import { formatDependencyName } from '../src/lib/format';
import { parseCompatibilityYaml } from '../src/lib/validation';
import {
  absoluteUrl,
  countProjectDependencies,
  getDependencyEntries,
  getDependencyLastVerified,
  getDependencySeoMetadata,
  getProjectDependencyIds,
  getProjectLastVerified,
  getProjectSeoMetadata,
  getSeoMetadata,
  robotsContent,
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

interface GeneratedRoute {
  path: string;
  metadata: SeoMetadata;
  html: string;
  jsonLd: unknown;
  lastModified?: string | null;
}

const projectRoutes: GeneratedRoute[] = projects.map(([projectId, project]) => ({
  path: `/projects/${projectId}/`,
  metadata: getProjectSeoMetadata(projectId, project),
  html: renderProject(projectId, project),
  jsonLd: renderProjectJsonLd(projectId, project),
  lastModified: getProjectLastVerified(project),
}));

const dependencyRoutes: GeneratedRoute[] = projects.flatMap(([projectId, project]) =>
  getProjectDependencyIds(project).map((dependencyId) => ({
    path: `/projects/${projectId}/${dependencyId}/`,
    metadata: getDependencySeoMetadata(projectId, project, dependencyId),
    html: renderDependency(projectId, project, dependencyId),
    jsonLd: renderDependencyJsonLd(projectId, project, dependencyId),
    lastModified: getDependencyLastVerified(project, dependencyId),
  })),
);

const routes: GeneratedRoute[] = [
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
  ...projectRoutes,
  ...dependencyRoutes,
];

validateGeneratedRoutes(routes);

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
    files.map(async (file) => ({
      name: file,
      dataset: parseCompatibilityYaml(await readFile(join(dataDirectory, file), 'utf8')),
    })),
  );

  return mergeCompatibilityDatasets(sources);
}

function validateGeneratedRoutes(generatedRoutes: GeneratedRoute[]) {
  const paths = new Set<string>();

  for (const route of generatedRoutes) {
    if (paths.has(route.path)) {
      throw new Error(`Duplicate generated SEO route: ${route.path}`);
    }
    paths.add(route.path);

    if (
      route.path.match(/^\/projects\/[^/]+\/[^/]+\/$/) &&
      route.metadata.description.length < 50
    ) {
      throw new Error(`Dependency SEO description is too short for ${route.path}`);
    }
  }
}

function renderDocument(metadata: SeoMetadata, staticHtml: string, jsonLd: unknown): string {
  const head = renderHead(metadata, jsonLd);

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
    .replace('<div id="root"></div>', `<div id="root">${staticHtml}</div>`);
}

function renderHead(metadata: SeoMetadata, jsonLd: unknown): string {
  const canonical = absoluteUrl(metadata.canonicalPath);
  const escapedTitle = escapeHtml(metadata.title);
  const escapedDescription = escapeHtml(metadata.description);

  return [
    `    <meta name="description" content="${escapedDescription}" />`,
    `    <meta name="robots" content="${metadata.robots ?? robotsContent}" />`,
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
  const urls = routes
    .filter((route) => route.path !== '/projects')
    .map((route) => {
      return [
        '  <url>',
        `    <loc>${absoluteUrl(route.path)}</loc>`,
        ...(route.lastModified ? [`    <lastmod>${route.lastModified}</lastmod>`] : []),
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
        `<tr><td>${escapeHtml(version)}</td><td><strong><a class="dependency-link" href="/projects/${escapeAttribute(projectId)}/${escapeAttribute(dependency)}/">${escapeHtml(formatDependencyName(dependency))}</a></strong>${entry.relationship ? `<small class="relationship-label">${escapeHtml(entry.relationship)}</small>` : ''}</td><td>${entry.ranges.map((range) => `<span class="range-chip">${escapeHtml(range)}</span>`).join(' ')}</td><td>${renderEvidence(entry)}</td></tr>`,
    )
    .join('');
  const dependencyGuides = getProjectDependencyIds(project)
    .map((dependencyId) => {
      const versionCount = getDependencyEntries(project, dependencyId).length;
      return `<a href="/projects/${escapeAttribute(projectId)}/${escapeAttribute(dependencyId)}/"><strong>${escapeHtml(project.name)} ${escapeHtml(formatDependencyName(dependencyId))} compatibility</strong><span>${versionCount} ${versionCount === 1 ? 'project version' : 'project versions'}</span></a>`;
    })
    .join('');

  return renderShell(
    `<section class="page-heading">
      <a class="back-link" href="/">&larr; Back to projects</a>
      <div class="project-heading">
        <h1>${escapeHtml(project.name)}</h1>
        <div class="project-actions">
          ${project.website ? `<a class="project-action-link" href="${escapeAttribute(project.website)}" rel="noreferrer" target="_blank">Website</a>` : ''}
          <a class="project-action-link" href="${escapeAttribute(getProjectSourceUrl(projectId))}" rel="noreferrer" target="_blank">View source</a>
        </div>
      </div>
    </section>
    <section class="project-summary" aria-label="${escapeAttribute(project.name)} compatibility summary">
      <div><span class="summary-value">${versions.length}</span><span class="summary-label">Project versions</span></div>
      <div><span class="summary-value">${countProjectDependencies(project)}</span><span class="summary-label">Dependencies</span></div>
      <div><span class="summary-value">${compatibilityEntries.length}</span><span class="summary-label">Compatibility entries</span></div>
    </section>
    <section class="dependency-index" aria-labelledby="dependency-guides-title">
      <div class="section-title-row"><div><p class="eyebrow">Compatibility guides</p><h2 id="dependency-guides-title">Browse by dependency</h2></div><span>${countProjectDependencies(project)} guides</span></div>
      <div class="dependency-index-grid">${dependencyGuides}</div>
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

function renderDependency(
  projectId: string,
  project: ProjectCompatibility,
  dependencyId: string,
): string {
  const dependencyName = formatDependencyName(dependencyId);
  const metadata = getDependencySeoMetadata(projectId, project, dependencyId);
  const entries = getDependencyEntries(project, dependencyId);
  const sources = getDependencySources(project, dependencyId);
  const lastVerified = getDependencyLastVerified(project, dependencyId);
  const answers = entries
    .map(
      ([version, entry]) => `<article>
        <div class="dependency-version-heading"><span>${escapeHtml(project.name)} version</span><h3>${escapeHtml(version)}</h3></div>
        <div>
          <p class="dependency-range-label">Documented ${escapeHtml(dependencyName)} versions</p>
          <div class="range-list">${entry.ranges.map((range) => `<span class="range-chip">${escapeHtml(range)}</span>`).join(' ')}</div>
          ${entry.notes.map((note) => `<p class="dependency-answer-note">${escapeHtml(note)}</p>`).join('')}
          <p class="dependency-verification">${escapeHtml(entry.confidence)} confidence${entry.lastVerified ? ` · verified ${escapeHtml(entry.lastVerified)}` : ''}${entry.relationship ? ` · ${escapeHtml(entry.relationship)}` : ''}</p>
        </div>
      </article>`,
    )
    .join('');
  const sourceList = sources
    .map(
      (source) =>
        `<li><a href="${escapeAttribute(source.url)}">${escapeHtml(source.title)}</a>${source.accessedAt ? `<span>Accessed ${escapeHtml(source.accessedAt)}</span>` : ''}</li>`,
    )
    .join('');

  return renderShell(
    `<section class="page-heading dependency-heading">
      <a class="back-link" href="/projects/${escapeAttribute(projectId)}/">&larr; Back to ${escapeHtml(project.name)}</a>
      <p class="eyebrow">Source-backed version compatibility</p>
      <h1>${escapeHtml(project.name)} ${escapeHtml(dependencyName)} Version Compatibility</h1>
      <p>${escapeHtml(metadata.description)}</p>
      <div class="project-actions"><a class="project-action-link" href="/projects/${escapeAttribute(projectId)}/">Full ${escapeHtml(project.name)} matrix</a><a class="project-action-link" href="/api/v1/projects/${escapeAttribute(projectId)}">JSON data</a></div>
    </section>
    <section class="dependency-summary" aria-label="Compatibility summary">
      <div><span class="summary-value">${entries.length}</span><span class="summary-label">Project versions</span></div>
      <div><span class="summary-value">${entries.reduce((total, [, entry]) => total + entry.ranges.length, 0)}</span><span class="summary-label">Documented ranges</span></div>
      <div><span class="summary-date">${escapeHtml(lastVerified ?? 'Not verified')}</span><span class="summary-label">Last verified</span></div>
    </section>
    <section class="dependency-answer" aria-labelledby="compatibility-answer-title">
      <div class="section-title-row"><div><p class="eyebrow">Quick answer</p><h2 id="compatibility-answer-title">${escapeHtml(dependencyName)} compatibility by ${escapeHtml(project.name)} version</h2></div></div>
      <div class="dependency-answer-list">${answers}</div>
    </section>
    <section class="dependency-sources" aria-labelledby="dependency-sources-title">
      <div><p class="eyebrow">Primary evidence</p><h2 id="dependency-sources-title">Sources</h2><p>Every range above is backed by upstream documentation, tagged source, release notes, or another project-owned primary source.</p></div>
      <ol>${sourceList}</ol>
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

function getProjectSourceUrl(projectId: string): string {
  return `https://github.com/compatibility-fyi/compatibility.fyi/blob/master/data/${projectId}.yaml`;
}

function renderWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: siteName,
        alternateName: 'Compatibility FYI',
        url: siteUrl,
        description: getSeoMetadata('/', dataset).description,
      },
      {
        '@type': 'Organization',
        name: siteName,
        url: siteUrl,
        logo: absoluteUrl('/icon-512.png'),
      },
    ],
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
  const dependencies = getProjectDependencyIds(project);
  const sourceUrls = getProjectSourceUrls(project);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: `${project.name} compatibility matrix`,
        url: absoluteUrl(`/projects/${projectId}/`),
        identifier: absoluteUrl(`/projects/${projectId}/`),
        description: getProjectSeoMetadata(projectId, project).description,
        keywords: [...project.categories, ...dependencies.map(formatDependencyName)].join(', '),
        version: Object.keys(project.versions),
        dateModified: getProjectLastVerified(project) ?? undefined,
        isBasedOn: sourceUrls,
        distribution: renderDatasetDistribution(projectId),
        isAccessibleForFree: true,
        license: 'https://opensource.org/license/mit',
        creator: renderCreator(),
      },
      renderBreadcrumbs([
        ['Projects', '/projects/'],
        [project.name, `/projects/${projectId}/`],
      ]),
    ],
  };
}

function renderDependencyJsonLd(
  projectId: string,
  project: ProjectCompatibility,
  dependencyId: string,
) {
  const dependencyName = formatDependencyName(dependencyId);
  const entries = getDependencyEntries(project, dependencyId);
  const canonicalPath = `/projects/${projectId}/${dependencyId}/`;
  const alternateName =
    dependencyId === 'postgresql'
      ? [`${project.name} Postgres compatibility`, `${project.name} PostgreSQL compatibility`]
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        name: `${project.name} ${dependencyName} version compatibility`,
        alternateName,
        url: absoluteUrl(canonicalPath),
        identifier: absoluteUrl(canonicalPath),
        description: getDependencySeoMetadata(projectId, project, dependencyId).description,
        keywords: [
          project.name,
          dependencyName,
          `${project.name} ${dependencyName} compatibility`,
          `${dependencyName} version compatibility`,
          ...(dependencyId === 'postgresql' ? ['Postgres compatibility'] : []),
        ].join(', '),
        version: entries.map(([version]) => version),
        dateModified: getDependencyLastVerified(project, dependencyId) ?? undefined,
        isBasedOn: getDependencySources(project, dependencyId).map((source) => source.url),
        distribution: renderDatasetDistribution(projectId),
        isAccessibleForFree: true,
        license: 'https://opensource.org/license/mit',
        creator: renderCreator(),
      },
      renderBreadcrumbs([
        ['Projects', '/projects/'],
        [project.name, `/projects/${projectId}/`],
        [dependencyName, canonicalPath],
      ]),
    ],
  };
}

function renderCreator() {
  return {
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
  };
}

function renderDatasetDistribution(projectId: string) {
  return [
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: absoluteUrl(`/api/v1/projects/${projectId}`),
    },
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/yaml',
      contentUrl: getProjectSourceUrl(projectId),
    },
  ];
}

function renderBreadcrumbs(items: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}

function getProjectSourceUrls(project: ProjectCompatibility): string[] {
  return [
    ...new Set(
      Object.values(project.versions).flatMap((version) =>
        Object.values(version.dependencies).flatMap((entry) =>
          entry.sources.map((source) => source.url),
        ),
      ),
    ),
  ];
}

function getDependencySources(project: ProjectCompatibility, dependencyId: string) {
  return [
    ...new Map(
      getDependencyEntries(project, dependencyId)
        .flatMap(([, entry]) => entry.sources)
        .map((source) => [source.url, source]),
    ).values(),
  ];
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
