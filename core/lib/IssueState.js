import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from './Lock.js';

/**
 * Native equivalent of `arcanum/_lib/issue_state.sh`'s `set`/`set-json`
 * writes: safe, lock-protected read/mutate/write of
 * `.claude/state/issue-<id>.json`. Kept deliberately unsimplified per
 * the issue's Scope section (a longer-horizon plan may move this state
 * onto a dedicated server).
 */
class IssueState {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper.
   */
  constructor({ lock = new Lock() } = {}) {
    this._lock = lock;
  }

  /**
   * Merge `<fields>` into `<repoPath>/.claude/state/issue-<id>.json`,
   * holding the lock for the whole read/merge/write.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @param {object} fields - the fields to set (e.g. `tags`,
   *   `updated_at`, `title`, `state`).
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async write(repoPath, id, fields) {
    const stateDir = path.join(repoPath, '.claude', 'state');
    const stateFile = path.join(stateDir, `issue-${id}.json`);
    const lockFile = path.join(stateDir, `issue-${id}.lock`);

    await mkdir(stateDir, { recursive: true });
    await this._lock.acquire(lockFile);

    try {
      const current = await this._read(stateFile);
      const updated = { ...current, ...fields };
      const tmpFile = `${stateFile}.tmp`;

      await writeFile(tmpFile, JSON.stringify(updated));
      await rename(tmpFile, stateFile);
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * @param {string} stateFile - the state file's path.
   * @returns {Promise<object>} the parsed state, or `{}` if
   *   absent/empty/invalid.
   */
  async _read(stateFile) {
    let raw;

    try {
      raw = await readFile(stateFile, 'utf8');
    } catch {
      return {};
    }

    if (!raw.trim()) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export default IssueState;
