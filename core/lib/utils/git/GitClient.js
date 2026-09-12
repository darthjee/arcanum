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

  /**
   * Best-effort push of the current branch to `origin`, replacing
   * `arcanum/_lib/push.sh`'s `push_current_branch` — every caller of the
   * shell function tolerates any failure (`push_current_branch 2>/dev/null
   * || true`), so this never throws either. Native's `execFile` never
   * forwards the child's stdout to this process's own stdout (unlike the
   * shell's own stderr-only redirect), so there is no risk of `git
   * push`'s own output leaking into a caller's stdout contract.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async pushCurrentBranch() {
    try {
      const branch = await this.currentBranch();

      await this._execFileAsync('git', ['push', '-u', 'origin', `${branch}:${branch}`], { cwd: this._context.repoPath });
    } catch {
      // best-effort — tolerate any failure, matching push_current_branch's callers.
    }
  }
}

export default GitClient;
