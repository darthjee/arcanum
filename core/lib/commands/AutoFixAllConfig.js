import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../utils/errors/DispatchFailure.js';
import Lock from '../utils/file/Lock.js';

const NAMESPACE = 'auto-fix-all';
const STATE_KEYS = new Set(['clear_context', 'finish_on_empty_queue']);
const DEFAULT_VALUE = 'false';

/**
 * Native equivalent of `auto-fix-all/scripts/config.sh`, re-deriving
 * `arcanum/_lib/repo_config.sh`'s new/legacy file split and
 * `repo_config_read`/`repo_config_write` logic natively — no shared
 * native helper exists for this yet (`core/lib/RepoConfig.js` covers an
 * unrelated, single-tier read of a different namespace). Implements the
 * 4 subcommands (`get`, `is-enabled`, `set`, `toggle`) of the
 * `auto-fix-all` config namespace.
 */
class AutoFixAllConfig {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper used to
   *   guard writes.
   */
  constructor({ lock = new Lock() } = {}) {
    this._lock = lock;
  }

  /**
   * Native implementation of `config.sh get <key>`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<string>} `<value>\n`, defaulting to `"false\n"`
   *   when absent everywhere.
   */
  async get(repoPath, key) {
    const value = await this._resolve(repoPath, key);

    return `${value}\n`;
  }

  /**
   * Native implementation of `config.sh is-enabled <key>`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<void>} resolves (no stdout) when the resolved
   *   value is `"true"`.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the resolved value is not `"true"`.
   */
  async isEnabled(repoPath, key) {
    const value = await this._resolve(repoPath, key);

    if (value !== 'true') {
      throw new DispatchFailure('', 1);
    }
  }

  /**
   * Native implementation of `config.sh set <key> <value>`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to write.
   * @param {string} value - the value to write (`"true"` or `"false"`).
   * @returns {Promise<void>} resolves once the value has been written.
   * @throws {Error} when `key`/`value` is missing, or `value` isn't
   *   exactly `"true"`/`"false"`.
   */
  async set(repoPath, key, value) {
    if (key === undefined || value === undefined) {
      throw new Error('Error: set requires a key and a value (true|false)');
    }

    if (value !== 'true' && value !== 'false') {
      throw new Error('Error: value must be \'true\' or \'false\'');
    }

    const newFile = this._newFileForKey(repoPath, key);
    const legacyFile = this._legacyFileForKey(repoPath, key);

    await this._write(newFile, legacyFile, key, value);
  }

  /**
   * Native implementation of `config.sh toggle <key>`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to toggle.
   * @returns {Promise<string>} `<new_value>\n`, the flipped value.
   */
  async toggle(repoPath, key) {
    const current = await this._resolve(repoPath, key);
    const newValue = current === 'true' ? 'false' : 'true';
    const newFile = this._newFileForKey(repoPath, key);
    const legacyFile = this._legacyFileForKey(repoPath, key);

    await this._write(newFile, legacyFile, key, newValue);

    return `${newValue}\n`;
  }

  /**
   * Resolves `key`'s current value (new file, then legacy file,
   * defaulting to `"false"`), mirroring the shell's `VALUE="${VALUE:-false}"`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<string>} the resolved value.
   */
  async _resolve(repoPath, key) {
    const newFile = this._newFileForKey(repoPath, key);
    const legacyFile = this._legacyFileForKey(repoPath, key);
    const value = await this._read(newFile, legacyFile, key);

    return value === undefined ? DEFAULT_VALUE : value;
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

  /**
   * @param {string} newFile - the new (namespaced) config file's path.
   * @param {string|null} legacyFile - the legacy config file's path,
   *   or `null` when there's no legacy fallback.
   * @param {string} key - the config key to read.
   * @returns {Promise<string|undefined>} the resolved value, compact
   *   JSON-stringified exactly as `repo_config_read`'s `jq -c` output
   *   would be (e.g. the stored JSON boolean `true` reads back as the
   *   string `"true"`), or `undefined` if absent everywhere.
   */
  async _read(newFile, legacyFile, key) {
    const newConfig = await this._readJson(newFile);
    const namespaceSection = newConfig && newConfig[NAMESPACE];

    if (namespaceSection && Object.prototype.hasOwnProperty.call(namespaceSection, key)) {
      return JSON.stringify(namespaceSection[key]);
    }

    if (legacyFile === null) {
      return undefined;
    }

    const legacyConfig = await this._readJson(legacyFile);

    if (legacyConfig && Object.prototype.hasOwnProperty.call(legacyConfig, key)) {
      return JSON.stringify(legacyConfig[key]);
    }

    return undefined;
  }

  /**
   * Lock-protected read-seed-merge-write step for `set`/`toggle`.
   * @param {string} newFile - the new (namespaced) config file's path.
   * @param {string|null} legacyFile - the legacy config file's path,
   *   or `null` when there's no legacy fallback.
   * @param {string} key - the config key to write.
   * @param {string} value - the value to write, always exactly `"true"`
   *   or `"false"` (validated by `#set`) — stored as a real JSON
   *   boolean, mirroring `repo_config_write`'s `jq --argjson` behavior.
   * @returns {Promise<void>} resolves once the value has been written
   *   atomically.
   */
  async _write(newFile, legacyFile, key, value) {
    const lockFile = `${newFile}.lock`;

    await this._lock.acquire(lockFile);

    try {
      const base = await this._readJson(newFile);
      let namespaceSection = base[NAMESPACE];

      if (namespaceSection === undefined && legacyFile !== null) {
        const legacyConfig = await this._readJson(legacyFile, { requireExists: true });

        if (legacyConfig !== undefined) {
          namespaceSection = legacyConfig;
        }
      }

      const updated = {
        ...base,
        [NAMESPACE]: {
          ...namespaceSection,
          [key]: value === 'true' || value === 'false' ? value === 'true' : value
        }
      };

      await mkdir(path.dirname(newFile), { recursive: true });

      const tmpFile = `${newFile}.tmp`;

      await writeFile(tmpFile, `${JSON.stringify(updated, null, 2)}\n`);
      await rename(tmpFile, newFile);
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * @param {string} file - the JSON file's path.
   * @param {object} [opts] - options.
   * @param {boolean} [opts.requireExists] - when `true`, returns
   *   `undefined` (instead of `{}`) if the file doesn't exist or isn't
   *   valid JSON — used by the legacy-file seed step, which must only
   *   seed from an actually-present, valid legacy file.
   * @returns {Promise<object|undefined>} the parsed JSON content, `{}`
   *   if missing/unreadable/malformed (default), or `undefined` when
   *   `opts.requireExists` is set and the file is missing/malformed.
   */
  async _readJson(file, { requireExists = false } = {}) {
    let raw;

    try {
      raw = await readFile(file, 'utf8');
    } catch {
      return requireExists ? undefined : {};
    }

    try {
      const parsed = JSON.parse(raw);

      return parsed === null || typeof parsed !== 'object' ? (requireExists ? undefined : {}) : parsed;
    } catch {
      return requireExists ? undefined : {};
    }
  }
}

export default AutoFixAllConfig;
