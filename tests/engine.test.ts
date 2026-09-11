import { describe, expect, it } from 'vitest';
import { checkCompatibility, checkCompoundCompatibility } from '../src/lib/engine';
import { dataset } from './fixtures/compatibility';

describe('compatibility engine', () => {
  it.each(['supported', 'tested', 'recommended', 'bundled'] as const)(
    'distinguishes %s evidence from a compatibility verdict',
    (basis) => {
      const evidenceDataset = structuredClone(dataset);
      evidenceDataset.projects.sample.versions['1'].dependencies.database.basis = basis;
      const request = {
        project: 'sample',
        version: '1',
        dependency: 'database',
        dependencyVersion: '17',
      };
      const result = checkCompatibility(evidenceDataset, request);
      expect(result).toMatchObject({
        basis,
        matchedRange: '>=15 <=17',
        compatible: basis === 'supported' || basis === 'tested' ? 'compatible' : 'unknown',
      });
      expect(
        checkCompatibility(evidenceDataset, { ...request, dependencyVersion: '18' }),
      ).toMatchObject({ basis, compatible: 'unknown', matchedRange: null });
      expect(
        checkCompoundCompatibility(evidenceDataset, {
          project: 'sample',
          version: '1',
          dependencies: { database: '17', peer: '1' },
        }).compatible,
      ).toBe(result.compatible);
    },
  );

  it('returns compatible when a dependency version matches a compatible range', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'database',
        dependencyVersion: '17',
      }),
    ).toMatchObject({
      compatible: 'compatible',
      matchedRange: '>=15 <=17',
      confidence: 'high',
      lastVerified: '2026-07-08',
    });
  });

  it('returns incompatible when a dependency version matches an incompatible range', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'runtime',
        dependencyVersion: '20',
      }),
    ).toMatchObject({
      compatible: 'incompatible',
      matchedRange: '<21',
      confidence: 'medium',
      lastVerified: '2026-07-08',
    });
  });

  it('returns unknown with coverage evidence when a version is unlisted', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'database',
        dependencyVersion: '18',
      }),
    ).toMatchObject({
      compatible: 'unknown',
      matchedRange: null,
      confidence: 'high',
      lastVerified: '2026-07-08',
      notes: ['Verified fixture'],
      sources: [{ title: 'Fixture', url: 'https://example.com' }],
    });
  });

  it('matches dependencies that must equal the exact requested project version', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1.4.2',
        dependency: 'peer',
        dependencyVersion: '1.4.2',
      }),
    ).toMatchObject({
      compatible: 'compatible',
      matchedRange: null,
      matchedConstraint: 'same-version',
    });

    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1.4.2',
        dependency: 'peer',
        dependencyVersion: '1.4.1',
      }),
    ).toMatchObject({
      compatible: 'unknown',
      matchedRange: null,
      matchedConstraint: null,
    });
  });

  it('returns unknown for unknown projects', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'missing',
        version: '1',
        dependency: 'database',
        dependencyVersion: '17',
      }).compatible,
    ).toBe('unknown');
  });

  it('returns unknown for unknown dependencies', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'missing',
        dependencyVersion: '17',
      }).compatible,
    ).toBe('unknown');
  });

  it('prefers a minor-version row over a broader major-version row', () => {
    const project = dataset.projects.sample;
    const overlappingDataset = {
      projects: {
        sample: {
          ...project,
          versions: {
            ...project.versions,
            '1.4': {
              dependencies: {
                database: {
                  ...project.versions['1'].dependencies.database,
                  ranges: ['>=18 <19'],
                },
              },
            },
          },
        },
      },
    };

    expect(
      checkCompatibility(overlappingDataset, {
        project: 'sample',
        version: '1.4.2',
        dependency: 'database',
        dependencyVersion: '18',
      }),
    ).toMatchObject({ compatible: 'compatible', matchedRange: '>=18 <19' });
    expect(
      checkCompatibility(overlappingDataset, {
        project: 'sample',
        version: '1.5.2',
        dependency: 'database',
        dependencyVersion: '18',
      }).compatible,
    ).toBe('unknown');
  });

  it('returns evidence for intentionally unknown entries', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'unverified',
        dependencyVersion: '1',
      }),
    ).toMatchObject({
      compatible: 'unknown',
      lastVerified: '2026-07-08',
      notes: ['Upstream explicitly marks this combination as unverified'],
      sources: [{ title: 'Fixture', url: 'https://example.com/unverified' }],
    });
  });

  it.each<{ dependencies: Record<string, string>; expected: string }>([
    { dependencies: { database: '17', peer: '1' }, expected: 'compatible' },
    { dependencies: { database: '17', peer: '2' }, expected: 'unknown' },
    { dependencies: { peer: '2', database: '17' }, expected: 'unknown' },
    { dependencies: { database: '17', runtime: '21' }, expected: 'unknown' },
    { dependencies: { runtime: '21', database: '18' }, expected: 'unknown' },
    { dependencies: { runtime: '20', database: '18' }, expected: 'incompatible' },
    { dependencies: {}, expected: 'unknown' },
  ])('summarizes $dependencies as $expected', ({ dependencies, expected }) => {
    const result = checkCompoundCompatibility(dataset, {
      project: 'sample',
      version: '1',
      dependencies,
    });
    expect(result.compatible).toBe(expected);
    expect(result.checks.map((check) => check.dependency)).toEqual(Object.keys(dependencies));
  });
});
