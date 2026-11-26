import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * Refusal raised when there is no current branch (detached HEAD) —
 * byte-identical to `arcanum/_lib/push.sh`'s `require_current_branch`.
 */
export const DETACHED_HEAD_MESSAGE = 'refusing to push: no current branch (detached HEAD?)';

/**
 * All git CLI interaction shared by PR lifecycle flows — extracted from
 * `PrOperations`'s `_currentBranch` private method. Bound to a single
 * `RepoContext` at construction, mirroring `GitHubClient`/
 * `MergeBodyResolver`.
 */
class GitClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context (for `repoPath`).
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ context, execFileAsync = defaultExecFileAsync } = {}) {
    this._context = context;
    this._execFileAsync = execFileAsync;
  }

  /**
   * @returns {Promise<string>} the current branch's name.
   */
  async currentBranch() {
    const { stdout } = await this._execFileAsync('git', ['branch', '--show-current'], { cwd: this._context.repoPath });

    return stdout.trim();
  }

  /**
   * Resolves the current branch, refusing a detached HEAD — mirrors
   * `arcanum/_lib/push.sh`'s `require_current_branch`. Commit/push
   * entrypoints call it before their first side effect.
   * @returns {Promise<string>} the current branch's (non-empty) name.
   * @throws {Error} {@link DETACHED_HEAD_MESSAGE} when there is no current
   *   branch.
   */
  async requireCurrentBranch() {
    const branch = await this.currentBranch();

    if (!branch) {
      throw new Error(DETACHED_HEAD_MESSAGE);
    }

    return branch;
  }

  /**
   * Strict push of the current branch to `origin` under the same name,
   * replacing `arcanum/_lib/push.sh`'s `push_current_branch`. Refuses a
   * detached HEAD (via {@link GitClient#requireCurrentBranch}) without ever
   * running `git push` — an empty refspec would degrade to `:` and push
   * every matching branch. Any failure rejects; best-effort callers (e.g.
   * `AutoMonitorPrMonitorPr`) wrap the call in their own `try/catch`.
   * @returns {Promise<string>} `git push`'s stdout.
   * @throws {Error} on a detached HEAD or a failed `git push`.
   */
  async pushCurrentBranch() {
    const branch = await this.requireCurrentBranch();
    const { stdout } = await this._execFileAsync(
      'git', ['push', '-u', 'origin', `${branch}:${branch}`], { cwd: this._context.repoPath }
    );

    return stdout;
  }
}

export default GitClient;
