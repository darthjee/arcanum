import AutoFixAllGithub from './AutoFixAllGithub.js';
import AutoFixAllWaitCi from './AutoFixAllWaitCi.js';

/**
 * Native equivalent of `auto-fix-all/scripts/wait_ci_and_merge.sh`: a
 * thin orchestrator that waits for CI via `AutoFixAllWaitCi#run`, and on
 * `passed`, immediately merges via `AutoFixAllGithub#prMerge`. No new
 * CI-polling or merge logic — just composition of the two already
 * migrated native classes. See
 * docs/agents/plans/266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js/node.md.
 */
class AutoFixAllWaitCiAndMerge {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {AutoFixAllWaitCi} [deps.waitCi] - the CI-wait orchestrator.
   * @param {AutoFixAllGithub} [deps.github] - the GitHub PR orchestrator.
   */
  constructor({
    waitCi = new AutoFixAllWaitCi(),
    github = new AutoFixAllGithub()
  } = {}) {
    this._waitCi = waitCi;
    this._github = github;
  }

  /**
   * Native implementation of the `auto-fix-all-wait-ci-and-merge`
   * migrated entrypoint — byte-identical stdout/exit-code counterpart to
   * `wait_ci_and_merge.sh`. Waits for CI to complete, then merges the
   * pull request only when CI passed.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email, forwarded to `AutoFixAllGithub#prMerge`.
   * @returns {Promise<string>} `passed\n<url>\n` on a successful CI+
   *   merge, or the untouched `failed\n<name>\n...` output from
   *   `AutoFixAllWaitCi#run` when CI failed (merge never attempted).
   * @throws {Error} any error thrown by `AutoFixAllWaitCi#run` or
   *   `AutoFixAllGithub#prMerge` propagates unchanged.
   */
  async run(repoPath, modelEmail) {
    if (!repoPath) {
      throw new Error('Usage: wait_ci_and_merge.sh <repo_path> [model_email]');
    }

    const waitOutput = await this._waitCi.run(repoPath);

    if (!waitOutput.startsWith('passed')) {
      return waitOutput;
    }

    const mergeOutput = await this._github.prMerge(repoPath, modelEmail);

    return `passed\n${mergeOutput}`;
  }
}

export default AutoFixAllWaitCiAndMerge;
