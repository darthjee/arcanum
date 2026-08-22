import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SAFE_BRANCH = 'origin/main';
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_ERROR_SLEEP_TIME = 5;

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

  /**
   * Reads the `plan-issues.max-retry-count` and
   * `plan-issues.error-sleep-time` config keys from a repo's local
   * `.claude/state/arcanum-config.json`, mirroring `spawn_issue.sh`'s
   * own reads of the same keys via `repo_config_read` — the same
   * single-tier read/parse/default-fallback shape `getSafeBranch` uses
   * (missing file, unreadable, malformed JSON, or a missing/non-numeric
   * key all fall back to the defaults below, never throw).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<{maxRetryCount: number, errorSleepTime: number}>}
   *   the configured retry tuning, defaulting to `{ maxRetryCount: 5,
   *   errorSleepTime: 5 }` when absent/malformed.
   */
  async getPlanIssuesRetryConfig(repoPath) {
    const defaults = { maxRetryCount: DEFAULT_MAX_RETRY_COUNT, errorSleepTime: DEFAULT_ERROR_SLEEP_TIME };
    const configPath = path.join(repoPath, '.claude', 'state', 'arcanum-config.json');

    let raw;

    try {
      raw = await readFile(configPath, 'utf8');
    } catch {
      return defaults;
    }

    let config;

    try {
      config = JSON.parse(raw);
    } catch {
      return defaults;
    }

    const section = config && config['plan-issues'];

    return {
      maxRetryCount: this._numberOrDefault(section && section['max-retry-count'], DEFAULT_MAX_RETRY_COUNT),
      errorSleepTime: this._numberOrDefault(section && section['error-sleep-time'], DEFAULT_ERROR_SLEEP_TIME)
    };
  }

  /**
   * Coerce a raw config value (a number, a numeric string, or anything
   * else) into a number, falling back to `fallback` when it can't be
   * parsed as a finite number — mirrors the shell's
   * `[[ -n "$max_retry" ]] || max_retry=5` default-on-empty behavior,
   * extended to also default on a non-numeric value.
   * @param {*} value - the raw config value.
   * @param {number} fallback - the default to use when unparseable.
   * @returns {number} the parsed number, or `fallback`.
   */
  _numberOrDefault(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }
}

export default RepoConfig;
