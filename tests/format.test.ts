import { describe, expect, it } from 'vitest';

import { formatDependencyName, formatRange } from '../src/lib/format';

describe('display formatting', () => {
  it('formats dependency identifiers', () => {
    expect(formatDependencyName('postgresql')).toBe('PostgreSQL');
    expect(formatDependencyName('amazon-aurora-postgresql')).toBe('Amazon Aurora PostgreSQL');
  });

  it('formats common compatibility ranges without changing their meaning', () => {
    expect(formatRange('>=14.0.0 <15.0.0')).toBe('14.x');
    expect(formatRange('>=10.11.0 <10.12.0')).toBe('10.11.x');
    expect(formatRange('>=19.3.0 <20.0.0')).toBe('19.3+');
    expect(formatRange('>=14 <19')).toBe('>=14 <19');
  });
});
