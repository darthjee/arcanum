import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import Lock from '../../utils/file/Lock.js';
import QueueStore from '../../utils/queue/QueueStore.js';

/**
 * Native equivalent of `monitor-issues/scripts/rewrite_queue_<subcommand>_shell.sh`
 * (`push`, `pop`): the monitor-issues rewrite queue, a JSON array of
 * `{"id": "<id>"}` entries in
 * `.claude/state/monitor-issues-rewrite-queue.json`, lock-guarded by
 * `.claude/state/monitor-issues-rewrite-queue.lock`. `repoContext.repoPath`
 * is the shim's `$PWD`, since `rewrite_queue.sh` resolves its files
 * relative to the cwd. Also used in-process by `MonitorIssuesMonitorIssues`.
 */
class MonitorIssuesRewriteQueue {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (only its `repoPath` is used).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock helper guarding push/pop.
   * @param {QueueStore} [deps.queueStore] - the queue file's I/O
   *   delegate. Defaults to a `QueueStore` on the rewrite-queue files.
   */
  constructor(repoContext, { lock = new Lock(), queueStore } = {}) {
    this._repoContext = repoContext;
    this._lock = lock;
    this._queueStore = queueStore ?? new QueueStore(repoContext, {
      queueFile: 'monitor-issues-rewrite-queue.json',
      lockFile: 'monitor-issues-rewrite-queue.lock'
    });
  }

  /**
   * Native `rewrite_queue.sh push <id>`: idempotent, lock-guarded append.
   * @param {string} id - the issue id to enqueue.
   * @returns {Promise<string>} `Pushed: <id>\n`.
   * @throws {Error} `Error: push requires an ID` when `id` is missing.
   */
  async push(id) {
    if (!id) {
      throw new Error('Error: push requires an ID');
    }

    await this._withLock(async () => {
      const queue = await this._queueStore.read();
      const present = queue.some((entry) => entry.id === id);

      await this._queueStore.write(present ? queue : [...queue, { id }]);
    });

    return `Pushed: ${id}\n`;
  }

  /**
   * Native `rewrite_queue.sh pop`: lock-guarded removal of the first
   * entry.
   * @returns {Promise<string>} `<id>\n`, the removed entry's id.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the queue is empty.
   */
  async pop() {
    const id = await this._withLock(async () => {
      const queue = await this._queueStore.read();
      const first = queue.length > 0 && queue[0].id ? String(queue[0].id) : '';

      if (first) {
        await this._queueStore.write(queue.slice(1));
      }

      return first;
    });

    if (!id) {
      throw new DispatchFailure('', 1);
    }

    return `${id}\n`;
  }

  /**
   * @param {() => Promise<string|void>} fn - the mutation to run under
   *   the queue lock.
   * @returns {Promise<string|void>} `fn`'s result.
   */
  async _withLock(fn) {
    const lockFile = this._queueStore.lockFile();

    await this._lock.acquire(lockFile);

    try {
      return await fn();
    } finally {
      await this._lock.release(lockFile);
    }
  }
}

export default MonitorIssuesRewriteQueue;
