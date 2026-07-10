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
  });

  it('lists every YAML-backed project', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/projects'),
    );
    const body = (await response.json()) as { projects: Array<{ id: string }> };

    expect(response.status).toBe(200);
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
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe(fixture.entry.ranges[0]);
    expect(body.relationship).toBe(fixture.entry.relationship ?? null);
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
      sources: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('incompatible');
    expect(body.matchedRange).toBeNull();
    expect(body.confidence).toBe(fixture.entry.confidence);
    expect(body.sources).toEqual(fixture.entry.sources);
  });

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
