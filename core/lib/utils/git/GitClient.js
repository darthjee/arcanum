import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

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
}

export default GitClient;
