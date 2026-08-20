import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_SLEEP_MS = 1000;
const WARN_AFTER_ATTEMPTS = 10;

/**
 * Generic lock/mutate/release helper for shared JSON state files,
 * mirroring `arcanum/_lib/lock.sh`'s protocol: write a unique instance
 * id, sleep, re-read to confirm the lock is still held, retry on loss
 * (warn once after 10 consecutive failed attempts). Never gives up. See
 * docs/agents/architecture/lock-system.md.
 */
class Lock {
  /**
   * @param {object} [opts] - options.
   * @param {number} [opts.sleepMs] - the wait between the write and the
   *   re-read, overridable for tests (defaults to the real 1000ms
   *   protocol delay).
   */
  constructor({ sleepMs = DEFAULT_SLEEP_MS } = {}) {
    this._sleepMs = sleepMs;
  }

  /**
   * Acquire the lock at `<lockFile>`, retrying indefinitely on
   * contention.
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<void>} resolves once this instance holds the lock.
   */
  async acquire(lockFile) {
    await mkdir(path.dirname(lockFile), { recursive: true });

    const instanceId = `${os.hostname()}-${process.pid}-${Date.now()}-${process.hrtime.bigint()}`;
    let attempt = 0;
    let warned = false;

    for (;;) {
      attempt += 1;
      await writeFile(lockFile, instanceId);
      await this._sleep(this._sleepMs);

      const held = await this._read(lockFile);

      if (held === instanceId) {
        return;
      }

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
   * Release the lock at `<lockFile>`.
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<void>} resolves once the lock file is removed.
   */
  async release(lockFile) {
    await rm(lockFile, { force: true });
  }

  /**
   * @param {string} lockFile - the lock file's path.
   * @returns {Promise<string|null>} the lock file's current contents,
   *   or null if unreadable.
   */
  async _read(lockFile) {
    try {
      return await readFile(lockFile, 'utf8');
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
