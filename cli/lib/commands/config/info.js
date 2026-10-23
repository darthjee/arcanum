import path from 'node:path';
import { EXIT_OK } from '../../exitCodes.js';
import { formatRows } from '../../help.js';
import { pendingText, tierSkew } from '../../skew.js';
import { isMalformed, readTier, tierFile } from '../../tierFiles.js';

/** `config info`'s own flags, beyond the global ones. */
export const options = {};

/** `config info`'s positionals, in order. */
export const positionals = [];

/** Whether `config info` accepts the tier flags. */
export const acceptsTier = false;

const ACCOUNT_SOURCES = {
  flag: '(from: --claude-config-dir)',
  env: '(from: env CLAUDE_CONFIG_DIR)',
  default: '(from: default $HOME/.claude)'
};

const REPO_SOURCES = { flag: '(from: --repo)', cwd: '(from: cwd)' };

/**
 * `arcanum config info`: the CLI's environment — the resolved Claude
 * config directory and its source, the repo root, each tier file with
 * its version pointer and skew status, and the CLI and Node versions.
 * Read-only: no files created, no locks taken, no config values shown.
 * Missing targets are reported, never errors, so it always exits `0`
 * (usage errors aside).
 * @param {object} context - the subcommand context.
 * @param {object} context.output - the output helpers.
 * @param {() => Promise<object>} context.resolveTargets - resolves the account and repo.
 * @param {string} context.version - the CLI's version.
 * @param {string} context.nodeVersion - the running Node.js version.
 * @param {string} context.nodeFloor - the required Node.js range.
 * @param {object} context.migrationVersions - the per-scope migration versions.
 * @returns {Promise<number>} the exit code.
 */
export async function run(context) {
  const { output, version, nodeVersion, nodeFloor } = context;
  const targets = await context.resolveTargets();
  const skewOptions = { cliVersion: version, migrationVersions: context.migrationVersions };
  const pointers = {};
  const account = await accountInfo(targets, skewOptions, pointers);
  const repo = targets.repo.root === null ? null : await repoInfo(targets, skewOptions, pointers);
  const data = { cli: { version, node: nodeVersion, node_floor: nodeFloor }, account, repo };

  output.result(humanText(data, targets, pointers), data);

  return EXIT_OK;
}

/**
 * @param {(string|null)} file - a tier file's path.
 * @param {string} tier - its tier.
 * @param {object} skewOptions - the skew comparison inputs.
 * @param {object} pointers - collects, per tier, whether the file has a
 *   version pointer (for the human `(no pointer)` note).
 * @returns {Promise<object>} the file's `file`, `exists`, `version` and
 *   `skew` (plus `malformed: true` for a malformed file).
 */
async function fileInfo(file, tier, skewOptions, pointers) {
  const read = await readTier(file);
  const exists = read.state !== 'missing';

  if (isMalformed(read.state)) {
    return { file, exists, malformed: true, version: null, skew: null };
  }

  const skew = tierSkew(tier, read, skewOptions);

  pointers[tier] = skew.present;

  return { file, exists, version: skew.version, skew: { status: skew.status, pending: skew.pending } };
}

/**
 * @param {object} targets - the resolved targets.
 * @param {object} skewOptions - the skew comparison inputs.
 * @param {object} pointers - see `fileInfo`.
 * @returns {Promise<object>} the `account` block.
 */
async function accountInfo(targets, skewOptions, pointers) {
  const { account } = targets;

  if (account.dir === null) {
    return { claude_config_dir: null, source: 'unresolved', file: null, exists: false, version: null, skew: null };
  }

  return {
    claude_config_dir: account.dir,
    source: account.source,
    ...await fileInfo(tierFile('global', targets), 'global', skewOptions, pointers)
  };
}

/**
 * @param {object} targets - the resolved targets.
 * @param {object} skewOptions - the skew comparison inputs.
 * @param {object} pointers - see `fileInfo`.
 * @returns {Promise<object>} the `repo` block.
 */
async function repoInfo(targets, skewOptions, pointers) {
  return {
    root: targets.repo.root,
    source: targets.repo.source,
    repo_config: await fileInfo(tierFile('repo', targets), 'repo', skewOptions, pointers),
    local_config: await fileInfo(tierFile('local', targets), 'local', skewOptions, pointers)
  };
}

/**
 * @param {object} data - the info data.
 * @param {object} data.cli - the `cli` block.
 * @param {object} data.account - the `account` block.
 * @param {(object|null)} data.repo - the `repo` block.
 * @param {object} targets - the resolved targets.
 * @param {object} pointers - see `fileInfo`.
 * @returns {string} the human output.
 */
function humanText({ cli, account, repo }, targets, pointers) {
  const accountRows = account.source === 'unresolved'
    ? [['claude config dir', '(unresolved: CLAUDE_CONFIG_DIR and HOME are unset)']]
    : [
      ['claude config dir', `${account.claude_config_dir}   ${ACCOUNT_SOURCES[account.source]}`],
      ['global config', `${account.file}   ${fileState(account)}`],
      ['global version', versionText(account, pointers.global)]
    ];
  const lines = [
    `arcanum-cli ${cli.version} (node ${cli.node}, requires ${cli.node_floor})`,
    '',
    'Account',
    formatRows(accountRows),
    '',
    'Repo'
  ];

  if (repo === null) {
    lines.push(formatRows([['root', `(no repo at ${targets.repo.path})`]]));
  } else {
    const relative = (file) => path.relative(repo.root, file);

    lines.push(formatRows([
      ['root', `${repo.root}   ${REPO_SOURCES[repo.source]}`],
      ['repo config', `${relative(repo.repo_config.file)}   ${fileState(repo.repo_config)}`],
      ['repo version', versionText(repo.repo_config, pointers.repo)],
      ['local config', `${relative(repo.local_config.file)}   ${fileState(repo.local_config)}`],
      ['local version', versionText(repo.local_config, pointers.local)]
    ]));
  }

  return lines.join('\n');
}

/**
 * @param {object} info - a file block.
 * @returns {string} `[exists]`, `[missing]` or `[malformed]`.
 */
function fileState(info) {
  if (info.malformed) {
    return '[malformed]';
  }

  return info.exists ? '[exists]' : '[missing]';
}

/**
 * @param {object} info - a file block.
 * @param {boolean} hasPointer - whether the file has a version pointer.
 * @returns {string} the pointer and its skew status.
 */
function versionText(info, hasPointer) {
  if (info.malformed) {
    return 'unknown (malformed file)';
  }

  const version = hasPointer ? info.version : `${info.version} (no pointer)`;

  switch (info.skew.status) {
  case 'ahead':
    return `${version}   ahead — writes refused without --force`;
  case 'behind':
    return `${version}   behind — ${pendingText(info.skew.pending)}, run /arcanum-migrate`;
  default:
    return `${version}   up to date`;
  }
}

export default { name: 'info', options, positionals, acceptsTier, run };
