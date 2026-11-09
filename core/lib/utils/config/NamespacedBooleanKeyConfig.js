import path from 'node:path';
import ConfigChain from '../../../../shared/lib/config/ConfigChain.js';
import KeyRegistry from '../../../../shared/lib/config/KeyRegistry.js';
import BooleanKeyConfig from './BooleanKeyConfig.js';

/**
 * Shared base for the native `config.sh` equivalents that store their
 * `true`/`false` keys under a namespace of the shared, three-tier
 * config files, re-deriving `arcanum/_lib/repo_config.sh`'s new/legacy
 * file split and `repo_config_read`/`repo_config_write` logic natively
 * (`shared/lib/config/RepoConfig.js` covers an unrelated,
 * single-tier read). Currently backs `AutoFixAllConfig` and
 * `MonitorIssuesConfig`.
 *
 * Values live under `.<namespace>.<key>` of
 * `.claude/state/arcanum-config.json` (for the namespace's state keys,
 * with no legacy fallback) or
 * `.claude/configuration/arcanum-repo-config.json` (every other key,
 * with a read fallback to — and a write-time namespace seed from — the
 * legacy `.claude/configuration/<legacyFileName>`). A key registered in
 * `keys.json` is read through `ConfigChain`, so its entry's `tiers`
 * decide which tier files are consulted (a JSON `null` there falls
 * through, like any chain read); an unregistered key is read straight
 * from its new file, as `repo_config_read` does. Either way the legacy
 * file is the last resort for non-state keys. Writes are guarded
 * by `<new file>.lock`, the same lock `repo_config_write` uses. The 4
 * subcommands, validation and atomic writes come from
 * `BooleanKeyConfig`. All paths resolve under `repoPath`.
 */
class NamespacedBooleanKeyConfig extends BooleanKeyConfig {
  /**
   * @param {object} options - the namespace layout and collaborators.
   * @param {string} options.namespace - the top-level key the values
   *   live under (e.g. `auto-fix-all`).
   * @param {Iterable<string>} options.stateKeys - the keys stored in the
   *   personal state file, with no legacy fallback.
   * @param {string} options.legacyFileName - the legacy file's name
   *   under `.claude/configuration/` (e.g. `auto-fix-all.json`).
   * @param {import('../../../../shared/lib/file/Lock.js').default} [options.lock] - the
   *   lock/mutate/release helper used to guard writes.
   * @param {KeyRegistry} [options.registry] - the key registry deciding
   *   which keys read through `configChain` (defaults to the bundled
   *   `keys.json`).
   * @param {ConfigChain} [options.configChain] - the tier chain registered
   *   keys are read through (defaults to one built on `registry`).
   */
  constructor({
    namespace, stateKeys, legacyFileName, lock,
    registry = new KeyRegistry(), configChain = new ConfigChain({ registry })
  }) {
    super({ lock });
    this._namespace = namespace;
    this._stateKeys = new Set(stateKeys);
    this._legacyFileName = legacyFileName;
    this._registry = registry;
    this._configChain = configChain;
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string} `<new file>.lock`, matching `repo_config_write`.
   */
  _lockFile(repoPath, key) {
    return `${this._newFileForKey(repoPath, key)}.lock`;
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to read.
   * @returns {Promise<string|undefined>} the resolved value, compact
   *   JSON-stringified exactly as `repo_config_read`'s `jq -c` output
   *   would be (e.g. the stored JSON boolean `true` reads back as the
   *   string `"true"`), or `undefined` if absent everywhere. A
   *   registered key resolves through `ConfigChain` (its `keys.json`
   *   tiers only, `null` falling through); an unregistered one through
   *   its new file only. Non-state keys then fall back to the legacy
   *   file.
   */
  async _readValue(repoPath, key) {
    const value = await this._readNewValue(repoPath, key);

    if (value !== undefined) {
      return JSON.stringify(value);
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
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to read.
   * @returns {Promise<unknown>} the raw value from the namespaced (non-legacy)
   *   config, or `undefined` when it isn't there.
   */
  async _readNewValue(repoPath, key) {
    if (this._registry.lookup(`${this._namespace}.${key}`)) {
      return this._configChain.read(repoPath, this._namespace, key);
    }

    const newConfig = await this._readJson(this._newFileForKey(repoPath, key));
    const namespaceSection = newConfig[this._namespace];

    if (namespaceSection && Object.prototype.hasOwnProperty.call(namespaceSection, key)) {
      return namespaceSection[key];
    }

    return undefined;
  }

  /**
   * Read-seed-merge step for `set`/`toggle`: sets `.<namespace>.<key>`
   * on the new file, seeding the namespace from the legacy file first
   * when the new file doesn't have it yet.
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate(repoPath, key, value) {
    const newFile = this._newFileForKey(repoPath, key);
    const legacyFile = this._legacyFileForKey(repoPath, key);
    const base = await this._readJson(newFile);
    let namespaceSection = base[this._namespace];

    if (namespaceSection === undefined && legacyFile !== null) {
      namespaceSection = await this._readJson(legacyFile, { requireExists: true });
    }

    return {
      file: newFile,
      content: { ...base, [this._namespace]: { ...namespaceSection, [key]: value } }
    };
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string} the new (namespaced) file that `key` should be
   *   read from/written to.
   */
  _newFileForKey(repoPath, key) {
    if (this._stateKeys.has(key)) {
      return path.join(repoPath, '.claude', 'state', 'arcanum-config.json');
    }

    return path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string|null} the legacy file that `key` should fall back
   *   to on read, or `null` when there's no legacy fallback.
   */
  _legacyFileForKey(repoPath, key) {
    if (this._stateKeys.has(key)) {
      return null;
    }

    return path.join(repoPath, '.claude', 'configuration', this._legacyFileName);
  }
}

export default NamespacedBooleanKeyConfig;
