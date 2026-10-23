import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../file/Lock.js';
import ConfigError from './ConfigError.js';

/**
 * Native equivalent of `arcanum/_lib/repo_config.sh`'s writers
 * (`repo_config_write` and `repo_config_set_version`), plus a
 * native-only `unset` that deletes a key (no shell counterpart yet) and
 * a native-only `update` that atomically reads, modifies and writes one
 * key under the lock. Every write is
 * guarded by `<file>.lock` through `Lock.js` (the same protocol as
 * `arcanum/_lib/lock.sh`, so shell and native writers exclude each
 * other), serialized byte-identically to jq's default output
 * (`JSON.stringify(obj, null, 2) + '\n'`, existing key order preserved,
 * new keys appended) and written atomically via `<file>.tmp` + rename.
 *
 * Every method also takes an optional, native-only `timeoutMs` that
 * bounds the wait for the lock (`Lock.acquire`); omitted waits forever,
 * as the shell writers do.
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
   *
   * Without a `namespace`, `key` is a path from the root of the file
   * (a top-level write): missing intermediates are created, siblings
   * and their order are kept, and `legacyFile` is ignored (a legacy
   * file only ever seeds one namespace).
   * @param {object} args - the write's arguments.
   * @param {string} args.newFile - the namespaced config file's path.
   * @param {string} [args.legacyFile] - the legacy, feature-specific
   *   config file's path (only read, as a seed); empty/absent when the
   *   namespace has no legacy file (the shell's `""`).
   * @param {string} [args.namespace] - the top-level namespace key;
   *   omitted for a top-level write.
   * @param {string} args.key - the key (or dot-separated path) to set
   *   under `namespace`, or from the root when it is omitted.
   * @param {*} args.value - the JSON-serializable value to set.
   * @param {number} [args.timeoutMs] - bound on waiting for the lock;
   *   omitted waits forever.
   * @returns {Promise<void>} resolves once written and unlocked.
   * @throws {Error} a `LockTimeoutError` when `timeoutMs` runs out
   *   (nothing is written).
   */
  async write({ newFile, legacyFile, namespace, key, value, timeoutMs }) {
    await this._locked(newFile, async () => {
      const config = await this._readBase(newFile);

      if (namespace === undefined) {
        RepoConfigWriter._setPath(config, key.split('.'), value, '', newFile);

        return config;
      }

      await this._seedNamespace(config, namespace, legacyFile);
      this._setNamespaced(config, namespace, key.split('.'), value, newFile);

      return config;
    }, { timeoutMs });
  }

  /**
   * Deletes a key, the counterpart of `write`: under `<newFile>.lock`,
   * seeds `.<namespace>` from `legacyFile` when `newFile` lacks it
   * (exactly as `write` does, so the reader's legacy fallback can't
   * resurrect the value), then deletes `.<namespace>.<key>` (or `.<key>`
   * from the root when `namespace` is omitted). A dotted `key` is a
   * nested path.
   *
   * A missing leaf, or a missing or `null` intermediate, is a no-op: the
   * file is neither rewritten nor created (a legacy seed alone is not
   * written either). Empty parent objects left behind are kept.
   * @param {object} args - the unset's arguments.
   * @param {string} args.newFile - the namespaced config file's path.
   * @param {string} [args.legacyFile] - the legacy config file's path
   *   (only read, as a seed); ignored without a `namespace`.
   * @param {string} [args.namespace] - the top-level namespace key;
   *   omitted to delete from the root of the file.
   * @param {string} args.key - the key (or dot-separated path) to delete.
   * @param {number} [args.timeoutMs] - bound on waiting for the lock;
   *   omitted waits forever.
   * @returns {Promise<void>} resolves once written (if needed) and
   *   unlocked.
   * @throws {ConfigError} `NOT_AN_OBJECT` when the file, the namespace
   *   or an intermediate holds a non-object value.
   * @throws {Error} a `LockTimeoutError` when `timeoutMs` runs out
   *   (nothing is written).
   */
  async unset({ newFile, legacyFile, namespace, key, timeoutMs }) {
    await this._locked(newFile, async () => {
      const config = await this._readBase(newFile);
      const keyPath = key.split('.');

      if (namespace === undefined) {
        return RepoConfigWriter._deletePath(config, keyPath, '', newFile) ? config : null;
      }

      await this._seedNamespace(config, namespace, legacyFile);

      const section = config[namespace];

      if (section === undefined || section === null) {
        return null;
      }

      if (!RepoConfigWriter._isObject(section)) {
        throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${namespace}: not a JSON object`, { file: newFile });
      }

      return RepoConfigWriter._deletePath(section, keyPath, namespace, newFile) ? config : null;
    }, { timeoutMs });
  }

  /**
   * Atomic read-modify-write of one key: under `<newFile>.lock`, seeds
   * `.<namespace>` from `legacyFile` when `newFile` lacks it (exactly as
   * `write` does), reads the current value at `.<namespace>.<key>` (or
   * `.<key>` from the root when `namespace` is omitted, in which case
   * `legacyFile` is ignored), and passes `mutate` a `structuredClone` of
   * it — so mutating the argument in place can't corrupt `previous`.
   * The current value is `undefined` when the leaf is absent or a
   * missing/`null` intermediate (or namespace) is in the way. A dotted
   * `key` is a nested path.
   *
   * `mutate`'s result is written with `write`'s semantics (same
   * serialization, atomic tmp+rename, siblings and key order kept,
   * missing intermediates created). When the result deep-equals the
   * current value — a structural comparison of plain JSON values in
   * which object key order is ignored — nothing is written: the file is
   * neither rewritten nor created, and a legacy seed alone is not
   * persisted (as with `unset`).
   *
   * When `mutate` throws (or rejects), nothing is written, the lock is
   * released and the error propagates unchanged.
   * @param {object} args - the update's arguments.
   * @param {string} args.newFile - the namespaced config file's path.
   * @param {string} [args.legacyFile] - the legacy config file's path
   *   (only read, as a seed); ignored without a `namespace`.
   * @param {string} [args.namespace] - the top-level namespace key;
   *   omitted for a top-level update.
   * @param {string} args.key - the key (or dot-separated path) to update.
   * @param {function(unknown): (unknown|Promise<unknown>)} args.mutate -
   *   receives a copy of the current value (`undefined` when absent) and
   *   returns, or resolves to, the JSON-serializable new value. It may
   *   be async; it must not return `undefined` (deleting is `unset`'s
   *   job).
   * @param {number} [args.timeoutMs] - bound on waiting for the lock;
   *   omitted waits forever.
   * @returns {Promise<{changed: boolean, previous: unknown, value: unknown}>}
   *   whether the file was written, the value before the call and the
   *   value after it.
   * @throws {TypeError} when `mutate` returns `undefined` (nothing is
   *   written).
   * @throws {ConfigError} `NOT_AN_OBJECT` when the file, the namespace
   *   or an intermediate holds a non-object value.
   * @throws {Error} a `LockTimeoutError` when `timeoutMs` runs out
   *   (nothing is written).
   */
  async update({ newFile, legacyFile, namespace, key, mutate, timeoutMs }) {
    let previous;
    let next;
    let changed = false;

    await this._locked(newFile, async () => {
      const config = await this._readBase(newFile);
      const keyPath = key.split('.');

      if (namespace === undefined) {
        previous = RepoConfigWriter._getPath(config, keyPath, '', newFile);
      } else {
        await this._seedNamespace(config, namespace, legacyFile);
        previous = RepoConfigWriter._readSection(config, namespace, keyPath, newFile);
      }

      next = await mutate(structuredClone(previous));

      if (next === undefined) {
        throw new TypeError('update\'s mutate must return a value; use unset to delete');
      }

      if (RepoConfigWriter._deepEqual(next, previous)) {
        return null;
      }

      if (namespace === undefined) {
        RepoConfigWriter._setPath(config, keyPath, next, '', newFile);
      } else {
        this._setNamespaced(config, namespace, keyPath, next, newFile);
      }

      changed = true;

      return config;
    }, { timeoutMs });

    return { changed, previous, value: changed ? next : previous };
  }

  /**
   * Mirrors `repo_config_set_version <file> <version> [<namespace>]`:
   * under `<file>.lock`, sets `.version` (or `.<namespace>.version` when
   * `namespace` is given).
   * @param {object} args - the write's arguments.
   * @param {string} args.file - the config file's path.
   * @param {string} args.version - the version string to set.
   * @param {string} [args.namespace] - the optional namespace key.
   * @param {number} [args.timeoutMs] - bound on waiting for the lock;
   *   omitted waits forever.
   * @returns {Promise<void>} resolves once written and unlocked.
   * @throws {Error} a `LockTimeoutError` when `timeoutMs` runs out
   *   (nothing is written).
   */
  async setVersion({ file, version, namespace, timeoutMs }) {
    await this._locked(file, async () => {
      const config = await this._readBase(file);

      if (namespace) {
        this._setNamespaced(config, namespace, ['version'], version, file);
      } else {
        config.version = version;
      }

      return config;
    }, { timeoutMs });
  }

  /**
   * Holds `<file>.lock` while `mutate` builds the new contents, then
   * writes them atomically. When `mutate` resolves to `null` (nothing
   * changed), the file is left untouched. Releases the lock whenever it
   * was acquired;
   * a failed `acquire` (e.g. `LockTimeoutError`) propagates unchanged,
   * with nothing written and no release.
   * @param {string} file - the config file's path.
   * @param {function(): Promise<object|null>} mutate - builds the
   *   object to write, or `null` to skip writing.
   * @param {object} [opts] - locking options.
   * @param {number} [opts.timeoutMs] - forwarded to `Lock.acquire`
   *   (validated there); when omitted, `acquire` gets no options and
   *   waits forever.
   * @returns {Promise<void>} resolves once written and unlocked.
   */
  async _locked(file, mutate, { timeoutMs } = {}) {
    const lockFile = `${file}.lock`;

    await this._fs.mkdir(path.dirname(file), { recursive: true });

    if (timeoutMs === undefined) {
      await this._lock.acquire(lockFile);
    } else {
      await this._lock.acquire(lockFile, { timeoutMs });
    }

    try {
      const config = await mutate();

      if (config !== null) {
        const tmp = `${file}.tmp`;

        await this._fs.writeFile(tmp, `${JSON.stringify(config, null, 2)}\n`);
        await this._fs.rename(tmp, file);
      }
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
   * @throws {ConfigError} `NOT_AN_OBJECT` when the file holds valid
   *   JSON that is not an object (jq itself fails to index it).
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
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index ${file}: not a JSON object`, { file });
    }

    return parsed;
  }

  /**
   * Mirrors `jq --slurpfile legacy <legacyFile> '... $legacy[0]'`.
   * @param {string} [legacyFile] - the legacy config file's path; an
   *   empty/absent path never exists.
   * @returns {Promise<{exists: boolean, value: *}>} whether the legacy
   *   file exists, and its first JSON value (`null` when empty).
   * @throws {ConfigError} `INVALID_JSON` when the legacy file exists but
   *   is not valid JSON (the parse error's message, unchanged). Native
   *   fs errors other than `ENOENT` propagate unwrapped.
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

    try {
      return { exists: true, value: JSON.parse(raw) };
    } catch (error) {
      throw new ConfigError('INVALID_JSON', error.message, { file: legacyFile, cause: error });
    }
  }

  /**
   * Mirrors the shell writers' legacy seed: when `config` lacks
   * `.<namespace>` and `legacyFile` exists, copies the legacy file's
   * full contents in as `.<namespace>`.
   * @param {object} config - the config object, mutated in place.
   * @param {string} namespace - the namespace key.
   * @param {string} [legacyFile] - the legacy config file's path.
   * @returns {Promise<void>} resolves once seeded (or skipped).
   */
  async _seedNamespace(config, namespace, legacyFile) {
    if (Object.hasOwn(config, namespace)) {
      return;
    }

    const legacy = await this._readLegacy(legacyFile);

    if (legacy.exists) {
      config[namespace] = legacy.value;
    }
  }

  /**
   * Mirrors jq's `.[$ns] = ((.[$ns] // {}) | setpath($path; $v))`.
   * @param {object} config - the config object, mutated in place.
   * @param {string} namespace - the namespace key.
   * @param {string[]} keyPath - the path to set under `namespace`.
   * @param {*} value - the value to set.
   * @param {string} file - the config file's path, for the error.
   * @returns {void}
   * @throws {ConfigError} `NOT_AN_OBJECT` when `.<namespace>` holds a
   *   non-object value.
   */
  _setNamespaced(config, namespace, keyPath, value, file) {
    let section = config[namespace];

    if (section === undefined || section === null || section === false) {
      section = {};
    } else if (!RepoConfigWriter._isObject(section)) {
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${namespace}: not a JSON object`, { file });
    }

    RepoConfigWriter._setPath(section, keyPath, value, namespace, file);
    config[namespace] = section;
  }

  /**
   * Mirrors jq's `setpath`: walks `keyPath` from `target`, creating a
   * `{}` for every missing or `null` intermediate, then sets the leaf.
   * @param {object} target - the object to set the path in, mutated.
   * @param {string[]} keyPath - the (non-empty) path to set.
   * @param {unknown} value - the leaf value.
   * @param {string} prefix - the path walked so far, for error messages
   *   (`''` at the root of the file).
   * @param {string} file - the config file's path, for the error.
   * @returns {void}
   * @throws {ConfigError} `NOT_AN_OBJECT` when an intermediate holds a
   *   non-object value.
   */
  static _setPath(target, keyPath, value, prefix, file) {
    const [head, ...rest] = keyPath;

    if (rest.length === 0) {
      target[head] = value;
      return;
    }

    const current = RepoConfigWriter._joinPath(prefix, head);
    let child = target[head];

    if (child === undefined || child === null) {
      child = {};
    } else if (!RepoConfigWriter._isObject(child)) {
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${current}: not a JSON object`, { file });
    }

    RepoConfigWriter._setPath(child, rest, value, current, file);
    target[head] = child;
  }

  /**
   * Walks `keyPath` from `target` and deletes the leaf, keeping any
   * (possibly now empty) parents.
   * @param {object} target - the object to delete the path from, mutated.
   * @param {string[]} keyPath - the (non-empty) path to delete.
   * @param {string} prefix - the path walked so far, for error messages
   *   (`''` at the root of the file).
   * @param {string} file - the config file's path, for the error.
   * @returns {boolean} whether a key was deleted (`false` when the leaf
   *   or a `null`/missing intermediate is absent).
   * @throws {ConfigError} `NOT_AN_OBJECT` when an intermediate holds a
   *   non-object value.
   */
  static _deletePath(target, keyPath, prefix, file) {
    const [head, ...rest] = keyPath;

    if (rest.length === 0) {
      if (!Object.hasOwn(target, head)) {
        return false;
      }

      delete target[head];
      return true;
    }

    const current = RepoConfigWriter._joinPath(prefix, head);
    const child = target[head];

    if (child === undefined || child === null) {
      return false;
    }

    if (!RepoConfigWriter._isObject(child)) {
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${current}: not a JSON object`, { file });
    }

    return RepoConfigWriter._deletePath(child, rest, current, file);
  }

  /**
   * Walks `keyPath` from `target` and returns the leaf value, without
   * mutating anything.
   * @param {object} target - the object to read the path from.
   * @param {string[]} keyPath - the (non-empty) path to read.
   * @param {string} prefix - the path walked so far, for error messages
   *   (`''` at the root of the file).
   * @param {string} file - the config file's path, for the error.
   * @returns {unknown} the leaf value, or `undefined` when the leaf or a
   *   `null`/missing intermediate is absent (inherited keys never count).
   * @throws {ConfigError} `NOT_AN_OBJECT` when an intermediate holds a
   *   non-object value.
   */
  static _getPath(target, keyPath, prefix, file) {
    const [head, ...rest] = keyPath;

    if (!Object.hasOwn(target, head)) {
      return undefined;
    }

    const child = target[head];

    if (rest.length === 0) {
      return child;
    }

    if (child === null) {
      return undefined;
    }

    const current = RepoConfigWriter._joinPath(prefix, head);

    if (!RepoConfigWriter._isObject(child)) {
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${current}: not a JSON object`, { file });
    }

    return RepoConfigWriter._getPath(child, rest, current, file);
  }

  /**
   * Reads `.<namespace>.<keyPath>` from `config`, treating a missing or
   * `null` namespace as absent.
   * @param {object} config - the (already seeded) config object.
   * @param {string} namespace - the namespace key.
   * @param {string[]} keyPath - the (non-empty) path under `namespace`.
   * @param {string} file - the config file's path, for the error.
   * @returns {unknown} the value, or `undefined` when absent.
   * @throws {ConfigError} `NOT_AN_OBJECT` when the namespace or an
   *   intermediate holds a non-object value.
   */
  static _readSection(config, namespace, keyPath, file) {
    const section = config[namespace];

    if (section === undefined || section === null) {
      return undefined;
    }

    if (!RepoConfigWriter._isObject(section)) {
      throw new ConfigError('NOT_AN_OBJECT', `Cannot index .${namespace}: not a JSON object`, { file });
    }

    return RepoConfigWriter._getPath(section, keyPath, namespace, file);
  }

  /**
   * Structural equality of plain JSON values: primitives compare through
   * `Object.is`, arrays by length and then element by element, objects
   * by the same set of own keys (key order is ignored) and recursively
   * equal values. A reordered object therefore counts as unchanged.
   *
   * Only meant for parsed JSON (and values built like it): there are no
   * cycles, Dates, Maps or other non-JSON types to handle.
   * @param {unknown} a - the first value.
   * @param {unknown} b - the second value.
   * @returns {boolean} whether `a` and `b` are structurally equal.
   */
  static _deepEqual(a, b) {
    if (Object.is(a, b)) {
      return true;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
      return Array.isArray(a) && Array.isArray(b)
        && a.length === b.length
        && a.every((item, index) => RepoConfigWriter._deepEqual(item, b[index]));
    }

    if (!RepoConfigWriter._isObject(a) || !RepoConfigWriter._isObject(b)) {
      return false;
    }

    const keys = Object.keys(a);

    return keys.length === Object.keys(b).length
      && keys.every((key) => Object.hasOwn(b, key) && RepoConfigWriter._deepEqual(a[key], b[key]));
  }

  /**
   * @param {string} prefix - the path walked so far (`''` at the root).
   * @param {string} head - the next path segment.
   * @returns {string} the joined path, without a leading dot.
   */
  static _joinPath(prefix, head) {
    return prefix === '' ? head : `${prefix}.${head}`;
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
