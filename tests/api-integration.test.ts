import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import dataset from '../src/lib/data';

describe('Worker with the generated YAML dataset', () => {
  it('serves CORS preflight and security headers', async () => {
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
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('lists the YAML projects and serves a complete project', async () => {
    const response = await exports.default.fetch(
      new Request('https://compatibility.fyi/api/v1/projects'),
    );
    const body = (await response.json()) as { projects: { id: string }[] };
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(body.projects.map((project) => project.id).sort()).toEqual(
      Object.keys(dataset.projects).sort(),
    );

    const project = await exports.default.fetch(
      new Request('https://compatibility.fyi/api/v1/projects/keycloak'),
    );
    expect(project.status).toBe(200);
    await expect(project.json()).resolves.toEqual({ id: 'keycloak', ...dataset.projects.keycloak });
  });

  it('checks compatibility using the bundled data', async () => {
    const response = await exports.default.fetch(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17',
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ compatible: 'compatible' });
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'does not expose inherited project %s',
    async (project) => {
      const response = await exports.default.fetch(
        new Request(`https://compatibility.fyi/api/v1/projects/${project}`),
      );
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Project not found', project });
    },
  );

  it.each([
    { project: 'constructor', version: '1', dependency: 'postgresql' },
    { project: 'keycloak', version: '26', dependency: 'constructor' },
    { project: 'keycloak', version: 'constructor', dependency: 'postgresql' },
  ])('treats inherited keys as missing metadata: %j', async (fields) => {
    const response = await exports.default.fetch(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({ ...fields, dependencyVersion: '17' })}`,
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ compatible: 'unknown', sources: [] });
  });
});
