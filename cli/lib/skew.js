// Version skew between a tier file and the CLI (see
// docs/agents/architecture/arcanum-cli.md#version-skew). Each tier's
// pointer is compared with the CLI's own version and with the embedded per-scope
// list of arcanum versions that shipped migrations.

import { VersionSkewError } from './exitCodes.js';
import { isMalformed } from './tierFiles.js';

/** The version a missing pointer counts as, as in `arcanum/migrations/run.sh`. */
export const NO_POINTER = '0.0.0';

const UPGRADE_HINT = 'npm i -g arcanum-cli@latest';

/**
 * @param {string} version - a semver version (`X.Y.Z[-prerelease][+build]`).
 * @returns {{core: number[], prerelease: string[]}} its numeric core and
 *   its prerelease identifiers (empty when none); build metadata is dropped.
 */
function parseVersion(version) {
  const withoutBuild = String(version).split('+')[0];
  const dash = withoutBuild.indexOf('-');
  const coreText = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash);
  const prereleaseText = dash === -1 ? '' : withoutBuild.slice(dash + 1);
  const core = coreText.split('.').slice(0, 3).map((part) => parseInt(part, 10) || 0);

  while (core.length < 3) {
    core.push(0);
  }

  return { core, prerelease: prereleaseText === '' ? [] : prereleaseText.split('.') };
}

const NUMERIC = /^\d+$/;

/**
 * Compares two prerelease identifiers: numeric ones numerically,
 * alphanumeric ones lexically (ASCII), numeric below alphanumeric.
 * @param {string} a - one identifier.
 * @param {string} b - another identifier.
 * @returns {number} negative, zero or positive.
 */
function compareIdentifiers(a, b) {
  const aNumeric = NUMERIC.test(a);
  const bNumeric = NUMERIC.test(b);

  if (aNumeric && bNumeric) {
    return Math.sign(Number(a) - Number(b));
  }

  if (aNumeric !== bNumeric) {
    return aNumeric ? -1 : 1;
  }

  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

/**
 * Compares two prerelease identifier lists; an empty list (a release)
 * ranks above any prerelease.
 * @param {string[]} left - one version's identifiers.
 * @param {string[]} right - another version's identifiers.
 * @returns {number} negative, zero or positive.
 */
function comparePrereleases(left, right) {
  if (left.length === 0 || right.length === 0) {
    return right.length - left.length;
  }

  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const result = compareIdentifiers(left[index], right[index]);

    if (result !== 0) {
      return result;
    }
  }

  return left.length - right.length;
}

/**
 * Compares two versions by semver precedence (`0.9.3` < `0.13.0`,
 * `2.3.0-rc.1` < `2.3.0`); build metadata is ignored.
 * @param {string} a - one version.
 * @param {string} b - another version.
 * @returns {number} negative, zero or positive, as for `Array#sort`.
 */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);

  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) {
      return left.core[index] - right.core[index];
    }
  }

  return comparePrereleases(left.prerelease, right.prerelease);
}

/**
 * Reads a tier's version pointer: `.version` for the repo tier,
 * `.migrations.version` for the local and global tiers.
 * @param {string} tier - `local`, `repo` or `global`.
 * @param {object} data - the tier's parsed content.
 * @returns {{version: string, present: boolean}} the pointer, `0.0.0`
 *   when missing (or not a string).
 */
export function pointerOf(tier, data) {
  const holder = tier === 'repo' ? data : data.migrations;
  const version = holder && typeof holder === 'object' ? holder.version : undefined;

  return typeof version === 'string' ? { version, present: true } : { version: NO_POINTER, present: false };
}

/**
 * @param {string} version - the tier's pointer.
 * @param {object} options - the comparison inputs.
 * @param {string} options.scope - the migration scope (the tier name).
 * @param {string} options.cliVersion - the CLI's version.
 * @param {object} options.migrationVersions - the per-scope migration versions.
 * @returns {{status: string, pending: number}} `ahead` when the pointer
 *   is newer than the CLI (never for `0.0.0`, a missing pointer); `behind` with the count of `scope`'s
 *   migrations after the pointer, up to the CLI version; otherwise
 *   `up_to_date` (a pointer behind the CLI with nothing pending is up to
 *   date: only a shape change matters).
 */
export function skewStatus(version, { scope, cliVersion, migrationVersions }) {
  // A missing pointer is never ahead, even of a prerelease CLI (`0.0.0-dev`).
  if (version !== NO_POINTER && compareVersions(version, cliVersion) > 0) {
    return { status: 'ahead', pending: 0 };
  }

  const pending = (migrationVersions[scope] || []).filter((migration) => (
    compareVersions(migration, version) > 0 && compareVersions(migration, cliVersion) <= 0
  )).length;

  return pending > 0 ? { status: 'behind', pending } : { status: 'up_to_date', pending: 0 };
}

/**
 * @param {string} tier - `local`, `repo` or `global`.
 * @param {{state: string, data: object}} read - the tier's `readTier` result.
 * @param {object} options - the comparison inputs.
 * @param {string} options.cliVersion - the CLI's version.
 * @param {object} options.migrationVersions - the per-scope migration versions.
 * @returns {({version: string, present: boolean, status: string, pending: number}|null)}
 *   the tier's pointer and skew, or `null` for a malformed file.
 */
export function tierSkew(tier, read, { cliVersion, migrationVersions }) {
  if (isMalformed(read.state)) {
    return null;
  }

  const pointer = pointerOf(tier, read.data);

  return { ...pointer, ...skewStatus(pointer.version, { scope: tier, cliVersion, migrationVersions }) };
}

/**
 * @param {number} count - a count of pending migrations.
 * @returns {string} e.g. `1 pending migration`, `3 pending migrations`.
 */
export function pendingText(count) {
  return `${count} pending migration${count === 1 ? '' : 's'}`;
}

/**
 * The warning a read of a skewed tier prints, if any.
 * @param {string} tier - `local`, `repo` or `global`.
 * @param {(object|null)} skew - the tier's `tierSkew` result.
 * @param {string} cliVersion - the CLI's version.
 * @returns {(string|null)} the warning, or `null` when silent.
 */
export function readWarning(tier, skew, cliVersion) {
  if (skew === null) {
    return null;
  }

  if (skew.status === 'ahead') {
    return `${tier} config is at ${skew.version}, newer than this CLI (${cliVersion}); ` +
      `keys may have moved, run ${UPGRADE_HINT}`;
  }

  if (skew.status === 'behind') {
    return `${tier} config is at ${skew.version} with ${pendingText(skew.pending)}; run /arcanum-migrate`;
  }

  return null;
}

/**
 * Refuses a write to a tier ahead of the CLI, unless `--force`.
 * @param {string} tier - `local`, `repo` or `global`.
 * @param {(object|null)} skew - the target tier's `tierSkew` result.
 * @param {object} options - the check inputs.
 * @param {string} options.cliVersion - the CLI's version.
 * @param {boolean} options.force - `--force`.
 * @returns {boolean} whether `--force` bypassed a refusal.
 * @throws {VersionSkewError} (exit `5`) when the tier is ahead and
 *   `--force` was not passed.
 */
export function checkWriteSkew(tier, skew, { cliVersion, force }) {
  if (skew === null || skew.status !== 'ahead') {
    return false;
  }

  if (!force) {
    throw new VersionSkewError(`${tier} config is at ${skew.version}, newer than this CLI (${cliVersion})`, {
      hint: `${UPGRADE_HINT}, or pass --force`
    });
  }

  return true;
}
