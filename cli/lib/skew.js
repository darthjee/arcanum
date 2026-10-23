// Version skew between a tier file and the CLI (see the Version skew
// section of docs/agents/specs/arcanum-cli.md). Each tier's pointer is
// compared with the CLI's own version and with the embedded per-scope
// list of arcanum versions that shipped migrations.

import { VersionSkewError } from './exitCodes.js';
import { isMalformed } from './tierFiles.js';

/** The version a missing pointer counts as, as in `arcanum/migrations/run.sh`. */
export const NO_POINTER = '0.0.0';

const UPGRADE_HINT = 'npm i -g arcanum-cli@latest';

/**
 * @param {string} version - an `X.Y.Z` version (a suffix is ignored).
 * @returns {number[]} its numeric parts.
 */
function versionParts(version) {
  return String(version).split('.').slice(0, 3).map((part) => parseInt(part, 10) || 0);
}

/**
 * Compares two `X.Y.Z` versions numerically (`0.9.3` < `0.13.0`).
 * @param {string} a - one version.
 * @param {string} b - another version.
 * @returns {number} negative, zero or positive, as for `Array#sort`.
 */
export function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);

  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
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
 *   is newer than the CLI; `behind` with the count of `scope`'s
 *   migrations after the pointer, up to the CLI version; otherwise
 *   `up_to_date` (a pointer behind the CLI with nothing pending is up to
 *   date: only a shape change matters).
 */
export function skewStatus(version, { scope, cliVersion, migrationVersions }) {
  if (compareVersions(version, cliVersion) > 0) {
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
