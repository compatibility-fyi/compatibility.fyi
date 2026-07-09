import semver from 'semver';

export interface NormalizedVersion {
  raw: string;
  normalized: string;
  semver: string | null;
}

const integerVersion = /^\d+$/;
const exactVersion = /^v?\d+(?:\.\d+){0,2}$/;
const embeddedVersion =
  /(?:^|[-_])v?(\d+(?:\.\d+){1,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)(?=$|[-_])/;

export function normalizeVersion(input: string): NormalizedVersion {
  const raw = input.trim();
  const embeddedVersionText = raw.match(embeddedVersion)?.[1] ?? null;
  const versionText = raw.match(exactVersion)?.[0] ?? embeddedVersionText;
  const validVersion =
    semver.valid(raw, { loose: true }) ??
    (embeddedVersionText ? semver.valid(embeddedVersionText, { loose: true }) : null);
  const coerced = validVersion ? null : versionText ? semver.coerce(versionText) : null;
  const semanticVersion = validVersion ?? coerced?.version ?? null;

  if (semanticVersion) {
    return {
      raw,
      normalized: integerVersion.test(raw) && coerced ? String(coerced.major) : semanticVersion,
      semver: semanticVersion,
    };
  }

  return {
    raw,
    normalized: raw.toLowerCase(),
    semver: null,
  };
}

export function compareVersions(left: string, right: string): number {
  const normalizedLeft = normalizeVersion(left);
  const normalizedRight = normalizeVersion(right);

  if (normalizedLeft.semver && normalizedRight.semver) {
    return semver.compare(normalizedLeft.semver, normalizedRight.semver);
  }

  return normalizedLeft.normalized.localeCompare(normalizedRight.normalized);
}

export function versionSatisfiesRange(version: string, range: string): boolean {
  const normalized = normalizeVersion(version);

  if (!normalized.semver) {
    return normalized.normalized === range.trim().toLowerCase();
  }

  return semver.satisfies(normalized.semver, range.trim(), {
    includePrerelease: false,
    loose: true,
  });
}
