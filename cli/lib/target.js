// Targeting: which Claude config directory (account) and which repo a
// command reads and writes (see the Targeting section of
// docs/agents/specs/arcanum-cli.md and
// docs/agents/specs/arcanum-cli/command-surface.md#--repo-normalization).

import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import RepoPath from '../../shared/lib/file/RepoPath.js';
import { UsageError } from './exitCodes.js';

const execFileAsync = promisify(execFile);

/**
 * Resolves the Claude config directory. `--claude-config-dir` wins and
 * has a leading `~`/`~/` expanded (`~user` is refused); otherwise
 * `CLAUDE_CONFIG_DIR` is used verbatim (an empty value counts as unset,
 * and a leading `~` only raises a warning, matching `ConfigChain`);
 * otherwise `$HOME/.claude`.
 * @param {object} args - the resolution inputs.
 * @param {(string|undefined)} args.flag - `--claude-config-dir`, if given.
 * @param {object} args.env - the environment.
 * @param {string} args.cwd - the working directory relative paths resolve against.
 * @param {(message: string) => void} args.warn - prints a stderr warning.
 * @returns {Promise<{dir: (string|null), source: string, state: string}>}
 *   the absolute directory (`null` when unresolved), its source (`flag`,
 *   `env`, `default` or `unresolved`) and its state (`ok`, `missing`,
 *   `not_directory` or `unresolved`).
 * @throws {UsageError} for a `--claude-config-dir` that is empty, uses
 *   `~user`, needs `$HOME` that is unset, or does not name an existing
 *   directory.
 */
export async function resolveClaudeConfigDir({ flag, env, cwd, warn }) {
  if (flag !== undefined) {
    const dir = path.resolve(cwd, expandHome(flag, env));
    const state = await dirState(dir);

    if (state === 'missing') {
      throw new UsageError(`--claude-config-dir: no such directory: ${dir}`);
    }

    if (state === 'not_directory') {
      throw new UsageError(`--claude-config-dir: not a directory: ${dir}`);
    }

    return { dir, source: 'flag', state };
  }

  if (env.CLAUDE_CONFIG_DIR) {
    if (env.CLAUDE_CONFIG_DIR.startsWith('~')) {
      warn(`CLAUDE_CONFIG_DIR=${env.CLAUDE_CONFIG_DIR} starts with '~', which is not expanded; ` +
        'arcanum and Claude Code use it verbatim');
    }

    const dir = path.resolve(cwd, env.CLAUDE_CONFIG_DIR);

    return { dir, source: 'env', state: await dirState(dir) };
  }

  if (env.HOME) {
    const dir = path.join(env.HOME, '.claude');

    return { dir, source: 'default', state: await dirState(dir) };
  }

  return { dir: null, source: 'unresolved', state: 'unresolved' };
}

/**
 * @param {string} value - a `--claude-config-dir` value.
 * @param {object} env - the environment.
 * @returns {string} the value with a leading `~` or `~/` expanded.
 * @throws {UsageError} on an empty value, `~user`, or `~` with no `$HOME`.
 */
export function expandHome(value, env) {
  if (value === '') {
    throw new UsageError('--claude-config-dir needs a path');
  }

  if (!value.startsWith('~')) {
    return value;
  }

  if (value !== '~' && !value.startsWith('~/')) {
    throw new UsageError(`--claude-config-dir: '~user' paths are not supported: ${value}`);
  }

  if (!env.HOME) {
    throw new UsageError(`--claude-config-dir: cannot expand '~' with HOME unset: ${value}`);
  }

  return path.join(env.HOME, value.slice(1));
}

/**
 * @param {string} dir - an absolute path.
 * @returns {Promise<string>} `ok` for a directory, `not_directory` for
 *   anything else that exists, `missing` otherwise.
 */
async function dirState(dir) {
  try {
    return (await stat(dir)).isDirectory() ? 'ok' : 'not_directory';
  } catch {
    return 'missing';
  }
}

/**
 * Resolves the target repo: the `--repo <path>` targeting flag or the
 * current directory, normalized to its git toplevel through `RepoPath`.
 * A worktree resolves to its own root. "No repo" (not a repo, a bare
 * repo, or no `git` on PATH, the last with a warning) is a result, not
 * an error: whether it matters depends on the command.
 * @param {object} args - the resolution inputs.
 * @param {(string|undefined)} args.flag - the `--repo <path>` targeting path, if given.
 * @param {string} args.cwd - the working directory.
 * @param {(message: string) => void} args.warn - prints a stderr warning.
 * @param {(file: string, args: string[]) => Promise<{stdout: string}>} [args.execFileAsync] - promisified `execFile`, injectable for testing.
 * @returns {Promise<{root: (string|null), source: string, path: string, configured: boolean}>}
 *   the repo root (`null` for no repo), its source (`flag` or `cwd`), the
 *   path that was resolved, and whether the repo is arcanum-configured.
 * @throws {UsageError} for a targeting path that does not exist or is
 *   not a directory, with `RepoPath`'s message.
 */
export async function resolveRepo({ flag, cwd, warn, execFileAsync: exec = execFileAsync }) {
  let gitMissing = false;
  const tracked = async (...args) => {
    try {
      return await exec(...args);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        gitMissing = true;
      }

      throw error;
    }
  };
  const repoPath = new RepoPath({ execFileAsync: tracked });
  const source = flag === undefined ? 'cwd' : 'flag';
  const target = flag === undefined ? cwd : path.resolve(cwd, flag);

  if (flag !== undefined) {
    try {
      await repoPath.validate(target);
    } catch (error) {
      if (/not a directory/.test(error.message)) {
        throw new UsageError(error.message.replace(/^Error: /, ''));
      }
    }
  }

  let root;

  try {
    root = await repoPath.toplevel(target);
  } catch {
    root = null;
  }

  if (gitMissing) {
    warn('git not found on PATH; the repo and local tiers are unavailable');
  }

  return { root, source, path: target, configured: root !== null && await isConfigured(root) };
}

/**
 * @param {string} root - a repo root.
 * @returns {Promise<boolean>} whether its committed repo config file exists.
 */
async function isConfigured(root) {
  try {
    return (await stat(path.join(root, '.claude', 'configuration', 'arcanum-repo-config.json'))).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves both targets for one invocation.
 * @param {object} args - the resolution inputs.
 * @param {(string|undefined)} args.claudeConfigDir - `--claude-config-dir`, if given.
 * @param {(string|undefined)} args.repo - the `--repo <path>` targeting path, if given.
 * @param {object} args.env - the environment.
 * @param {string} args.cwd - the working directory.
 * @param {(message: string) => void} args.warn - prints a stderr warning.
 * @param {(file: string, args: string[]) => Promise<{stdout: string}>} [args.execFileAsync] - promisified `execFile`, injectable for testing.
 * @returns {Promise<{account: object, repo: object}>} the resolved account and repo.
 */
export async function resolveTargets({ claudeConfigDir, repo, env, cwd, warn, execFileAsync: exec }) {
  const account = await resolveClaudeConfigDir({ flag: claudeConfigDir, env, cwd, warn });
  const repoTarget = await resolveRepo({ flag: repo, cwd, warn, execFileAsync: exec });

  return { account, repo: repoTarget };
}
