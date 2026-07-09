import { describe, expect, it } from 'vitest';

import { absoluteUrl, getSeoMetadata } from '../src/lib/seo';
import type { CompatibilityDataset } from '../src/types/compatibility';

const dataset: CompatibilityDataset = {
  projects: {
    sample: {
      name: 'Sample Project',
      categories: ['Test'],
      description: 'Sample project compatibility metadata.',
      versions: {
        '2': {
          dependencies: {
            runtime: {
              status: 'compatible',
              ranges: ['>=1 <3'],
              relationship: 'runtime',
              confidence: 'high',
              notes: [],
              sources: [],
              lastVerified: '2026-07-09',
            },
          },
        },
      },
    },
  },
};

describe('seo metadata', () => {
  it('returns default home metadata for root routes', () => {
    expect(getSeoMetadata('/', dataset)).toMatchObject({
      title: 'compatibility.fyi | Open Software Compatibility Metadata',
      canonicalPath: '/',
    });
  });

  it('normalizes project canonical paths without trailing slashes', () => {
    expect(getSeoMetadata('/projects/sample/', dataset)).toMatchObject({
      title: 'Sample Project Compatibility Matrix | compatibility.fyi',
      description: 'Sample project compatibility metadata.',
      canonicalPath: '/projects/sample/',
    });
  });

  it('returns API documentation metadata', () => {
    expect(getSeoMetadata('/docs/api', dataset)).toMatchObject({
      title: 'HTTP API v1 | compatibility.fyi',
      canonicalPath: '/docs/api/',
    });
  });

  it('builds absolute compatibility.fyi URLs', () => {
    expect(absoluteUrl('/projects/sample/')).toBe('https://compatibility.fyi/projects/sample/');
  });
});
