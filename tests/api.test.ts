import { describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../src/worker/api';

vi.mock('virtual:compatibility-data', async () => {
  const { dataset } = await import('./fixtures/compatibility');
  return { default: dataset };
});

const singleCheck = {
  project: 'sample',
  version: '1',
  dependency: 'database',
  dependencyVersion: '17',
};
const compoundCheck = {
  project: 'sample',
  version: '1',
  dependencies: { database: '17', peer: '1' },
};

describe.each(['GET', 'POST'] as const)('%s compatibility checks', (method) => {
  function request(fields: Record<string, unknown>): Request {
    const url = 'https://compatibility.fyi/api/v1/check';
    if (method === 'POST') {
      return new Request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    }
    const params = new URLSearchParams(
      Object.entries(fields).map(([key, value]) => [
        key,
        key === 'dependencies' ? JSON.stringify(value) : String(value),
      ]),
    );
    return new Request(`${url}?${params}`);
  }

  it('returns a single check with evidence and method-appropriate caching', async () => {
    const response = await handleApiRequest(request(singleCheck));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      method === 'GET' ? 'public, max-age=60' : 'no-store',
    );
    await expect(response.json()).resolves.toMatchObject({
      ...singleCheck,
      compatible: 'compatible',
      matchedRange: '>=15 <=17',
      matchedConstraint: null,
      relationship: null,
      confidence: 'high',
      lastVerified: '2026-07-08',
      notes: ['Verified fixture'],
      sources: [{ title: 'Fixture', url: 'https://example.com' }],
    });
  });

  it('checks every dependency in a compound request', async () => {
    const response = await handleApiRequest(request(compoundCheck));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      compatible: 'compatible',
      checks: [
        { dependency: 'database', dependencyVersion: '17', compatible: 'compatible' },
        { dependency: 'peer', dependencyVersion: '1', compatible: 'compatible' },
      ],
    });
  });

  it('retains evidence when a known dependency misses supported ranges', async () => {
    const response = await handleApiRequest(request({ ...singleCheck, dependencyVersion: '18' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      compatible: 'incompatible',
      matchedRange: null,
      confidence: 'high',
      lastVerified: '2026-07-08',
      notes: ['Verified fixture'],
      sources: [{ title: 'Fixture', url: 'https://example.com' }],
    });
  });

  it.each([
    ['1.4.2', 'compatible', 'same-version'],
    ['1.4.1', 'incompatible', null],
  ])(
    'checks exact-version dependency %s',
    async (dependencyVersion, compatible, matchedConstraint) => {
      const response = await handleApiRequest(
        request({
          ...singleCheck,
          version: '1.4.2',
          dependency: 'peer',
          dependencyVersion,
        }),
      );
      await expect(response.json()).resolves.toMatchObject({
        compatible,
        matchedRange: null,
        matchedConstraint,
      });
    },
  );

  it('excludes prereleases from supported release ranges', async () => {
    const response = await handleApiRequest(
      request({ ...singleCheck, dependencyVersion: '17.0-rc1' }),
    );
    await expect(response.json()).resolves.toMatchObject({
      compatible: 'incompatible',
      matchedRange: null,
    });
  });

  it.each([
    { ...singleCheck, project: 'missing' },
    { ...singleCheck, dependency: 'missing' },
    { ...singleCheck, version: '99' },
  ])('returns unknown for missing metadata: $project/$version/$dependency', async (fields) => {
    const response = await handleApiRequest(request(fields));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ compatible: 'unknown', sources: [] });
  });

  it.each([
    { ...singleCheck, project: 'UPPERCASE' },
    { ...compoundCheck, project: 'UPPERCASE' },
    { ...singleCheck, dependency: 'Database' },
    { ...compoundCheck, dependencies: { Database: '17' } },
    { ...compoundCheck, dependencies: { database: ' ' } },
    { ...compoundCheck, dependencies: {} },
    { ...compoundCheck, dependencies: [] },
    { ...compoundCheck, dependencies: null },
  ])('rejects invalid identifiers and dependencies: %j', async (fields) => {
    const response = await handleApiRequest(request(fields));
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toHaveProperty('error');
  });

  it.each([
    { project: 'sample' },
    { ...singleCheck, dependencyVersion: ' ' },
    { ...compoundCheck, version: ' ' },
  ])('reports missing fields: %j', async (fields) => {
    const response = await handleApiRequest(request(fields));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error:
        method === 'GET' ? 'Missing required query parameters' : 'Missing required body fields',
      missing: expect.any(Array),
    });
  });

  it('trims version fields', async () => {
    const response = await handleApiRequest(
      request({ ...singleCheck, version: ' 1 ', dependencyVersion: ' 17 ' }),
    );
    await expect(response.json()).resolves.toMatchObject({
      ...singleCheck,
      compatible: 'compatible',
    });
  });

  it.each([
    { ...singleCheck, version: '1'.repeat(129) },
    { ...compoundCheck, dependencies: { database: '1'.repeat(129) } },
    {
      ...compoundCheck,
      dependencies: Object.fromEntries(
        Array.from({ length: 33 }, (_, index) => [`dependency-${index}`, '1']),
      ),
    },
  ])('bounds field lengths and dependency counts: %j', async (fields) => {
    const response = await handleApiRequest(request(fields));
    expect(response.status).toBe(400);
  });
});

describe('request decoding', () => {
  it.each(['', '{'])('rejects malformed GET dependency JSON %j', async (dependencies) => {
    const response = await handleApiRequest(
      new Request(
        `https://compatibility.fyi/api/v1/check?${new URLSearchParams({ project: 'sample', version: '1', dependencies })}`,
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'dependencies must be a JSON object of dependency names to versions',
    });
  });

  it.each([
    { body: '{}', contentType: 'text/plain', status: 415 },
    { body: '{', contentType: 'application/json', status: 400 },
    { body: '[]', contentType: 'application/json', status: 400 },
    {
      body: JSON.stringify({ ...singleCheck, dependencyVersion: 17 }),
      contentType: 'application/json',
      status: 400,
    },
    {
      body: JSON.stringify({ ...singleCheck, dependencyVersion: '1'.repeat(17_000) }),
      contentType: 'application/json',
      status: 413,
    },
  ])('rejects invalid POST input with $status', async ({ body, contentType, status }) => {
    const response = await handleApiRequest(
      new Request('https://compatibility.fyi/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      }),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
