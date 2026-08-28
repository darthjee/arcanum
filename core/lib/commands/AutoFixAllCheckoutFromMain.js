import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import RepoPath from '../utils/file/RepoPath.js';

const defaultExecFileAsync = promisify(execFile);
const USAGE = 'Usage: checkout_from_main.sh <repo_path> <id>';
const TOLERATED_FETCH_FAILURE = /couldn't find remote ref|not found|no such ref/i;

/**
 * Native equivalent of `auto-fix-all/scripts/checkout_from_main.sh`
 * combined with `arcanum/_lib/git_branch.sh`'s fetch/merge helpers
 * (re-derived here, not shelled out to, per
 * docs/agents/architecture/script-engine.md's "No standalone, wholesale
 * `_lib` migration" rule). Bootstraps or reuses the branch for an issue,
 * merged up to date with `origin/main`.
 */
class AutoFixAllCheckoutFromMain {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {RepoPath} [deps.repoPath] - repo-path validation helper.
   */
  constructor(repoContext, { execFileAsync = defaultExecFileAsync, repoPath = new RepoPath({ execFileAsync }) } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._repoPath = repoPath;
  }

  /**
   * Native implementation of the `auto-fix-all-checkout-from-main`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `auto-fix-all/scripts/checkout_from_main.sh`: fetches `origin/main`
   * and `origin/issue-<id>` (tolerating a missing remote ref for
   * either), reuses `issue-<id>` (local or remote) merged up to date
   * with `origin/main` when it already exists, or creates it fresh from
   * `origin/main` (falling back to local `main`) otherwise.
   * @param {string} id - the issue's numeric id.
   * @returns {Promise<string>} the `BRANCH=<branch>\nSTATUS=ok\n` output,
   *   prefixed with any incidental `git checkout` stdout (e.g. a branch
   *   "set up to track" line), matching the unredirected shell script.
   * @throws {DispatchFailure} with exit code 2 when the merge against
   *   `origin/main` conflicts — carries the `BRANCH=...\nSTATUS=conflict\n`
   *   payload, followed by the merge's own conflict messages and the
   *   conflicted-file list, exactly like the shell script's captured
   *   `git_branch_merge_main` output.
   */
  async run(id) {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath || !id) {
      throw new Error(USAGE);
    }

    await this._repoPath.validate(repoPath);

    const branch = `issue-${id}`;

    await this._fetchTolerant('main');
    await this._fetchTolerant(branch);

    const localExists = await this._refExists(`refs/heads/${branch}`);
    const remoteExists = await this._refExists(`refs/remotes/origin/${branch}`);

    let status = 'ok';
    let conflicts = '';
    let checkoutOutput;

    if (localExists || remoteExists) {
      if (localExists) {
        checkoutOutput = (await this._execFileAsync('git', ['checkout', branch], { cwd: repoPath })).stdout;
      } else {
        checkoutOutput = (
          await this._execFileAsync('git', ['checkout', '-b', branch, `origin/${branch}`], { cwd: repoPath })
        ).stdout;
      }

      await this._fetchTolerant('main');

      if (await this._refExists('refs/remotes/origin/main')) {
        try {
          await this._execFileAsync('git', ['merge', '--no-edit', 'origin/main'], { cwd: repoPath });
        } catch (error) {
          status = 'conflict';
          const { stdout } = await this._execFileAsync(
            'git',
            ['diff', '--name-only', '--diff-filter=U'],
            { cwd: repoPath }
          );
          conflicts = (error.stdout || '') + stdout;
        }
      }
    } else if (await this._refExists('refs/remotes/origin/main')) {
      checkoutOutput = (
        await this._execFileAsync('git', ['checkout', '-b', branch, 'origin/main'], { cwd: repoPath })
      ).stdout;
    } else {
      checkoutOutput = (await this._execFileAsync('git', ['checkout', '-b', branch, 'main'], { cwd: repoPath })).stdout;
    }

    // `git checkout`'s own stdout (e.g. the "branch '<name>' set up to
    // track '<upstream>'." line git prints — to stdout, not stderr —
    // when creating a branch from a remote-tracking start point) isn't
    // captured/redirected by the shell script, so it streams straight
    // to the real stdout before the BRANCH=/STATUS= lines below. Mirror
    // that by prepending it here instead of discarding it.
    let output = `${checkoutOutput}BRANCH=${branch}\nSTATUS=${status}\n`;

    if (status === 'conflict') {
      output += `${conflicts.replace(/\n*$/, '')}\n`;
      throw new DispatchFailure(output, 2);
    }

    return output;
  }

  /**
   * Runs `git fetch origin <ref>`, tolerating a missing remote ref (per
   * `TOLERATED_FETCH_FAILURE`) as a non-error. Any other failure throws,
   * matching `git_branch_fetch_main`'s (and the inline branch-fetch
   * block's) two distinct messages.
   * @param {string} ref - the remote ref to fetch (`main` or `issue-<id>`).
   * @returns {Promise<void>} resolves once the fetch succeeds or is
   *   tolerated.
   */
  async _fetchTolerant(ref) {
    try {
      await this._execFileAsync('git', ['fetch', 'origin', ref], { cwd: this._repoContext.repoPath });
    } catch (error) {
      const stderr = error.stderr || '';

      if (TOLERATED_FETCH_FAILURE.test(stderr)) {
        return;
      }

      throw new Error(`Error: git fetch origin ${ref} failed: ${stderr.trim()}`, { cause: error });
    }
  }

  /**
   * @param {string} ref - the ref to check, e.g. `refs/heads/issue-1`.
   * @returns {Promise<boolean>} whether `ref` exists.
   */
  async _refExists(ref) {
    try {
      await this._execFileAsync('git', ['show-ref', '--verify', '--quiet', ref], { cwd: this._repoContext.repoPath });

      return true;
    } catch (error) {
      if (error.code === 1) {
        return false;
      }

      throw error;
    }
  }
}

export default AutoFixAllCheckoutFromMain;
