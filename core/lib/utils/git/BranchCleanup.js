import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFileAsync = promisify(execFile);

/**
 * Native equivalent of `github.sh cleanup-branch`'s local-git-only
 * branch teardown — extracted from `AutoFixAllGithub.js` (see
 * `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`),
 * which now delegates to this class as a thin facade. Makes no GitHub
 * REST calls at all (no `fetch`/`githubToken` dependency), unlike
 * `core/lib/utils/github/PrOperations.js`'s `_deleteBranchRef`.
 */
class BranchCleanup {
  /**
   * @param {import('../../context/RepoContext.js').default} [repoContext] -
   *   the target repo's context. Optional — when omitted, `cleanupBranch`
   *   requires an explicit `repoPath` argument instead.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   */
  constructor(repoContext, { execFileAsync = defaultExecFileAsync } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
  }

  /**
   * Native implementation of `github.sh cleanup-branch`: deletes the
   * issue's remote and local `issue-<id>` branch, then switches back to
   * `main` and resets it to `origin/main`. No `gh`/REST calls — plain
   * `git`, mirroring the shell version exactly, including the fact that
   * the shell script never redirects `git checkout main` (whose own
   * `Your branch is up to date with 'origin/main'.` status line prints
   * to stdout when `main` tracks `origin/main`, as it does here — its
   * `Switched to branch 'main'` line prints to stderr instead, and so
   * needs no forwarding), `git reset --hard`'s (`HEAD is now at <sha>
   * <subject>`), or `git branch -D`'s (`Deleted branch <branch> (was
   * <sha>).`) own stdout — all three leak straight through to
   * `cmd_cleanup_branch`'s own stdout, so this forwards them too, for
   * byte-identical parity. The remote-delete step tolerates failure
   * (matching the shell's `|| true`, e.g. when the remote branch is
   * already gone); every other step is not tolerant of failure.
   * @param {string} [repoPath] - the target repo's local checkout path.
   *   Falls back to the `repoContext` injected at construction when
   *   omitted; an explicit argument still takes precedence over it.
   * @param {string} id - the numeric issue id.
   * @returns {Promise<string>} the concatenated stdout of `git checkout
   *   main`, `git reset --hard origin/main`, and `git branch -D
   *   <branch>`.
   */
  async cleanupBranch(repoPath, id) {
    const effectiveRepoPath = repoPath ?? this._repoContext?.repoPath;

    if (!effectiveRepoPath || !id) {
      throw new Error('Usage: github.sh cleanup-branch <repo_path> <id>');
    }

    const branch = `issue-${id}`;

    try {
      await this._execFileAsync('git', ['push', 'origin', '--delete', branch], { cwd: effectiveRepoPath });
    } catch {
      // tolerate failure — matches the shell's `|| true`.
    }

    const { stdout: checkoutStdout } = await this._execFileAsync('git', ['checkout', 'main'], { cwd: effectiveRepoPath });
    const { stdout: resetStdout } = await this._execFileAsync('git', ['reset', '--hard', 'origin/main'], { cwd: effectiveRepoPath });
    const { stdout: branchStdout } = await this._execFileAsync('git', ['branch', '-D', branch], { cwd: effectiveRepoPath });

    return `${checkoutStdout}${resetStdout}${branchStdout}`;
  }
}

export default BranchCleanup;
