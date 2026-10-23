// Helpers shared by the `arcanum config` subcommand modules: resolving
// the targets a read needs and reading its tier files.

import path from 'node:path';
import { EXIT_ERROR, TargetUnavailableError } from '../../exitCodes.js';
import { readWarning, tierSkew } from '../../skew.js';
import { TIERS, readTierTolerant, tierFile } from '../../tierFiles.js';

/**
 * Placeholder for a subcommand whose behaviour is not implemented yet.
 * @param {string} name - the subcommand name.
 * @param {object} context - the parsed invocation.
 * @param {{stderr: {write: (text: string) => void}}} context.io - output streams.
 * @returns {number} `EXIT_ERROR`.
 */
export function notImplemented(name, { io }) {
  io.stderr.write(`arcanum: config ${name} is not implemented yet\n`);

  return EXIT_ERROR;
}

/**
 * @param {{path: string}} repo - the resolved repo target.
 * @returns {TargetUnavailableError} the "no repo" refusal for an explicit
 *   `--repo`/`--local`.
 */
export function noRepoError(repo) {
  return new TargetUnavailableError(`no repo at ${repo.path}; --repo and --local need a git repo`);
}

/**
 * Checks the account for a read of the global tier: an unresolved or
 * missing directory reads as an empty tier with a warning; a path that
 * is not a directory is an error.
 * @param {{dir: (string|null), state: string}} account - the resolved account.
 * @param {(message: string) => void} warn - prints a stderr warning.
 * @throws {TargetUnavailableError} when the path is not a directory.
 */
export function checkAccountForRead(account, warn) {
  if (account.state === 'unresolved') {
    warn('no claude config dir resolved (CLAUDE_CONFIG_DIR and HOME are unset); the global tier is empty');
  } else if (account.state === 'missing') {
    warn(`claude config dir ${account.dir} does not exist; the global tier is empty`);
  } else if (account.state === 'not_directory') {
    throw new TargetUnavailableError(`claude config dir ${account.dir} is not a directory`);
  }
}

/**
 * Resolves the targets for a read and reads the tiers it covers: the
 * given tier, or every tier that has a target (local → repo → global).
 * With no tier and no repo, only the global tier is read, with a note.
 * Malformed files warn and read as empty; a tier ahead of the CLI, or
 * behind it with migrations pending, warns too.
 * @param {object} context - the subcommand context.
 * @param {(string|undefined)} context.tier - the tier flag, if any.
 * @param {() => Promise<object>} context.resolveTargets - resolves the account and repo.
 * @param {(message: string) => void} context.warn - prints a stderr warning.
 * @param {string} context.version - the CLI's version.
 * @param {object} context.migrationVersions - the per-scope migration versions.
 * @param {object} [options] - read options.
 * @param {boolean} [options.allTiers] - report every tier, a tier with
 *   no target included (with `file: null`).
 * @returns {Promise<{targets: object, tiers: Array<{tier: string, file: (string|null), read: object}>}>}
 *   the resolved targets and the tiers read, in resolution order.
 * @throws {TargetUnavailableError} for an explicit `--repo`/`--local`
 *   with no repo, or a Claude config dir that is not a directory.
 */
export async function readTiers(context, { allTiers = false } = {}) {
  const { tier, resolveTargets, warn, version, migrationVersions } = context;
  const targets = await resolveTargets();
  const { repo, account } = targets;

  if (tier !== undefined && tier !== 'global' && repo.root === null) {
    throw noRepoError(repo);
  }

  if (tier === undefined && repo.root === null) {
    warn(`no repo at ${repo.path}; reading the global tier only`);
  }

  const wanted = tier === undefined ? TIERS : [tier];

  if (wanted.includes('global')) {
    checkAccountForRead(account, warn);
  }

  const tiers = [];

  for (const name of wanted) {
    const file = tierFile(name, targets);

    if (file === null && !allTiers) {
      continue;
    }

    const read = await readTierTolerant(file, warn);

    if (read.state === 'ok') {
      const warning = readWarning(name, tierSkew(name, read, { cliVersion: version, migrationVersions }), version);

      if (warning !== null) {
        warn(warning);
      }
    }

    tiers.push({ tier: name, file, read });
  }

  return { targets, tiers };
}

/**
 * @param {string} tier - the tier.
 * @param {(string|null)} file - its file.
 * @param {{repo: {root: (string|null)}}} targets - the resolved targets.
 * @returns {string} the file for human output: repo-relative for the
 *   repo and local tiers, absolute for the global one.
 */
export function displayFile(tier, file, { repo }) {
  if (file === null) {
    return '-';
  }

  return tier === 'global' || repo.root === null ? file : path.relative(repo.root, file);
}

/**
 * @param {(object|null)} entry - a registry entry.
 * @returns {unknown} its default, or `null` when it has none.
 */
export function registryDefault(entry) {
  return entry && Object.hasOwn(entry, 'default') ? entry.default : null;
}
