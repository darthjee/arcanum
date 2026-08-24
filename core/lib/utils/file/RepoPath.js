import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * Native equivalent of `arcanum/_lib/repo_path.sh`'s `repo_path_enter`
 * validation half (this module never `cd`s — native commands pass
 * `cwd`/`repoPath` explicitly instead). Validates that a `repoPath`
 * argument is present, points at a directory, and is a git repository
 * (or worktree), throwing with the exact matching shell error message
 * (see docs/agents/plans/233-migrate-checkout-safe-branch-entrypoint-to-native-node-js/plan.md's
 * "Shared contracts") when any check fails.
 */
class RepoPath {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * @param {string} repoPath - the candidate repo path to validate.
   * @returns {Promise<void>} resolves silently when `repoPath` is a
   *   valid git repository; otherwise throws an `Error` mirroring
   *   `repo_path_enter`'s messages exactly.
   */
  async validate(repoPath) {
    if (!repoPath) {
      throw new Error('Error: repo_path is required');
    }

    if (!(await this._isDirectory(repoPath))) {
      throw new Error(`Error: not a directory: ${repoPath}`);
    }

    if (!(await this._isGitRepository(repoPath))) {
      throw new Error(`Error: not a git repository: ${repoPath}`);
    }
  }

  /**
   * @param {string} repoPath - the candidate repo path.
   * @returns {Promise<boolean>} whether `repoPath` exists and is a directory.
   */
  async _isDirectory(repoPath) {
    try {
      const stats = await stat(repoPath);

      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @param {string} repoPath - the candidate repo path.
   * @returns {Promise<boolean>} whether `git -C <repoPath> rev-parse
   *   --git-dir` succeeds.
   */
  async _isGitRepository(repoPath) {
    try {
      await this._execFileAsync('git', ['-C', repoPath, 'rev-parse', '--git-dir']);

      return true;
    } catch {
      return false;
    }
  }
}

export default RepoPath;
