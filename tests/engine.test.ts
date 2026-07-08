import { describe, expect, it } from 'vitest';
import { checkCompatibility } from '../src/lib/engine';
import type { CompatibilityDataset } from '../src/types/compatibility';

const dataset: CompatibilityDataset = {
  projects: {
    sample: {
      name: 'Sample',
      versions: {
        '1': {
          dependencies: {
            database: {
              status: 'compatible',
              ranges: ['>=15 <=17'],
              confidence: 'high',
              notes: ['Verified fixture'],
              sources: [{ title: 'Fixture', url: 'https://example.com' }],
              lastVerified: '2026-07-08',
            },
            runtime: {
              status: 'incompatible',
              ranges: ['<21'],
              confidence: 'medium',
              notes: ['Fixture incompatibility'],
              sources: [{ title: 'Fixture', url: 'https://example.com/runtime' }],
              lastVerified: '2026-07-08',
            },
          },
        },
      },
    },
  },
};

describe('compatibility engine', () => {
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
});
