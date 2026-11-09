import ConfigChain from './ConfigChain.js';

/** `git.safe_branch`'s default, checked against keys.json by the defaults drift spec. */
export const DEFAULT_SAFE_BRANCH = 'origin/main';

/**
 * Reads two single-purpose config keys, with their defaults, through
 * `ConfigChain`: `git.safe_branch` and
 * `auto-fix-all.ignored_check_patterns`. Which tiers each key is read
 * from follows its `keys.json` entry's `tiers` (today `git.safe_branch`
 * is local-only and `ignored_check_patterns` repo-only, matching the
 * shell originals `arcanum/_lib/safe_branch.sh`'s `safe_branch_get` and
 * `wait_ci.sh`'s `repo_config_read` call). No legacy-file fallback is
 * attempted for either key.
 *
 * `repoContext` is a required constructor parameter — every method reads
 * `repoPath` from it, matching `GithubIssue.js`'s dual-mode collaborators
 * once their own fallback is dropped.
 */
class RepoConfig {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, supplying `repoPath` to every method.
   *   The `RepoContext` type reference is optional, core-only
   *   documentation — the CLI never passes a `RepoContext`, only an
   *   object carrying `repoPath` — and pulls nothing into the bundle.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {object} [deps.env] - the environment the default
   *   `ConfigChain` resolves the global tier and the strict-keys guard
   *   from (defaults to `process.env`).
   * @param {ConfigChain} [deps.configChain] - the chain every read goes
   *   through (defaults to `new ConfigChain({ env })`).
   */
  constructor(repoContext, { env = process.env, configChain = new ConfigChain({ env }) } = {}) {
    this._repoContext = repoContext;
    this._configChain = configChain;
  }

  /**
   * @returns {Promise<string>} the configured `git.safe_branch`,
   *   defaulting to `"origin/main"` when absent, empty, unreadable or
   *   set only in a tier `keys.json` does not allow.
   */
  async getSafeBranch() {
    const { repoPath } = this._repoContext;
    const branch = await this._configChain.read(repoPath, 'git', 'safe_branch');

    return typeof branch === 'string' && branch.length > 0 ? branch : DEFAULT_SAFE_BRANCH;
  }

  /**
   * Reads the `auto-fix-all.ignored_check_patterns` config key, with no
   * legacy `.claude/configuration/auto-fix-all.json` fallback (matching
   * `wait_ci.sh`'s documented behavior).
   * @returns {Promise<Array>} the configured array of regex-string
   *   patterns, defaulting to `[]` when absent, unreadable, malformed,
   *   not itself an array, or set only in a tier `keys.json` does not
   *   allow.
   */
  async getIgnoredCheckPatterns() {
    const { repoPath } = this._repoContext;
    const patterns = await this._configChain.read(repoPath, 'auto-fix-all', 'ignored_check_patterns');

    return Array.isArray(patterns) ? patterns : [];
  }
}

export default RepoConfig;
