import semver from 'semver';

export interface NormalizedVersion {
  raw: string;
  normalized: string;
  semver: string | null;
}

const integerVersion = /^\d+$/;
const exactVersion = /^v?\d+(?:\.\d+){0,2}$/;
const embeddedVersion = /(?:^|[-_])v?(\d+(?:\.\d+){1,2})(?=$|[-_])/;

export function normalizeVersion(input: string): NormalizedVersion {
  const raw = input.trim();
  const versionText = raw.match(exactVersion)?.[0] ?? raw.match(embeddedVersion)?.[1] ?? null;
  const coerced = versionText ? semver.coerce(versionText) : null;

  if (coerced) {
    return {
      raw,
      normalized: integerVersion.test(raw) ? String(coerced.major) : coerced.version,
      semver: coerced.version,
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

  return semver.satisfies(normalized.semver, normalizeRange(range), {
    includePrerelease: true,
    loose: true,
  });
}

function normalizeRange(range: string): string {
  return range
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(<=|>=|<|>|=)?(.+)$/);
      if (!match) {
        return part;
      }

      const [, operator = '', value] = match;
      const normalized = normalizeVersion(value);
      return normalized.semver ? `${operator}${normalized.semver}` : part;
    })
    .join(' ');
}
