import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { loadCompatibilityDataset } from './compatibility-data-plugin';
import { DocsApiPage } from '../src/app/pages/DocsApiPage';
import { DependencyPage } from '../src/app/pages/DependencyPage';
import { LandingPage } from '../src/app/pages/LandingPage';
import { NotFoundPage } from '../src/app/pages/NotFoundPage';
import { ProjectPage } from '../src/app/pages/ProjectPage';
import type { ProjectCompatibility } from '../src/types/compatibility';
import { formatDependencyName } from '../src/lib/format';
import {
  absoluteUrl,
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

const distClient = resolve('dist/client');

const dataset = await loadCompatibilityDataset();
const template = await readFile(join(distClient, 'index.html'), 'utf8');
const manifest = JSON.parse(
  await readFile(join(distClient, '.vite/manifest.json'), 'utf8'),
) as Record<string, { file: string }>;
const pageScripts: Record<PageScript, string> = {
  catalog: getManifestFile('src/client/catalog.ts'),
  docs: getManifestFile('src/client/docs.ts'),
  project: getManifestFile('src/client/project.ts'),
};
await validateClientBundles();
const projects = Object.entries(dataset.projects).sort(([, left], [, right]) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
);

interface GeneratedRoute {
  path: string;
  metadata: SeoMetadata;
  html: string;
  jsonLd: unknown;
  lastModified?: string | null;
  script?: PageScript;
}

type PageScript = 'catalog' | 'docs' | 'project';

const projectRoutes: GeneratedRoute[] = projects.map(([projectId, project]) => ({
  path: `/projects/${projectId}/`,
  metadata: getProjectSeoMetadata(projectId, project),
  html: renderProjectPage(projectId, project),
  jsonLd: renderProjectJsonLd(projectId, project),
  lastModified: getProjectLastVerified(project),
  script: 'project',
}));

const dependencyRoutes: GeneratedRoute[] = projects.flatMap(([projectId, project]) =>
  getProjectDependencyIds(project).map((dependencyId) => ({
    path: `/projects/${projectId}/${dependencyId}/`,
    metadata: getDependencySeoMetadata(projectId, project, dependencyId),
    html: renderComponent(DependencyPage, { dataset, projectId, dependencyId }),
    jsonLd: renderDependencyJsonLd(projectId, project, dependencyId),
    lastModified: getDependencyLastVerified(project, dependencyId),
  })),
);

const routes: GeneratedRoute[] = [
  {
    path: '/',
    metadata: getSeoMetadata('/', dataset),
    html: renderComponent(LandingPage, { dataset }),
    jsonLd: renderWebsiteJsonLd(),
    script: 'catalog',
  },
  {
    path: '/projects',
    metadata: getSeoMetadata('/', dataset),
    html: renderComponent(LandingPage, { dataset }),
    jsonLd: renderWebsiteJsonLd(),
    script: 'catalog',
  },
  {
    path: '/docs/api/',
    metadata: getSeoMetadata('/docs/api', dataset),
    html: renderComponent(DocsApiPage, {}),
    jsonLd: renderApiJsonLd(),
    script: 'docs',
  },
  ...projectRoutes,
  ...dependencyRoutes,
];

validateGeneratedRoutes(routes);

for (const route of routes) {
  const document = renderDocument(route.metadata, route.html, route.jsonLd, route.script);
  validateDocumentScript(route.path, document, route.script);
  await writeRoute(route.path, document);
}

await writeSitemap();
await writeRobots();
await writeLlms();
await writeNotFound();

console.log(`generated SEO assets for ${routes.length} routes`);

function renderComponent<Props extends object>(
  Component: ComponentType<Props>,
  props: Props,
): string {
  return renderToStaticMarkup(createElement(Component, props));
}

function renderProjectPage(projectId: string, project: ProjectCompatibility): string {
  const projectDataset = { projects: { [projectId]: project } };
  const page = renderComponent(ProjectPage, { dataset: projectDataset, projectId });
  const data = escapeScriptJson(JSON.stringify(projectDataset));
  return `${page}<script id="project-compatibility-data" type="application/json">${data}</script>`;
}

function getManifestFile(source: string): string {
  const file = manifest[source]?.file;
  if (!file) {
    throw new Error(`Missing client build manifest entry for ${source}`);
  }
  return file;
}

async function validateClientBundles() {
  const budgets: Record<PageScript, number> = {
    catalog: 5_000,
    docs: 5_000,
    project: 50_000,
  };

  for (const [script, file] of Object.entries(pageScripts) as [PageScript, string][]) {
    const size = (await stat(join(distClient, file))).size;
    if (size > budgets[script]) {
      throw new Error(`${script} client bundle is ${size} bytes; budget is ${budgets[script]}`);
    }
  }
}

function validateDocumentScript(path: string, document: string, pageScript?: PageScript) {
  const scripts = [...document.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(
    (match) => match[1],
  );
  const expected = pageScript ? [`/${pageScripts[pageScript]}`] : [];

  if (
    scripts.length !== expected.length ||
    scripts.some((script, index) => script !== expected[index])
  ) {
    throw new Error(`Unexpected client scripts for ${path}: ${scripts.join(', ') || 'none'}`);
  }
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

function renderDocument(
  metadata: SeoMetadata,
  staticHtml: string,
  jsonLd?: unknown,
  pageScript?: PageScript,
): string {
  const head = renderHead(metadata, jsonLd);
  const script = pageScript
    ? `    <script type="module" src="/${pageScripts[pageScript]}"></script>\n`
    : '';

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
    .replace('<div id="root"></div>', `<div id="root">${staticHtml}</div>`)
    .replace('</body>', `${script}  </body>`);
}

function renderHead(metadata: SeoMetadata, jsonLd?: unknown): string {
  const escapedTitle = escapeHtml(metadata.title);
  const escapedDescription = escapeHtml(metadata.description);
  const canonical = metadata.canonicalPath ? absoluteUrl(metadata.canonicalPath) : undefined;

  return [
    `    <meta name="description" content="${escapedDescription}" />`,
    `    <meta name="robots" content="${metadata.robots ?? robotsContent}" />`,
    ...(canonical ? [`    <link rel="canonical" href="${canonical}" />`] : []),
    `    <meta property="og:site_name" content="${siteName}" />`,
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:title" content="${escapedTitle}" />`,
    `    <meta property="og:description" content="${escapedDescription}" />`,
    ...(canonical ? [`    <meta property="og:url" content="${canonical}" />`] : []),
    `    <meta property="og:image" content="${absoluteUrl('/icon-512.png')}" />`,
    '    <meta name="twitter:card" content="summary" />',
    `    <meta name="twitter:title" content="${escapedTitle}" />`,
    `    <meta name="twitter:description" content="${escapedDescription}" />`,
    `    <meta name="twitter:image" content="${absoluteUrl('/icon-512.png')}" />`,
    ...(jsonLd === undefined
      ? []
      : [
          `    <script type="application/ld+json">${escapeScriptJson(JSON.stringify(jsonLd))}</script>`,
        ]),
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

async function writeLlms() {
  const projectLinks = projects
    .map(([projectId, project]) => {
      const description = project.description ? `: ${singleLine(project.description)}` : '';
      return `- [${project.name}](${absoluteUrl(`/projects/${projectId}/`)})${description}`;
    })
    .join('\n');
  const dependencyLinks = projects
    .flatMap(([projectId, project]) =>
      getProjectDependencyIds(project).map(
        (dependencyId) =>
          `- [${project.name} ${formatDependencyName(dependencyId)} compatibility](${absoluteUrl(`/projects/${projectId}/${dependencyId}/`)})`,
      ),
    )
    .join('\n');

  await writeFile(
    join(distClient, 'llms.txt'),
    [
      `# ${siteName}`,
      '',
      '> Source-backed software version compatibility metadata for humans and automation.',
      '',
      'compatibility.fyi answers whether a project version is documented to work with a dependency version. Every compatibility claim includes upstream evidence, confidence, notes, and a verification date.',
      '',
      '## Core resources',
      '',
      `- [Compatibility catalog](${absoluteUrl('/')})`,
      `- [HTTP API documentation](${absoluteUrl('/docs/api/')})`,
      `- [XML sitemap](${absoluteUrl('/sitemap.xml')})`,
      '- [GitHub repository](https://github.com/compatibility-fyi/compatibility.fyi)',
      '',
      '## Projects',
      '',
      projectLinks,
      '',
      '## Compatibility guides',
      '',
      dependencyLinks,
      '',
    ].join('\n'),
  );
}

async function writeNotFound() {
  const metadata = getSeoMetadata('/404', dataset);
  await writeFile(
    join(distClient, '404.html'),
    renderDocument(metadata, renderComponent(NotFoundPage, {})),
  );
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

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeScriptJson(value: string): string {
  return value.replaceAll('<', '\\u003c');
}
