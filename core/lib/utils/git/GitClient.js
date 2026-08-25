import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * All git CLI interaction shared by PR lifecycle flows — extracted from
 * `PrOperations`'s `_currentBranch` private method. Unlike `RepoContext`,
 * it doesn't carry a `repoPath` of its own: `repoPath` comes in as a
 * method parameter on each call, so a single `GitClient` instance stays
 * reusable across every repo, outside PR flows too.
 */
class GitClient {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the current branch's name.
   */
  async currentBranch(repoPath) {
    const { stdout } = await this._execFileAsync('git', ['branch', '--show-current'], { cwd: repoPath });

    return stdout.trim();
  }
}

export default GitClient;
