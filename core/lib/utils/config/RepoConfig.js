import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SAFE_BRANCH = 'origin/main';

/**
 * Reads single-tier config keys (no legacy-file fallback, no
 * repo/global-config chain) from a repo's own config files, matching
 * each field's shell original exactly: `git.safe_branch` from local
 * `.claude/state/arcanum-config.json` (mirroring
 * `arcanum/_lib/safe_branch.sh`'s `safe_branch_get`), and
 * `auto-fix-all.ignored_check_patterns` from
 * `.claude/configuration/arcanum-repo-config.json` (mirroring
 * `wait_ci.sh`'s own `repo_config_read` call).
 */
class RepoConfig {
  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the configured safe branch, defaulting
   *   to `"origin/main"` when absent/empty/unreadable.
   */
  async getSafeBranch(repoPath) {
    const configPath = path.join(repoPath, '.claude', 'state', 'arcanum-config.json');

    let raw;

    try {
      raw = await readFile(configPath, 'utf8');
    } catch {
      return DEFAULT_SAFE_BRANCH;
    }

    let config;

    try {
      config = JSON.parse(raw);
    } catch {
      return DEFAULT_SAFE_BRANCH;
    }

    const branch = config && config.git && config.git.safe_branch;

    return typeof branch === 'string' && branch.length > 0 ? branch : DEFAULT_SAFE_BRANCH;
  }

  /**
   * Reads the `auto-fix-all.ignored_check_patterns` config key from a
   * repo's `.claude/configuration/arcanum-repo-config.json`, mirroring
   * `wait_ci.sh`'s own read via `arcanum/_lib/repo_config.sh`'s
   * `repo_config_read ... auto-fix-all ignored_check_patterns` — a
   * different file and a namespaced key from `getSafeBranch` above, and
   * (matching the shell script's documented behavior) with no legacy
   * `.claude/configuration/auto-fix-all.json`
   * fallback attempted for this key.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<Array>} the configured array of regex-string
   *   patterns, defaulting to `[]` when the file/namespace/field is
   *   absent, unreadable, malformed, or not itself an array.
   */
  async getIgnoredCheckPatterns(repoPath) {
    const configPath = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');

    let raw;

    try {
      raw = await readFile(configPath, 'utf8');
    } catch {
      return [];
    }

    let config;

    try {
      config = JSON.parse(raw);
    } catch {
      return [];
    }

    const namespaceSection = config && config['auto-fix-all'];
    const patterns = namespaceSection && namespaceSection.ignored_check_patterns;

    return Array.isArray(patterns) ? patterns : [];
  }
}

export default RepoConfig;
