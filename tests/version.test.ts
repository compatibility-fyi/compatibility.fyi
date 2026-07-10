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

  it('keeps hash-like versions as exact strings', () => {
    expect(versionSatisfiesRange('fe26676d', 'fe26676d')).toBe(true);
    expect(versionSatisfiesRange('fe26676d', '3fb70258')).toBe(false);
  });

  it('coerces version-like image tags', () => {
    expect(versionSatisfiesRange('distroless-v1.38.0', '1.38.0')).toBe(true);
  });

  it('preserves prerelease qualifiers', () => {
    expect(normalizeVersion('1.2.3-beta.1').semver).toBe('1.2.3-beta.1');
    expect(normalizeVersion('18.2-rc2').semver).toBe('18.2.0-rc2');
    expect(normalizeVersion('18.2_beta2').semver).toBe('18.2.0-beta2');
    expect(normalizeVersion('distroless-v1.38.0-beta.1').semver).toBe('1.38.0-beta.1');
    expect(normalizeVersion('distroless-v1.38-beta.1').semver).toBe('1.38.0-beta.1');
    expect(normalizeVersion('distroless_v1.38_beta.1').semver).toBe('1.38.0-beta.1');
  });

  it.each([
    '1.2.3-beta.1',
    '18.2-rc2',
    '18.2_alpha1',
    '18.2_beta2',
    '18.2_beta2+build.1',
    '18.2_preview1',
    '18.2_SNAPSHOT',
    '18.2_a1',
    '18.2_b1',
    '18.2_ea',
    '18.2_M1',
  ])('does not match prerelease %s against stable ranges', (version) => {
    expect(versionSatisfiesRange(version, '>=1 <19')).toBe(false);
  });

  it('still extracts stable versions from tags with non-prerelease suffixes', () => {
    expect(versionSatisfiesRange('distroless_v1.38.0_debug', '>=1 <2')).toBe(true);
  });

  it('matches partial versions as semver release lines', () => {
    expect(versionSatisfiesRange('2.11.5', '2.11')).toBe(true);
    expect(versionSatisfiesRange('17.4.1', '17')).toBe(true);
  });

  it('matches compatible ranges', () => {
    expect(versionSatisfiesRange('17', '>=15 <=17')).toBe(true);
  });

  it('rejects incompatible ranges', () => {
    expect(versionSatisfiesRange('18', '>=15 <=17')).toBe(false);
  });
});
