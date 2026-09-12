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
   * @param {import('../../context/RepoContext.js').default} [deps.repoContext] -
   *   the target repo's context, supplying a `repoPath` fallback for
   *   `get()` when no explicit `repoPath` argument is passed.
   */
  constructor({ execFileAsync = defaultExecFileAsync, repoContext } = {}) {
    this._execFileAsync = execFileAsync;
    this._repoContext = repoContext;
  }

  /**
   * @param {string} [repoPath] - the target repo's local checkout path;
   *   falls back to `this._repoContext.repoPath` when omitted. An
   *   explicitly passed `repoPath` wins over the constructor context.
   * @returns {Promise<string>} the GitHub token.
   */
  async get(repoPath) {
    const path = repoPath ?? this._repoContext?.repoPath;

    await this._switchGhUser(path);

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
   * Native equivalent of `origin.sh`'s `get_gh_user`: the configured
   * `user.ghuser` git config value (local, falling back to global), or
   * `''` when unset at both levels. Deliberately NOT the currently
   * authenticated `gh` account's login (`gh api user`) — `monitor_pr.sh`
   * reads this raw git-config value directly for its `PR_OWNER`, so an
   * unset `user.ghuser` means "watch nobody's comments", not "watch
   * whichever account `gh auth token` currently resolves to". Exposed
   * publicly (distinct from the private `_getGhUser` used internally by
   * `_switchGhUser`) for `AutoMonitorPrMonitorPr` to resolve `PR_OWNER`.
   * @param {string} [repoPath] - the target repo's local checkout path;
   *   falls back to `this._repoContext.repoPath` when omitted.
   * @returns {Promise<string>} the configured `user.ghuser`, or `''`.
   */
  async ghUser(repoPath) {
    const path = repoPath ?? this._repoContext?.repoPath;

    return this._getGhUser(path);
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
