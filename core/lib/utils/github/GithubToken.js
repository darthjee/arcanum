import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

const AUTH_FAILURE_MESSAGE = 'Error: could not obtain GitHub token via gh auth token';

/**
 * Native equivalent of `arcanum/_lib/origin.sh`'s `get_github_token`/
 * `_ensure_gh_user`: resolves a usable GitHub token via `gh auth
 * token`, never printing it. Every `gh`/`git` call goes through
 * `execFile` with an argument array — never a string-interpolated
 * `exec()` — since issue titles/bodies are untrusted content.
 */
class GithubToken {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor({ execFileAsync = defaultExecFileAsync } = {}) {
    this._execFileAsync = execFileAsync;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the GitHub token.
   */
  async get(repoPath) {
    await this._switchGhUser(repoPath);

    try {
      const { stdout } = await this._execFileAsync('gh', ['auth', 'token']);

      return stdout.trim();
    } catch {
      // fall through to the --hostname retry below
    }

    try {
      const { stdout } = await this._execFileAsync('gh', ['auth', 'token', '--hostname', 'github.com']);

      return stdout.trim();
    } catch {
      throw new Error(AUTH_FAILURE_MESSAGE);
    }
  }

  /**
   * Best-effort `gh auth switch --user <git config user.ghuser>`,
   * mirroring `origin.sh`'s `_ensure_gh_user`. Never fails the caller —
   * only warns on stderr.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _switchGhUser(repoPath) {
    const ghUser = await this._getGhUser(repoPath);

    if (!ghUser) {
      return;
    }

    try {
      await this._execFileAsync('gh', ['auth', 'switch', '--user', ghUser]);
    } catch {
      process.stderr.write(`Warning: gh auth switch --user ${ghUser} failed; proceeding with current gh user\n`);
    }
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the configured `user.ghuser`, or an
   *   empty string when unset at both the local and global level.
   */
  async _getGhUser(repoPath) {
    try {
      const { stdout } = await this._execFileAsync('git', ['config', 'user.ghuser'], { cwd: repoPath });
      const trimmed = stdout.trim();

      if (trimmed) {
        return trimmed;
      }
    } catch {
      // fall through to the --global lookup below
    }

    try {
      const { stdout } = await this._execFileAsync('git', ['config', '--global', 'user.ghuser']);

      return stdout.trim();
    } catch {
      return '';
    }
  }
}

export default GithubToken;
