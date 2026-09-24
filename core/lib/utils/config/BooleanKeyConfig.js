import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from '../errors/DispatchFailure.js';
import Lock from '../file/Lock.js';

const DEFAULT_VALUE = 'false';

/**
 * Shared base for the native `config.sh` equivalents whose 4
 * subcommands (`get`, `is-enabled`, `set`, `toggle`) read and write
 * `true`/`false` keys in per-repo JSON files — currently
 * `AutoFixAllConfig` and `MonitorIssuesConfig`.
 *
 * Owns what they have in common: key/value validation (with the
 * shell scripts' exact error messages), `// false` default
 * resolution, the lock-guarded read-merge-write transaction (via
 * `Lock.js`) and the atomic tmp-file + rename write. Each namespace
 * supplies its own file layout by overriding the three hooks:
 * - `_lockFile(repoPath, key)` — the lock file guarding `key`'s writes.
 * - `_readValue(repoPath, key)` — `key`'s current value, already
 *   formatted as its shell counterpart would print it, or `undefined`
 *   when absent (resolved to `"false"`).
 * - `_buildUpdate(repoPath, key, value)` — the `{ file, content }` to
 *   write atomically so `key` holds the JSON boolean `value`; called
 *   while holding the lock.
 */
class BooleanKeyConfig {
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
   *   when absent.
   * @throws {Error} `Error: get requires a key` when `key` is missing.
   */
  async get(repoPath, key) {
    this._requireKey('get', key);

    const value = await this._resolve(repoPath, key);

    return `${value}\n`;
  }

  /**
   * Native implementation of `config.sh is-enabled <key>`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<void>} resolves (no stdout) when the resolved
   *   value is `"true"`.
   * @throws {Error} `Error: is-enabled requires a key` when `key` is
   *   missing.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the resolved value is not `"true"`.
   */
  async isEnabled(repoPath, key) {
    this._requireKey('is-enabled', key);

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

    await this._withLock(repoPath, key, () => this._write(repoPath, key, value === 'true'));
  }

  /**
   * Native implementation of `config.sh toggle <key>`: flips the
   * resolved value under the lock.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to toggle.
   * @returns {Promise<string>} `<new_value>\n`, the flipped value.
   * @throws {Error} `Error: toggle requires a key` when `key` is missing.
   */
  async toggle(repoPath, key) {
    this._requireKey('toggle', key);

    return this._withLock(repoPath, key, async () => {
      const current = await this._resolve(repoPath, key);
      const newValue = current !== 'true';

      await this._write(repoPath, key, newValue);

      return `${newValue}\n`;
    });
  }

  /**
   * @param {string} subcommand - the subcommand name, for the message.
   * @param {string|undefined} key - the key argument.
   * @returns {void}
   * @throws {Error} `Error: <subcommand> requires a key` when `key` is
   *   missing.
   */
  _requireKey(subcommand, key) {
    if (key === undefined) {
      throw new Error(`Error: ${subcommand} requires a key`);
    }
  }

  /**
   * Resolves `key`'s current value, defaulting to `"false"` (the
   * shell's `// false` / `${VALUE:-false}`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to read.
   * @returns {Promise<string>} the resolved value.
   */
  async _resolve(repoPath, key) {
    const value = await this._readValue(repoPath, key);

    return value === undefined ? DEFAULT_VALUE : value;
  }

  /**
   * Runs `fn` while holding `key`'s lock.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key being written.
   * @param {() => Promise<string|void>} fn - the async mutation to run
   *   under the lock.
   * @returns {Promise<string|void>} `fn`'s result.
   */
  async _withLock(repoPath, key, fn) {
    const lockFile = this._lockFile(repoPath, key);

    await this._lock.acquire(lockFile);

    try {
      return await fn();
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Writes `key` = `value` atomically (tmp file + rename), creating the
   * target's directory as needed. Must be called under the lock.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} key - the config key to write.
   * @param {boolean} value - the JSON boolean to store.
   * @returns {Promise<void>} resolves once written.
   */
  async _write(repoPath, key, value) {
    const { file, content } = await this._buildUpdate(repoPath, key, value);
    const tmpFile = `${file}.tmp`;

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(tmpFile, `${JSON.stringify(content, null, 2)}\n`);
    await rename(tmpFile, file);
  }

  /**
   * Reads a JSON object file, treating an absent/empty/malformed
   * (or non-object) file as `{}`.
   * @param {string} file - the JSON file's path.
   * @param {object} [opts] - options.
   * @param {boolean} [opts.requireExists] - when `true`, returns
   *   `undefined` (instead of `{}`) if the file doesn't exist or isn't
   *   a valid JSON object.
   * @returns {Promise<object|undefined>} the parsed JSON object, `{}`,
   *   or `undefined` (see `opts.requireExists`).
   */
  async _readJson(file, { requireExists = false } = {}) {
    const fallback = requireExists ? undefined : {};
    let raw;

    try {
      raw = await readFile(file, 'utf8');
    } catch {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw);

      return parsed === null || typeof parsed !== 'object' ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  /**
   * Hook `_lockFile(repoPath, key)`: the lock file guarding `key`'s
   * writes (a path string). Must be overridden.
   * @throws {Error} always, unless overridden.
   */
  _lockFile() {
    throw new Error('BooleanKeyConfig#_lockFile must be implemented by a subclass');
  }

  /**
   * Hook `_readValue(repoPath, key)`: `key`'s current, already-formatted
   * value, or `undefined` when absent. Must be overridden.
   * @returns {Promise<string|undefined>} the value.
   */
  async _readValue() {
    throw new Error('BooleanKeyConfig#_readValue must be implemented by a subclass');
  }

  /**
   * Hook `_buildUpdate(repoPath, key, value)`: the file and full JSON
   * content to write so `key` holds the JSON boolean `value`. Called
   * under the lock. Must be overridden.
   * @returns {Promise<{file: string, content: object}>} the write target.
   */
  async _buildUpdate() {
    throw new Error('BooleanKeyConfig#_buildUpdate must be implemented by a subclass');
  }
}

export default BooleanKeyConfig;
