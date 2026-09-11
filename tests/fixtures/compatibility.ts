import type { CompatibilityDataset } from '../../src/types/compatibility';

export const dataset: CompatibilityDataset = {
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
            peer: {
              status: 'compatible',
              ranges: [],
              sameVersion: true,
              confidence: 'high',
              notes: ['Must match the project version exactly'],
              sources: [{ title: 'Fixture', url: 'https://example.com/peer' }],
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
