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
const partialVersionWithSuffix =
  /^v?(\d+)\.(\d+)((?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;
const underscorePrereleaseSeparator =
  /(v?\d+(?:\.\d+){1,2})_(?=(?:alpha|beta|preview|pre|rc|cr|snapshot|dev|ea|milestone|[abm])(?:[._-]?\d+)?(?:[._+-]|$))/i;

export function normalizeVersion(input: string): NormalizedVersion {
  const raw = input.trim();
  const parsableVersion = raw.replace(underscorePrereleaseSeparator, '$1-');
  const embeddedVersionText = parsableVersion.match(embeddedVersion)?.[1] ?? null;
  const versionText = parsableVersion.match(exactVersion)?.[0] ?? embeddedVersionText;
  const expandedVersionText = versionText ? expandPartialVersion(versionText) : null;
  const validVersion =
    semver.valid(parsableVersion, { loose: true }) ??
    (embeddedVersionText ? semver.valid(embeddedVersionText, { loose: true }) : null) ??
    (expandedVersionText ? semver.valid(expandedVersionText, { loose: true }) : null);
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

function expandPartialVersion(value: string): string | null {
  const match = value.match(partialVersionWithSuffix);
  if (!match || match[3] === '') {
    return null;
  }

  return `${match[1]}.${match[2]}.0${match[3]}`;
}

export function compareVersions(left: string, right: string): number {
  const normalizedLeft = normalizeVersion(left);
  const normalizedRight = normalizeVersion(right);

  if (normalizedLeft.semver && normalizedRight.semver) {
    return semver.compare(normalizedLeft.semver, normalizedRight.semver);
  }

  return normalizedLeft.normalized.localeCompare(normalizedRight.normalized);
}

export function versionsEqual(left: string, right: string): boolean {
  const normalizedLeft = normalizeVersion(left);
  const normalizedRight = normalizeVersion(right);

  if (normalizedLeft.semver && normalizedRight.semver) {
    return semver.eq(normalizedLeft.semver, normalizedRight.semver);
  }

  return normalizedLeft.normalized === normalizedRight.normalized;
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
