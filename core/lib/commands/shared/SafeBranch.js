import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import RepoConfig from '../utils/config/RepoConfig.js';

const defaultExecFileAsync = promisify(execFile);

const DIRTY_TREE_MESSAGE =
  'Error: working tree has uncommitted changes to tracked files — refusing to switch to the safe branch (would risk losing your work). Commit or discard your changes first.';

/**
 * Native equivalent of `arcanum/_lib/checkout_safe_branch.sh` /
 * `safe_branch.sh`'s `safe_branch_checkout`: parks the working tree on
 * the configured "safe" branch before any resolve/fetch work happens.
 */
class SafeBranch {
  /**
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath`).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {RepoConfig} [deps.repoConfig] - safe-branch config reader.
   */
  constructor(repoContext, {
    execFileAsync = defaultExecFileAsync,
    repoConfig = new RepoConfig()
  } = {}) {
    this._repoContext = repoContext;
    this._execFileAsync = execFileAsync;
    this._repoConfig = repoConfig;
  }

  /**
   * Native implementation of the `checkout-safe-branch` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `arcanum/_lib/checkout_safe_branch_shell.sh`: runs `#checkout`,
   * returning a `BRANCH=<branch>\n` stdout string on success. `repoPath`
   * validation (matching `repo_path_enter`'s messages/exit-1 semantics)
   * is handled upstream by `Dispatcher` via `RepoContext#validate()`.
   * Any failure (invalid path, dirty working tree) propagates uncaught,
   * per the shared hard-failure contract.
   * @returns {Promise<string>} the `BRANCH=<branch>\n` output.
   */
  async run() {
    const branch = await this.checkout();

    return `BRANCH=${branch}\n`;
  }

  /**
   * Dirty-tree hard-fail check, `git fetch -p`, then `git checkout
   * <safe branch>` — mirrors `safe_branch_checkout` exactly, including
   * its hard failure (thrown Error, no `STATUS=` line, caller exits
   * non-zero) on a dirty tracked-file working tree. Untracked files
   * never block the checkout.
   * @returns {Promise<string>} resolves with the checked-out branch
   *   once the safe branch is checked out.
   */
  async checkout() {
    const { repoPath } = this._repoContext;

    if (await this._isDirty(repoPath)) {
      throw new Error(DIRTY_TREE_MESSAGE);
    }

    await this._execFileAsync('git', ['fetch', '-p'], { cwd: repoPath });

    const branch = await this._repoConfig.getSafeBranch(repoPath);

    await this._execFileAsync('git', ['checkout', branch], { cwd: repoPath });

    return branch;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<boolean>} whether tracked files have uncommitted changes.
   */
  async _isDirty(repoPath) {
    const unstagedClean = await this._diffIsClean(repoPath, ['diff', '--quiet', '--exit-code']);
    const stagedClean = await this._diffIsClean(repoPath, ['diff', '--cached', '--quiet', '--exit-code']);

    return !unstagedClean || !stagedClean;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string[]} args - the `git diff ...` arguments to run.
   * @returns {Promise<boolean>} true when the diff reports no changes.
   */
  async _diffIsClean(repoPath, args) {
    try {
      await this._execFileAsync('git', args, { cwd: repoPath });

      return true;
    } catch (error) {
      if (error.code === 1) {
        return false;
      }

      throw error;
    }
  }
}

export default SafeBranch;
