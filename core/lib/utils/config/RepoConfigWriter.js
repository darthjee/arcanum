import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../file/Lock.js';

/**
 * Native equivalent of `arcanum/_lib/repo_config.sh`'s writers
 * (`repo_config_write` and `repo_config_set_version`). Every write is
 * guarded by `<file>.lock` through `Lock.js` (the same protocol as
 * `arcanum/_lib/lock.sh`, so shell and native writers exclude each
 * other), serialized byte-identically to jq's default output
 * (`JSON.stringify(obj, null, 2) + '\n'`, existing key order preserved,
 * new keys appended) and written atomically via `<file>.tmp` + rename.
 *
 * Paths are absolute — callers resolve them against their
 * `repoContext.repoPath`.
 */
class RepoConfigWriter {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper.
   * @param {object} [deps.fs] - `fs/promises`-compatible `readFile`,
   *   `writeFile`, `rename` and `mkdir` implementations.
   */
  constructor({ lock = new Lock(), fs = {} } = {}) {
    this._lock = lock;
    this._fs = { readFile, writeFile, rename, mkdir, ...fs };
  }

  /**
   * Mirrors `repo_config_write <new_file> <legacy_file> <namespace>
   * <key> <json_value>`: under `<newFile>.lock`, seeds `.<namespace>`
   * from the full contents of `legacyFile` when `newFile` lacks it,
   * then sets `.<namespace>.<key> = value`. A dotted `key` (e.g.
   * `auto.enhance-issue`) is a nested path under `namespace`, mirroring
   * the shell's `setpath(($k | split(".")); $v)`: missing intermediate
   * objects are created and sibling keys are kept. A flat key behaves
   * as a plain `.<namespace>[key] = value`.
   * @param {object} args - the write's arguments.
   * @param {string} args.newFile - the namespaced config file's path.
   * @param {string} [args.legacyFile] - the legacy, feature-specific
   *   config file's path (only read, as a seed); empty/absent when the
   *   namespace has no legacy file (the shell's `""`).
   * @param {string} args.namespace - the top-level namespace key.
   * @param {string} args.key - the key (or dot-separated path) to set
   *   under `namespace`.
   * @param {*} args.value - the JSON-serializable value to set.
   * @returns {Promise<void>} resolves once written and unlocked.
   */
  async write({ newFile, legacyFile, namespace, key, value }) {
    await this._locked(newFile, async () => {
      const config = await this._readBase(newFile);

      if (!Object.hasOwn(config, namespace)) {
        const legacy = await this._readLegacy(legacyFile);

        if (legacy.exists) {
          config[namespace] = legacy.value;
        }
      }

      this._setNamespaced(config, namespace, key.split('.'), value);

      return config;
    });
  }

  /**
   * Mirrors `repo_config_set_version <file> <version> [<namespace>]`:
   * under `<file>.lock`, sets `.version` (or `.<namespace>.version` when
   * `namespace` is given).
   * @param {object} args - the write's arguments.
   * @param {string} args.file - the config file's path.
   * @param {string} args.version - the version string to set.
   * @param {string} [args.namespace] - the optional namespace key.
   * @returns {Promise<void>} resolves once written and unlocked.
   */
  async setVersion({ file, version, namespace }) {
    await this._locked(file, async () => {
      const config = await this._readBase(file);

      if (namespace) {
        this._setNamespaced(config, namespace, ['version'], version);
      } else {
        config.version = version;
      }

      return config;
    });
  }

  /**
   * Holds `<file>.lock` while `mutate` builds the new contents, then
   * writes them atomically. Always releases the lock.
   * @param {string} file - the config file's path.
   * @param {function(): Promise<object>} mutate - builds the object to
   *   write.
   * @returns {Promise<void>} resolves once written and unlocked.
   */
  async _locked(file, mutate) {
    const lockFile = `${file}.lock`;

    await this._fs.mkdir(path.dirname(file), { recursive: true });
    await this._lock.acquire(lockFile);

    try {
      const config = await mutate();
      const tmp = `${file}.tmp`;

      await this._fs.writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`);
      await this._fs.rename(tmp, file);
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Mirrors the shell's `base="{}"; jq -e . <file> && base=$(cat
   * <file>)`: a missing, unreadable, invalid, `null` or `false` file is
   * treated as `{}`.
   * @param {string} file - the config file's path.
   * @returns {Promise<object>} the parsed contents, or `{}`.
   * @throws {Error} when the file holds valid JSON that is not an
   *   object (jq itself fails to index it).
   */
  async _readBase(file) {
    let parsed;

    try {
      parsed = JSON.parse(await this._fs.readFile(file, 'utf8'));
    } catch {
      return {};
    }

    if (parsed === null || parsed === false) {
      return {};
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Cannot index ${file}: not a JSON object`);
    }

    return parsed;
  }

  /**
   * Mirrors `jq --slurpfile legacy <legacyFile> '... $legacy[0]'`.
   * @param {string} [legacyFile] - the legacy config file's path; an
   *   empty/absent path never exists.
   * @returns {Promise<{exists: boolean, value: *}>} whether the legacy
   *   file exists, and its first JSON value (`null` when empty).
   * @throws {Error} when the legacy file exists but is not valid JSON.
   */
  async _readLegacy(legacyFile) {
    if (!legacyFile) {
      return { exists: false, value: undefined };
    }

    let raw;

    try {
      raw = await this._fs.readFile(legacyFile, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return { exists: false, value: undefined };
      }

      throw error;
    }

    if (raw.trim() === '') {
      return { exists: true, value: null };
    }

    return { exists: true, value: JSON.parse(raw) };
  }

  /**
   * Mirrors jq's `.[$ns] = ((.[$ns] // {}) | setpath($path; $v))`.
   * @param {object} config - the config object, mutated in place.
   * @param {string} namespace - the namespace key.
   * @param {string[]} keyPath - the path to set under `namespace`.
   * @param {*} value - the value to set.
   * @returns {void}
   * @throws {Error} when `.<namespace>` holds a non-object value.
   */
  _setNamespaced(config, namespace, keyPath, value) {
    let section = config[namespace];

    if (section === undefined || section === null || section === false) {
      section = {};
    } else if (!RepoConfigWriter._isObject(section)) {
      throw new Error(`Cannot index .${namespace}: not a JSON object`);
    }

    RepoConfigWriter._setPath(section, keyPath, value, namespace);
    config[namespace] = section;
  }

  /**
   * Mirrors jq's `setpath`: walks `keyPath` from `target`, creating a
   * `{}` for every missing or `null` intermediate, then sets the leaf.
   * @param {object} target - the object to set the path in, mutated.
   * @param {string[]} keyPath - the (non-empty) path to set.
   * @param {unknown} value - the leaf value.
   * @param {string} prefix - the path walked so far, for error messages.
   * @returns {void}
   * @throws {Error} when an intermediate holds a non-object value.
   */
  static _setPath(target, keyPath, value, prefix) {
    const [head, ...rest] = keyPath;

    if (rest.length === 0) {
      target[head] = value;
      return;
    }

    const current = `${prefix}.${head}`;
    let child = target[head];

    if (child === undefined || child === null) {
      child = {};
    } else if (!RepoConfigWriter._isObject(child)) {
      throw new Error(`Cannot index .${current}: not a JSON object`);
    }

    RepoConfigWriter._setPath(child, rest, value, current);
    target[head] = child;
  }

  /**
   * @param {unknown} value - any parsed JSON value.
   * @returns {boolean} whether `value` is a (non-array) JSON object.
   */
  static _isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export default RepoConfigWriter;
