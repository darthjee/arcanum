import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const QUEUE_RELATIVE_PATH = path.join('.claude', 'state', 'auto-fix-all-queue.json');
const LOCK_RELATIVE_PATH = path.join('.claude', 'state', 'auto-fix-all-queue.lock');

/**
 * Generic (not `AutoFixAll`-prefixed) queue-file store: owns the pure
 * file I/O for a repo's `.claude/state/auto-fix-all-queue.json` queue,
 * with no GitHub or lock dependency — the lock acquire/read/write/
 * release transaction itself is owned by the caller (see
 * `AutoFixAllQueue.js`), since it spans two `QueueStore` calls.
 */
class QueueStore {
  /**
   * Reads the queue array, mirroring `_read_queue`'s `[[ -s
   * "$QUEUE_FILE" ]]` check: absent or empty file reads as `[]`; an
   * existing, non-empty file is parsed as JSON (a malformed file throws,
   * matching the shell's own `jq` parse failure).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<Array<{id: string}>>} the queue array.
   */
  async read(repoPath) {
    let raw;

    try {
      raw = await readFile(this.queueFile(repoPath), 'utf8');
    } catch {
      return [];
    }

    if (raw.length === 0) {
      return [];
    }

    return JSON.parse(raw);
  }

  /**
   * Overwrites the queue file with `entries`, creating
   * `.claude/state/` first if needed.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {Array<{id: string}>} entries - the queue's new contents.
   * @returns {Promise<void>} resolves once written.
   */
  async write(repoPath, entries) {
    const file = this.queueFile(repoPath);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`);
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {string} `.claude/state/auto-fix-all-queue.json`'s
   *   absolute path under `repoPath`.
   */
  queueFile(repoPath) {
    return path.join(repoPath, QUEUE_RELATIVE_PATH);
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {string} `.claude/state/auto-fix-all-queue.lock`'s
   *   absolute path under `repoPath`.
   */
  lockFile(repoPath) {
    return path.join(repoPath, LOCK_RELATIVE_PATH);
  }
}

export default QueueStore;
