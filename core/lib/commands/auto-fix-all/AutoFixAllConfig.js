import path from 'node:path';
import BooleanKeyConfig from '../../utils/config/BooleanKeyConfig.js';

const NAMESPACE = 'auto-fix-all';
const STATE_KEYS = new Set(['clear_context', 'finish_on_empty_queue']);

/**
 * Native equivalent of `auto-fix-all/scripts/config.sh`, re-deriving
 * `arcanum/_lib/repo_config.sh`'s new/legacy file split and
 * `repo_config_read`/`repo_config_write` logic natively
 * (`core/lib/utils/config/RepoConfig.js` covers an unrelated,
 * single-tier read of a different namespace). The 4 subcommands
 * (`get`, `is-enabled`, `set`, `toggle`), validation and lock-guarded
 * atomic writes come from `BooleanKeyConfig`; this class only supplies
 * the `auto-fix-all` namespace's file layout: values live under
 * `.auto-fix-all.<key>` of `.claude/state/arcanum-config.json` (for
 * `clear_context`/`finish_on_empty_queue`) or
 * `.claude/configuration/arcanum-repo-config.json` (every other key,
 * with a read fallback to — and a write-time seed from — the legacy
 * `.claude/configuration/auto-fix-all.json`).
 */
class AutoFixAllConfig extends BooleanKeyConfig {
  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key.
   * @returns {string} `<new file>.lock`, matching `repo_config_write`.
   */
  _lockFile(repoPath, key) {
    return `${this._newFileForKey(repoPath, key)}.lock`;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<string|undefined>} the resolved value, compact
   *   JSON-stringified exactly as `repo_config_read`'s `jq -c` output
   *   would be (e.g. the stored JSON boolean `true` reads back as the
   *   string `"true"`), or `undefined` if absent everywhere.
   */
  async _readValue(repoPath, key) {
    const newConfig = await this._readJson(this._newFileForKey(repoPath, key));
    const namespaceSection = newConfig[NAMESPACE];

    if (namespaceSection && Object.prototype.hasOwnProperty.call(namespaceSection, key)) {
      return JSON.stringify(namespaceSection[key]);
    }

    const legacyFile = this._legacyFileForKey(repoPath, key);

    if (legacyFile === null) {
      return undefined;
    }

    const legacyConfig = await this._readJson(legacyFile);

    if (Object.prototype.hasOwnProperty.call(legacyConfig, key)) {
      return JSON.stringify(legacyConfig[key]);
    }

    return undefined;
  }

  /**
   * Read-seed-merge step for `set`/`toggle`: sets `.auto-fix-all.<key>`
   * on the new file, seeding the namespace from the legacy file first
   * when the new file doesn't have it yet.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate(repoPath, key, value) {
    const newFile = this._newFileForKey(repoPath, key);
    const legacyFile = this._legacyFileForKey(repoPath, key);
    const base = await this._readJson(newFile);
    let namespaceSection = base[NAMESPACE];

    if (namespaceSection === undefined && legacyFile !== null) {
      namespaceSection = await this._readJson(legacyFile, { requireExists: true });
    }

    return {
      file: newFile,
      content: { ...base, [NAMESPACE]: { ...namespaceSection, [key]: value } }
    };
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key.
   * @returns {string} the new (namespaced) file that `key` should be
   *   read from/written to.
   */
  _newFileForKey(repoPath, key) {
    if (STATE_KEYS.has(key)) {
      return path.join(repoPath, '.claude', 'state', 'arcanum-config.json');
    }

    return path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key.
   * @returns {string|null} the legacy file that `key` should fall back
   *   to on read, or `null` when there's no legacy fallback.
   */
  _legacyFileForKey(repoPath, key) {
    if (STATE_KEYS.has(key)) {
      return null;
    }

    return path.join(repoPath, '.claude', 'configuration', 'auto-fix-all.json');
  }
}

export default AutoFixAllConfig;
