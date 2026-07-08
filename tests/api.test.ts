import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../src/worker/api';

describe('api', () => {
  it('lists projects', async () => {
    const response = handleApiRequest(new Request('https://compatibility.fyi/api/v1/projects'));
    const body = (await response.json()) as { projects: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'keycloak' })]),
    );
  });

  it('returns project data', async () => {
    const response = handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/projects/keycloak'),
    );
    const body = (await response.json()) as { id: string; versions: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.id).toBe('keycloak');
    expect(body.versions).toHaveProperty('26');
  });

  it('checks compatibility and keeps seed data unknown', async () => {
    const response = handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17',
      ),
    );
    const body = (await response.json()) as { compatible: string; matchedRange: string | null };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('unknown');
    expect(body.matchedRange).toBeNull();
  });

  it('reports missing check parameters', async () => {
    const response = handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check?project=keycloak'),
    );

    expect(response.status).toBe(400);
  });
});
