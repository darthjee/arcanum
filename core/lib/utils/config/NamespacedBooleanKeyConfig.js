import ConfigChain from '../../../../shared/lib/config/ConfigChain.js';
import KeyRegistry from '../../../../shared/lib/config/KeyRegistry.js';
import BooleanKeyConfig from './BooleanKeyConfig.js';

/**
 * Shared base for the native `config.sh` equivalents that store their
 * `true`/`false` keys under a namespace of the shared, three-tier
 * config files, re-deriving `arcanum/_lib/repo_config.sh`'s
 * `repo_config_read`/`repo_config_write` logic natively
 * (`shared/lib/config/RepoConfig.js` covers an unrelated,
 * single-tier read). Currently backs `AutoFixAllConfig` and
 * `MonitorIssuesConfig`.
 *
 * Values live under `.<namespace>.<key>` of one tier file. Writes
 * (`set`/`toggle`) target the file of the key's default tier in
 * `keys.json` (`KeyRegistry#defaultTier`, mapped to a file by
 * `ConfigChain#tierFile`): `.claude/state/arcanum-config.json` (local),
 * `.claude/configuration/arcanum-repo-config.json` (repo) or
 * `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (global). A
 * key the registry doesn't know is written to the repo file. When the
 * global file can't be resolved (no `CLAUDE_CONFIG_DIR` nor `HOME`),
 * the write is skipped with a stderr warning, exactly like the shell's
 * `global_config_write`. A key registered in `keys.json` is read through `ConfigChain`,
 * so its entry's `tiers` decide which tier files are consulted (a JSON
 * `null` there falls through, like any chain read); an unregistered key
 * is read straight from the repo file, as `repo_config_read` does.
 * Legacy per-skill files (e.g. `auto-fix-all.json`) are never read nor
 * used to seed a write. Writes are guarded by `<target file>.lock`, the
 * same lock `repo_config_write`/`global_config_write` take. The 4 subcommands, validation
 * and atomic writes come from `BooleanKeyConfig`. All paths resolve
 * under `repoPath`.
 */
class NamespacedBooleanKeyConfig extends BooleanKeyConfig {
  /**
   * @param {object} options - the namespace layout and collaborators.
   * @param {string} options.namespace - the top-level key the values
   *   live under (e.g. `auto-fix-all`).
   * @param {import('../../../../shared/lib/file/Lock.js').default} [options.lock] - the
   *   lock/mutate/release helper used to guard writes.
   * @param {KeyRegistry} [options.registry] - the key registry deciding
   *   which keys read through `configChain` and which tier each key is
   *   written to (defaults to the bundled `keys.json`).
   * @param {ConfigChain} [options.configChain] - the tier chain registered
   *   keys are read through, also mapping a tier to its file (defaults
   *   to one built on `registry`).
   */
  constructor({
    namespace, lock,
    registry = new KeyRegistry(), configChain = new ConfigChain({ registry })
  }) {
    super({ lock });
    this._namespace = namespace;
    this._registry = registry;
    this._configChain = configChain;
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string|null} `<target file>.lock`, matching
   *   `repo_config_write`/`global_config_write`, or `null` when the
   *   target file can't be resolved.
   */
  _lockFile(repoPath, key) {
    const file = this._newFileForKey(repoPath, key);

    return file === null ? null : `${file}.lock`;
  }

  /**
   * Runs `fn` under `key`'s lock, or without one when the target file
   * can't be resolved (nothing is written then, see `#_write`).
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key being written.
   * @param {() => Promise<string|void>} fn - the async mutation to run.
   * @returns {Promise<string|void>} `fn`'s result.
   */
  async _withLock(repoPath, key, fn) {
    if (this._newFileForKey(repoPath, key) === null) {
      return fn();
    }

    return super._withLock(repoPath, key, fn);
  }

  /**
   * Writes `key` = `value` to its target file, or, when that file can't
   * be resolved (a global-tier key with no `CLAUDE_CONFIG_DIR` nor
   * `HOME`), warns on stderr and writes nothing, like the shell's
   * `global_config_write`.
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<void>} resolves once written (or skipped).
   */
  async _write(repoPath, key, value) {
    if (this._newFileForKey(repoPath, key) === null) {
      process.stderr.write(
        'Warning: could not resolve a global config location (no $HOME or $CLAUDE_CONFIG_DIR)'
        + ` — '${this._namespace}.${key}' was not written.\n`
      );

      return;
    }

    await super._write(repoPath, key, value);
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to read.
   * @returns {Promise<string|undefined>} the resolved value, compact
   *   JSON-stringified exactly as `repo_config_read`'s `jq -c` output
   *   would be (e.g. the stored JSON boolean `true` reads back as the
   *   string `"true"`), or `undefined` if absent. A registered key
   *   resolves through `ConfigChain` (its `keys.json` tiers only, `null`
   *   falling through); an unregistered one through its new file only.
   */
  async _readValue(repoPath, key) {
    const value = await this._readNewValue(repoPath, key);

    return value === undefined ? undefined : JSON.stringify(value);
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to read.
   * @returns {Promise<unknown>} the raw value from the namespaced
   *   config, or `undefined` when it isn't there.
   */
  async _readNewValue(repoPath, key) {
    if (this._registry.lookup(`${this._namespace}.${key}`)) {
      return this._configChain.read(repoPath, this._namespace, key);
    }

    const newConfig = await this._readJson(this._configChain.tierFile(repoPath, 'repo'));
    const namespaceSection = newConfig[this._namespace];

    if (namespaceSection && Object.prototype.hasOwnProperty.call(namespaceSection, key)) {
      return namespaceSection[key];
    }

    return undefined;
  }

  /**
   * Read-merge step for `set`/`toggle`: sets `.<namespace>.<key>` on the
   * new file, keeping its other namespaces and keys. A missing namespace
   * starts as `{}`.
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate(repoPath, key, value) {
    const newFile = this._newFileForKey(repoPath, key);
    const base = await this._readJson(newFile);

    return {
      file: newFile,
      content: { ...base, [this._namespace]: { ...(base[this._namespace] ?? {}), [key]: value } }
    };
  }

  /**
   * @param {string} repoPath - the directory the config files resolve under.
   * @param {string} key - the config key.
   * @returns {string|null} the file `key` is written to: the file of
   *   `<namespace>.<key>`'s default tier in `keys.json`, the repo file
   *   for a key the registry doesn't know, or `null` when that tier's
   *   file can't be resolved (global with no `CLAUDE_CONFIG_DIR` nor
   *   `HOME`).
   */
  _newFileForKey(repoPath, key) {
    const tier = this._registry.defaultTier(`${this._namespace}.${key}`) ?? 'repo';

    return this._configChain.tierFile(repoPath, tier);
  }
}

export default NamespacedBooleanKeyConfig;
