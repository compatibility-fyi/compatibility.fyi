import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../src/worker/api';

describe('api', () => {
  it('lists projects', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/projects'),
    );
    const body = (await response.json()) as { projects: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'argocd' }),
        expect.objectContaining({ id: 'cert-manager' }),
        expect.objectContaining({ id: 'cilium' }),
        expect.objectContaining({ id: 'cloudnativepg' }),
        expect.objectContaining({ id: 'flux' }),
        expect.objectContaining({ id: 'keycloak' }),
      ]),
    );
  });

  it('returns project data', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/projects/keycloak'),
    );
    const body = (await response.json()) as { id: string; versions: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.id).toBe('keycloak');
    expect(body.versions).toHaveProperty('26');
  });

  it('checks compatibility from source-backed Keycloak data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=17',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      confidence: string;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=14.0.0 <19.0.0');
    expect(body.confidence).toBe('high');
  });

  it('checks Envoy Gateway matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=envoy-gateway&version=1.8&dependency=gateway-api&dependencyVersion=1.5.1',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('1.5.1');
    expect(body.relationship).toBe('compiled');
  });

  it('checks CloudNativePG matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=cloudnativepg&version=1.30&dependency=kubernetes&dependencyVersion=1.36',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=1.34 <1.37');
    expect(body.relationship).toBe('runtime');
  });

  it('checks Argo CD matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=argocd&version=3.4&dependency=kubernetes&dependencyVersion=1.35',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=1.32 <1.36');
    expect(body.relationship).toBe('runtime');
  });

  it('checks Flux matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=flux&version=2.9&dependency=kubernetes&dependencyVersion=1.36',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=1.34 <1.37');
    expect(body.relationship).toBe('runtime');
  });

  it('checks cert-manager matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=cert-manager&version=1.20&dependency=openshift&dependencyVersion=4.21',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=4.19 <4.22');
    expect(body.relationship).toBe('runtime');
  });

  it('checks Cilium matrix data', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=cilium&version=1.19&dependency=kubernetes&dependencyVersion=1.35',
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      matchedRange: string | null;
      relationship: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.matchedRange).toBe('>=1.32 <1.36');
    expect(body.relationship).toBe('runtime');
  });

  it('checks compound CloudNativePG compatibility from POST JSON', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        body: JSON.stringify({
          project: 'cloudnativepg',
          version: '1.30',
          dependencies: {
            postgresql: '18',
            kubernetes: '1.36',
          },
        }),
      }),
    );
    const body = (await response.json()) as { compatible: string };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
  });

  it('checks compound Envoy Gateway compatibility from GET JSON dependencies', async () => {
    const dependencies = encodeURIComponent(
      JSON.stringify({
        'gateway-api': '1.5.1',
        kubernetes: '1.34',
        'envoy-proxy': 'distroless-v1.38.0',
        'rate-limit': 'fe26676d',
      }),
    );
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?project=envoy-gateway&version=1.8&dependencies=${dependencies}`,
      ),
    );
    const body = (await response.json()) as {
      compatible: string;
      checks: Array<{ compatible: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('compatible');
    expect(body.checks).toHaveLength(4);
    expect(body.checks.every((check) => check.compatible === 'compatible')).toBe(true);
  });

  it('checks compound Envoy Gateway compatibility from POST JSON', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        body: JSON.stringify({
          project: 'envoy-gateway',
          version: '1.8',
          dependencies: {
            'gateway-api': '1.5.1',
            kubernetes: '1.36',
          },
        }),
      }),
    );
    const body = (await response.json()) as { compatible: string };

    expect(response.status).toBe(200);
    expect(body.compatible).toBe('incompatible');
  });

  it('returns incompatible when a known dependency version is outside supported ranges', async () => {
    const response = await handleApiRequest(
      new Request(
        'https://compatibility.fyi/api/v1/check?project=keycloak&version=26&dependency=postgresql&dependencyVersion=13',
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
    expect(body.confidence).toBe('high');
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it('reports missing check parameters', async () => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check?project=keycloak'),
    );

    expect(response.status).toBe(400);
  });
});
