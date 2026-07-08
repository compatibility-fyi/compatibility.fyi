import { describe, expect, it } from 'vitest';
import { compareVersions, normalizeVersion, versionSatisfiesRange } from '../src/lib/version';

describe('version utilities', () => {
  it('normalizes integer versions', () => {
    expect(normalizeVersion('17')).toEqual({
      raw: '17',
      normalized: '17',
      semver: '17.0.0',
    });
  });

  it('compares semver-compatible versions', () => {
    expect(compareVersions('17', '16')).toBeGreaterThan(0);
    expect(compareVersions('1.8.0', '1.8')).toBe(0);
  });

  it('matches compatible ranges', () => {
    expect(versionSatisfiesRange('17', '>=15 <=17')).toBe(true);
  });

  it('rejects incompatible ranges', () => {
    expect(versionSatisfiesRange('18', '>=15 <=17')).toBe(false);
  });
});
