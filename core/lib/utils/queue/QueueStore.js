import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATE_DIR = path.join('.claude', 'state');
const DEFAULT_QUEUE_FILE = 'auto-fix-all-queue.json';
const DEFAULT_LOCK_FILE = 'auto-fix-all-queue.lock';

/**
 * Generic queue-file store: owns the pure file I/O for a repo's
 * `[{"id": "<id>"}, ...]` JSON queue under `.claude/state/`, with no
 * GitHub or lock dependency — the lock acquire/read/write/release
 * transaction itself is owned by the caller (see `AutoFixAllQueue.js`
 * and `MonitorIssuesRewriteQueue.js`), since it spans two `QueueStore`
 * calls. The queue/lock file names are configurable and default to
 * auto-fix-all's (`auto-fix-all-queue.{json,lock}`); e.g. monitor-issues'
 * rewrite queue uses `monitor-issues-rewrite-queue.{json,lock}`. Takes
 * its target repo's `repoContext` at construction rather than a
 * per-call `repoPath`.
 */
class QueueStore {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context; `read`/`write`/`queueFile`/`lockFile`
   *   all resolve their target path from `repoContext.repoPath`.
   * @param {object} [opts] - options.
   * @param {string} [opts.queueFile] - the queue file's name, resolved
   *   under `<repoPath>/.claude/state/` (defaults to
   *   `auto-fix-all-queue.json`).
   * @param {string} [opts.lockFile] - the lock file's name, resolved
   *   under `<repoPath>/.claude/state/` (defaults to
   *   `auto-fix-all-queue.lock`).
   */
  constructor(repoContext, {
    queueFile = DEFAULT_QUEUE_FILE,
    lockFile = DEFAULT_LOCK_FILE
  } = {}) {
    this._repoContext = repoContext;
    this._queueFileName = queueFile;
    this._lockFileName = lockFile;
  }

  /**
   * Reads the queue array, mirroring `_read_queue`'s `[[ -s
   * "$QUEUE_FILE" ]]` check: absent or empty file reads as `[]`; an
   * existing, non-empty file is parsed as JSON (a malformed file throws,
   * matching the shell's own `jq` parse failure).
   * @returns {Promise<Array<{id: string}>>} the queue array.
   */
  async read() {
    let raw;

    try {
      raw = await readFile(this.queueFile(), 'utf8');
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
   * @param {Array<{id: string}>} entries - the queue's new contents.
   * @returns {Promise<void>} resolves once written.
   */
  async write(entries) {
    const file = this.queueFile();

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`);
  }

  /**
   * @returns {string} the queue file's absolute path, under
   *   `<repoPath>/.claude/state/`.
   */
  queueFile() {
    return path.join(this._repoContext.repoPath, STATE_DIR, this._queueFileName);
  }

  /**
   * @returns {string} the lock file's absolute path, under
   *   `<repoPath>/.claude/state/`.
   */
  lockFile() {
    return path.join(this._repoContext.repoPath, STATE_DIR, this._lockFileName);
  }
}

export default QueueStore;
