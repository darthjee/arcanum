import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SAFE_BRANCH = 'origin/main';

/**
 * Reads the `git.safe_branch` config key from a repo's local
 * `.claude/state/arcanum-config.json`, mirroring
 * `arcanum/_lib/safe_branch.sh`'s `safe_branch_get` — a single-tier
 * read (no legacy-file fallback, no repo/global-config chain), matching
 * the shell original exactly.
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
}

export default RepoConfig;
