import { describe, expect, it } from 'vitest';
import { checkCompatibility, checkCompoundCompatibility } from '../src/lib/engine';
import type { CompatibilityDataset } from '../src/types/compatibility';

const dataset: CompatibilityDataset = {
  projects: {
    sample: {
      name: 'Sample',
      categories: ['Test'],
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
            unverified: {
              status: 'unknown',
              ranges: [],
              confidence: 'medium',
              notes: ['Upstream explicitly marks this combination as unverified'],
              sources: [{ title: 'Fixture', url: 'https://example.com/unverified' }],
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

  it('returns incompatible when a known compatible dependency misses all supported ranges', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependency: 'database',
        dependencyVersion: '18',
      }),
    ).toMatchObject({
      compatible: 'incompatible',
      matchedRange: null,
      confidence: 'high',
      lastVerified: '2026-07-08',
      notes: ['Verified fixture'],
      sources: [{ title: 'Fixture', url: 'https://example.com' }],
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

  it('matches patch releases to project minor-version rows', () => {
    expect(
      checkCompatibility(dataset, {
        project: 'sample',
        version: '1.4.2',
        dependency: 'database',
        dependencyVersion: '17',
      }).compatible,
    ).toBe('compatible');
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

  it('summarizes compound checks as compatible when every dependency matches', () => {
    expect(
      checkCompoundCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependencies: {
          database: '17',
        },
      }),
    ).toMatchObject({
      compatible: 'compatible',
      checks: [expect.objectContaining({ dependency: 'database', compatible: 'compatible' })],
    });
  });

  it('summarizes compound checks as incompatible when any dependency is incompatible', () => {
    expect(
      checkCompoundCompatibility(dataset, {
        project: 'sample',
        version: '1',
        dependencies: {
          database: '18',
          runtime: '21',
        },
      }),
    ).toMatchObject({
      compatible: 'incompatible',
    });
  });
});
