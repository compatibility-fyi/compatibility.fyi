import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { listProjects } from '../src/lib/catalog';
import { loadDataset } from '../src/lib/data';
import type {
  CompatibilityDataset,
  DependencyCompatibilityEntry,
} from '../src/types/compatibility';
import { handleApiRequest } from '../src/worker/api';

const dataset = loadDataset();
const projectSummaries = listProjects(dataset);

interface CheckFixture {
  project: string;
  version: string;
  dependency: string;
  entry: DependencyCompatibilityEntry;
  dependencyVersion: string;
}

describe('api', () => {
  it('returns a bodyless CORS preflight response from the Worker runtime', async () => {
    const response = await exports.default.fetch(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('lists every YAML-backed project', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/projects'),
    );
    const body = (await response.json()) as { projects: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(body.projects.map((project) => project.id)).toEqual(
      projectSummaries.map((project) => project.id),
    );
  });

  it('returns full project data for every listed project', async () => {
    for (const project of projectSummaries) {
      const response = await handleApiRequest(
        new Request(`https://compatibility.fyi/api/v1/projects/${project.id}`),
      );
      const body = (await response.json()) as { id: string; versions: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(body.id).toBe(project.id);
      expect(Object.keys(body.versions).sort()).toEqual([...project.versions].sort());
    }
  });

  it('checks a compatible single dependency from the dataset', async () => {
    const fixture = findCompatibleFixture(dataset);
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
          project: fixture.project,
          version: fixture.version,
          dependency: fixture.dependency,
          dependencyVersion: fixture.dependencyVersion,
        })}`,
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
      lastVerified: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe(fixture.entry.ranges[0]);
    expect(body.relationship).toBe(fixture.entry.relationship ?? null);
    expect(body.lastVerified).toBe(fixture.entry.lastVerified);
  });

  it('checks compound compatibility from GET JSON dependencies', async () => {
    const fixture = findCompoundFixture(dataset);
    const dependencies = Object.fromEntries(
      fixture.dependencies.map((dependency) => [
        dependency.dependency,
        dependency.dependencyVersion,
      ]),
    );
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
          project: fixture.project,
          version: fixture.version,
          dependencies: JSON.stringify(dependencies),
        })}`,
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      checks: Array<{ compatible: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.checks).toHaveLength(fixture.dependencies.length);
    expect(body.checks.every((check) => check.compatible === 'compatible')).toBe(true);
  });

  it('checks compound compatibility from POST JSON', async () => {
    const fixture = findCompoundFixture(dataset);
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: fixture.project,
          version: fixture.version,
          dependencies: Object.fromEntries(
            fixture.dependencies.map((dependency) => [
              dependency.dependency,
              dependency.dependencyVersion,
            ]),
          ),
        }),
      }),
    );
    const body = (await response.json()) as { compatible: string };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns incompatible when a known dependency version is outside supported ranges', async () => {
    const fixture = findBoundedRangeFixture(dataset);
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
          project: fixture.project,
          version: fixture.version,
          dependency: fixture.dependency,
          dependencyVersion: fixture.dependencyVersion,
        })}`,
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      confidence: string;
      lastVerified: string | null;
      sources: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('incompatible');
    expect(body.matchedRange).toBeNull();
    expect(body.confidence).toBe(fixture.entry.confidence);
    expect(body.lastVerified).toBe(fixture.entry.lastVerified);
    expect(body.sources).toEqual(fixture.entry.sources);
  });

  it('checks exact project-version constraints through the API', async () => {
    for (const [project, version, dependency] of [
      ['elasticsearch', '9.4.4', 'kibana'],
      ['mariadb', '11.8.8', 'mariadb-backup'],
    ]) {
      const compatibleResponse = await handleApiRequest(
        new Request(
          `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
            project,
            version,
            dependency,
            dependencyVersion: version,
          })}`,
        ),
      );
      const incompatibleResponse = await handleApiRequest(
        new Request(
          `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
            project,
            version,
            dependency,
            dependencyVersion: `${version}-different`,
          })}`,
        ),
      );

      await expect(compatibleResponse.json()).resolves.toMatchObject({
        compatible: 'compatible',
        matchedRange: null,
        matchedConstraint: 'same-version',
      });
      await expect(incompatibleResponse.json()).resolves.toMatchObject({
        compatible: 'incompatible',
        matchedRange: null,
        matchedConstraint: null,
      });
    }
  });

  it.each(['18.2-rc2', '18.2_beta2', '18.2_SNAPSHOT'])(
    'does not treat prerelease %s as a stable release',
    async (dependencyVersion) => {
      const response = await handleApiRequest(
        new Request(
          `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
            project: 'keycloak',
            version: '26',
            dependency: 'postgresql',
            dependencyVersion,
          })}`,
        ),
      );
      const body = (await response.json()) as {
        compatible: string;
        matchedRange: string | null;
      };

      expect(response.status).toBe(200);
      expect(body.compatible).toBe('incompatible');
      expect(body.matchedRange).toBeNull();
    },
  );

  it('returns unknown for unknown dependencies', async () => {
    const project = projectSummaries[0];
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
          project: project.id,
          version: project.versions[0],
          dependency: 'definitely-missing-dependency',
          dependencyVersion: '1',
        })}`,
      ),
    );
    const body = (await response.json()) as { compatible: string };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('unknown');
  });

  it('reports missing check parameters', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check?project=keycloak'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects blank POST fields instead of returning misleading compatibility', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'keycloak',
          version: '26',
          dependency: 'postgresql',
          dependencyVersion: '',
        }),
      }),
    );
    const body = (await response.json()) as { error: string; missing: string[] };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required body fields');
    expect(body.missing).toEqual(['dependencyVersion']);
  });

  it('rejects empty dependency combinations from GET and POST', async () => {
    const getResponse = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({
          project: 'keycloak',
          version: '26',
          dependencies: '{}',
        })}`,
      ),
    );
    const postResponse = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'keycloak', version: '26', dependencies: {} }),
      }),
    );

    expect(getResponse.status).toBe(400);
    expect(postResponse.status).toBe(400);
    await expect(getResponse.json()).resolves.toMatchObject({
      error: 'dependencies must include at least one dependency',
    });
    await expect(postResponse.json()).resolves.toMatchObject({
      error: 'dependencies must include at least one dependency',
    });
  });

  it('rejects invalid dependency names and blank dependency versions', async () => {
    for (const dependencies of [{ PostgreSQL: '17' }, { postgresql: ' ' }]) {
      const response = await handleApiRequest(
        new Request('https://compatibility.fyi/api/v1/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: 'keycloak', version: '26', dependencies }),
        }),
      );

      expect(response.status).toBe(400);
    }
  });

  it('bounds compound checks and POST body size', async () => {
    const tooManyDependencies = Object.fromEntries(
      Array.from({ length: 33 }, (_, index) => [`dependency-${index}`, '1']),
    );
    const tooManyResponse = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'keycloak',
          version: '26',
          dependencies: tooManyDependencies,
        }),
      }),
    );
    const oversizedResponse = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: 'keycloak',
          version: '26',
          dependency: 'postgresql',
          dependencyVersion: '1'.repeat(17_000),
        }),
      }),
    );

    expect(tooManyResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(413);
  });

  it('requires JSON content for POST checks', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Content-Type must be application/json',
    });
  });
});

function findCompatibleFixture(data: CompatibilityDataset): CheckFixture {
  for (const [project, projectData] of Object.entries(data.projects)) {
    for (const [version, versionData] of Object.entries(projectData.versions)) {
      for (const [dependency, entry] of Object.entries(versionData.dependencies)) {
        if (entry.status === 'compatible' && entry.ranges.length > 0) {
          return {
            dependency,
            dependencyVersion: sampleVersionFromRange(entry.ranges[0]),
            entry,
            project,
            version,
          };
        }
      }
    }
  }

  throw new Error('No compatible compatibility entry found');
}

function findCompoundFixture(data: CompatibilityDataset): {
  project: string;
  version: string;
  dependencies: CheckFixture[];
} {
  for (const [project, projectData] of Object.entries(data.projects)) {
    for (const [version, versionData] of Object.entries(projectData.versions)) {
      const dependencies = Object.entries(versionData.dependencies)
        .filter(([, entry]) => entry.status === 'compatible' && entry.ranges.length > 0)
        .map(([dependency, entry]) => ({
          dependency,
          dependencyVersion: sampleVersionFromRange(entry.ranges[0]),
          entry,
          project,
          version,
        }));

      if (dependencies.length >= 2) {
        return { dependencies, project, version };
      }
    }
  }

  throw new Error('No compound compatibility fixture found');
}

function findBoundedRangeFixture(data: CompatibilityDataset): CheckFixture {
  for (const [project, projectData] of Object.entries(data.projects)) {
    for (const [version, versionData] of Object.entries(projectData.versions)) {
      for (const [dependency, entry] of Object.entries(versionData.dependencies)) {
        const upperBound = entry.ranges[0]?.match(/<\s*(\d+(?:\.\d+){0,2})/)?.[1];
        if (entry.status === 'compatible' && upperBound) {
          return {
            dependency,
            dependencyVersion: upperBound,
            entry,
            project,
            version,
          };
        }
      }
    }
  }

  throw new Error('No bounded compatibility entry found');
}

function sampleVersionFromRange(range: string): string {
  return range.match(/>=\s*(\d+(?:\.\d+){0,2})/)?.[1] ?? range;
}
