import { describe, expect, it } from 'vitest';
import { mergeCompatibilityDatasets } from '../src/lib/dataset';
import { parseCompatibilityYaml } from '../src/lib/validation';

describe('compatibility data validation', () => {
  it('defaults supported ranges to compatible', () => {
    const dataset = parseCompatibilityYaml(validYaml());
    expect(dataset.projects.sample.versions['1'].dependencies.runtime.status).toBe('compatible');
  });

  it.each(['latest', 'stable', 'current'])(
    'rejects the moving project version label %s',
    (version) => {
      expect(() => parseCompatibilityYaml(validYaml({ version }))).toThrow(
        'must not use moving version label',
      );
    },
  );

  it('rejects explicit compatible status', () => {
    expect(() => parseCompatibilityYaml(validYaml({ status: 'compatible' }))).toThrow(
      'status must be omitted',
    );
  });

  it('rejects invalid identifiers', () => {
    expect(() => parseCompatibilityYaml(validYaml({ dependency: '<img-onerror>' }))).toThrow(
      'lowercase-dash identifier',
    );
  });

  it('rejects invalid calendar dates', () => {
    expect(() => parseCompatibilityYaml(validYaml({ lastVerified: '2026-02-29' }))).toThrow(
      'valid calendar date',
    );
  });

  it('requires HTTP source URLs', () => {
    expect(() => parseCompatibilityYaml(validYaml({ sourceUrl: 'not-a-url' }))).toThrow(
      'valid HTTP or HTTPS URL',
    );
  });

  it('requires accessedAt evidence for medium and high confidence', () => {
    expect(() =>
      parseCompatibilityYaml(validYaml({ confidence: 'medium', accessedAt: null })),
    ).toThrow('must include an accessedAt date');
  });

  it('requires lastVerified for high confidence', () => {
    expect(() => parseCompatibilityYaml(validYaml({ lastVerified: null }))).toThrow(
      'lastVerified must include a date',
    );
  });

  it('requires filenames to match their project IDs', () => {
    const dataset = parseCompatibilityYaml(validYaml());
    expect(() => mergeCompatibilityDatasets([{ name: 'different.yaml', dataset }])).toThrow(
      'must define project "different"',
    );
  });

  it('rejects duplicate project IDs', () => {
    const dataset = parseCompatibilityYaml(validYaml());
    expect(() =>
      mergeCompatibilityDatasets([
        { name: 'first', dataset },
        { name: 'second', dataset },
      ]),
    ).toThrow('duplicate project id "sample"');
  });

  it('creates a project index without inherited property names', () => {
    const dataset = mergeCompatibilityDatasets([
      { name: 'sample.yaml', dataset: parseCompatibilityYaml(validYaml()) },
    ]);
    expect(Object.getPrototypeOf(dataset.projects)).toBeNull();
    expect(dataset.projects.toString).toBeUndefined();
  });
});

interface YamlOptions {
  projectId?: string;
  version?: string;
  dependency?: string;
  status?: string;
  confidence?: string;
  sourceUrl?: string;
  accessedAt?: string | null;
  lastVerified?: string | null;
}

function validYaml(options: YamlOptions = {}): string {
  const {
    projectId = 'sample',
    version = '1',
    dependency = 'runtime',
    status,
    confidence = 'high',
    sourceUrl = 'https://example.com/source',
    accessedAt = '2026-07-09',
    lastVerified = '2026-07-09',
  } = options;

  return `projects:
  ${projectId}:
    name: Sample
    categories: [Test]
    website: https://example.com/
    versions:
      '${version}':
        dependencies:
          ${dependency}:
            ranges: ['>=1 <2']
${status ? `            status: ${status}\n` : ''}            confidence: ${confidence}
            notes: [Verified fixture]
            sources:
              - title: Fixture
                url: ${sourceUrl}
${accessedAt ? `                accessedAt: '${accessedAt}'\n` : ''}            lastVerified: ${lastVerified ? `'${lastVerified}'` : 'null'}
`;
}
