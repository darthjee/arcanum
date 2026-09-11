import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';

const defaultExecFileAsync = promisify(execFile);
const TOLERATED_FETCH_FAILURE = /couldn't find remote ref|not found|no such ref/i;

/**
 * Native equivalent of `auto-fix-issue/scripts/merge_main_shell.sh`
 * combined with `arcanum/_lib/git_branch.sh`'s `git_branch_fetch_main` /
 * `git_branch_merge_main` helpers (re-derived here, not shelled out to,
 * per docs/agents/architecture/script-engine.md's "no standalone,
 * wholesale `_lib` migration" rule). Merges `origin/main` into the
 * currently checked-out issue branch. See
 * docs/agents/plans/433-migrate-auto-fix-issue-merge-main-entrypoint-to-native-node-js/node.md.
 */
class AutoFixIssueMergeMain {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
  }

  /**
   * Native implementation of the `auto-fix-issue-merge-main` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `merge_main_shell.sh`. Assumes the target issue branch is already
   * checked out (per `context: 'repo'`'s own `repoPath` validation, no
   * separate usage guard is needed here). Fetches `origin/main`
   * (tolerating a missing remote ref), then, only if
   * `refs/remotes/origin/main` exists, merges it with `--no-edit`.
   * @returns {Promise<string>} `'STATUS=ok\n'` when there's nothing to
   *   merge or the merge completed cleanly.
   * @throws {DispatchFailure} with exit code 2 when the merge conflicts —
   *   carries `'STATUS=conflict\n'` followed by `git merge`'s own
   *   (unredirected) stdout and the conflicted-file list (via `git diff
   *   --name-only --diff-filter=U`), exactly like the shell script's
   *   captured `git_branch_merge_main` output. The conflict markers are
   *   left in the working tree on purpose — `git merge --abort` is never
   *   run, matching the shell script's behavior.
   */
  async run() {
    const repoPath = this._repoContext.repoPath;

    await this._fetchTolerant(repoPath);

    if (!(await this._originMainExists(repoPath))) {
      return 'STATUS=ok\n';
    }

    try {
      await this._execFileAsync('git', ['merge', '--no-edit', 'origin/main'], { cwd: repoPath });
    } catch (error) {
      const { stdout } = await this._execFileAsync(
        'git',
        ['diff', '--name-only', '--diff-filter=U'],
        { cwd: repoPath }
      );
      const conflicts = ((error.stdout || '') + stdout).replace(/\n+$/, '');

      throw new DispatchFailure(`STATUS=conflict\n${conflicts}\n`, 2);
    }

    return 'STATUS=ok\n';
  }

  /**
   * Runs `git fetch origin main`, tolerating a missing remote ref (per
   * `TOLERATED_FETCH_FAILURE`) as a non-error. Any other failure throws,
   * mirroring `git_branch_fetch_main`'s hard-error path (propagated
   * uncaught so `dispatch()` turns it into the standard `arcanum:
   * <message>` / exit 1 path, matching the shell script's `exit 1`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<void>} resolves once the fetch succeeds or is
   *   tolerated.
   */
  async _fetchTolerant(repoPath) {
    try {
      await this._execFileAsync('git', ['fetch', 'origin', 'main'], { cwd: repoPath });
    } catch (error) {
      const stderr = error.stderr || '';

      if (TOLERATED_FETCH_FAILURE.test(stderr)) {
        return;
      }

      throw new Error(`Error: git fetch origin main failed: ${stderr.trim()}`, { cause: error });
    }
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<boolean>} whether `refs/remotes/origin/main`
   *   exists — mirrors the shell script's `git show-ref --verify --quiet
   *   refs/remotes/origin/main || return 0` no-op guard.
   */
  async _originMainExists(repoPath) {
    try {
      await this._execFileAsync('git', ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'], {
        cwd: repoPath
      });

      return true;
    } catch {
      return false;
    }
  }
}

export default AutoFixIssueMergeMain;
