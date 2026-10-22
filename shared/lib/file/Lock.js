import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import LockTimeoutError from './LockTimeoutError.js';

const DEFAULT_SLEEP_MS = 1000;
const WARN_AFTER_ATTEMPTS = 10;

/**
 * Generic lock/mutate/release helper for shared JSON state files,
 * byte-compatible with `arcanum/_lib/lock.sh`'s protocol:
 *
 * - acquire atomically creates `<lockFile>` only if absent, writing a
 *   fresh `<hostname>:<pid>:<nonce>\n` instance id; success means the
 *   lock is held immediately.
 * - on contention, a lock left by a dead process on this same host
 *   (parseable id, same hostname, pid not alive) is broken — re-read
 *   right before removal, removed only if unchanged — and the create is
 *   retried at once; otherwise it sleeps the retry interval and retries,
 *   warning once after 10 consecutive failed attempts. Never gives up.
 * - release removes the file only if it still holds this instance's id.
 *
 * `acquire` can optionally be bounded with `timeoutMs`, throwing a
 * `LockTimeoutError` once it runs out (the shell twin has no bound).
 *
 * See docs/agents/architecture/lock-system.md.
 */
class Lock {
  /**
   * @param {object} [opts] - options.
   * @param {number} [opts.sleepMs] - the retry interval on contention,
   *   overridable for tests (defaults to the real 1000ms protocol delay).
   */
  constructor({ sleepMs = DEFAULT_SLEEP_MS } = {}) {
    this._sleepMs = sleepMs;
    this._held = new Map();
  }

  /**
   * Acquire the lock at `<lockFile>`, retrying on contention —
   * indefinitely unless `timeoutMs` is given.
   * @param {string} lockFile - the lock file's path.
   * @param {object} [opts] - options.
   * @param {number} [opts.timeoutMs] - give up after this many
   *   milliseconds (`0` makes a single attempt). Waits forever when
   *   omitted.
   * @param {boolean} [opts.warn] - whether to print the "seems stuck"
   *   warning (defaults to true).
   * @returns {Promise<void>} resolves once this instance holds the lock.
   * @throws {TypeError} when `timeoutMs` isn't a non-negative finite
   *   number.
   * @throws {LockTimeoutError} when `timeoutMs` runs out first.
   */
  async acquire(lockFile, { timeoutMs, warn = true } = {}) {
    const deadline = this._deadline(timeoutMs);

    await mkdir(path.dirname(lockFile), { recursive: true });

    const id = this._newId();
    let attempt = 0;
    let warned = !warn;

    for (;;) {
      if (await this._tryCreate(lockFile, id)) {
        this._held.set(lockFile, id);
        return;
      }

      if (await this._breakIfStale(lockFile) && await this._tryCreate(lockFile, id)) {
        this._held.set(lockFile, id);
        return;
      }

      await this._sleep(this._retrySleep(lockFile, deadline));
      attempt += 1;

      if (attempt % WARN_AFTER_ATTEMPTS === 0) {
        if (!warned) {
          process.stderr.write(
            `Warning: lock (${lockFile}) seems stuck after ${attempt} attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying...\n`
          );
          warned = true;
        }

        attempt = 0;
      }
    }
  }

  /**
   * @param {number|undefined} timeoutMs - the optional bound.
   * @returns {number|null} the absolute deadline, or null for no bound.
   * @throws {TypeError} when `timeoutMs` isn't a non-negative finite
   *   number.
   */
  _deadline(timeoutMs) {
    if (timeoutMs === undefined) {
      return null;
    }

    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new TypeError(`timeoutMs must be a non-negative finite number, got ${String(timeoutMs)}`);
    }

    return Date.now() + timeoutMs;
  }

  /**
   * @param {string} lockFile - the lock file's path.
   * @param {number|null} deadline - the absolute deadline, or null.
   * @returns {number} the retry sleep, clamped to the time left.
   * @throws {LockTimeoutError} when no time is left.
   */
  _retrySleep(lockFile, deadline) {
    if (deadline === null) {
      return this._sleepMs;
    }

    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new LockTimeoutError(lockFile);
    }

    return Math.min(this._sleepMs, remaining);
  }

  /**
   * Release the lock at `<lockFile>`, only if this instance holds it.
   * A missing or foreign lock file is left alone, silently.
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<void>} resolves once the release is done.
   */
  async release(lockFile) {
    const id = this._held.get(lockFile);

    this._held.delete(lockFile);

    if (id === undefined) {
      return;
    }

    if ((await this._read(lockFile)) === id) {
      await rm(lockFile, { force: true });
    }
  }

  /**
   * @returns {string} a fresh `<hostname>:<pid>:<nonce>` instance id.
   */
  _newId() {
    return `${os.hostname()}:${process.pid}:${Date.now()}-${process.hrtime.bigint()}`;
  }

  /**
   * Atomically create `<lockFile>` holding `id`, only if absent.
   * @param {string} lockFile - the lock file's path.
   * @param {string} id - this acquire's instance id.
   * @returns {Promise<boolean>} true if created, false if it exists.
   */
  async _tryCreate(lockFile, id) {
    try {
      await writeFile(lockFile, `${id}\n`, { flag: 'wx' });
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        return false;
      }

      throw error;
    }
  }

  /**
   * Break the existing lock if it vanished or is stale.
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<boolean>} true if the create should be retried at
   *   once (the file is gone, or a stale lock was removed).
   */
  async _breakIfStale(lockFile) {
    const holder = await this._read(lockFile);

    if (holder === null) {
      return true;
    }

    if (!this._isStale(holder)) {
      return false;
    }

    if ((await this._read(lockFile)) === holder) {
      await rm(lockFile, { force: true });
    }

    return true;
  }

  /**
   * @param {string} id - a trimmed lock file content.
   * @returns {{hostname: string, pid: number}|null} the parsed id, or
   *   null if it isn't a `<hostname>:<pid>:<nonce>` id.
   */
  _parseId(id) {
    const parts = id.split(':');

    if (parts.length !== 3 || !/^[0-9]+$/.test(parts[1])) {
      return null;
    }

    return { hostname: parts[0], pid: Number(parts[1]) };
  }

  /**
   * @param {string} id - a trimmed lock file content.
   * @returns {boolean} true only if the id is parseable, from this host,
   *   and its pid is not alive.
   */
  _isStale(id) {
    const parsed = this._parseId(id);

    if (parsed === null || parsed.hostname !== os.hostname()) {
      return false;
    }

    return !this._isAlive(parsed.pid);
  }

  /**
   * @param {number} pid - a process id.
   * @returns {boolean} false only if the process does not exist.
   */
  _isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code !== 'ESRCH';
    }
  }

  /**
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<string|null>} the lock file's trimmed contents,
   *   or null if unreadable.
   */
  async _read(lockFile) {
    try {
      return (await readFile(lockFile, 'utf8')).trim();
    } catch {
      return null;
    }
  }

  /**
   * @param {number} ms - milliseconds to wait.
   * @returns {Promise<void>} resolves after the wait.
   */
  _sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export default Lock;
