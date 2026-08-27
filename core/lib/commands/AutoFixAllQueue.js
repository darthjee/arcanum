import DispatchFailure from '../utils/errors/DispatchFailure.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueClient from '../utils/github/IssueClient.js';
import IssueTagger from '../utils/issue/IssueTagger.js';
import Lock from '../utils/file/Lock.js';
import Origin from '../utils/git/Origin.js';
import QueueStore from '../utils/queue/QueueStore.js';
import RepoContext from '../context/RepoContext.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Sleep for `ms` milliseconds, overridable for tests — same
 * injectable-sleep precedent as `Lock.js`'s `sleepMs` option and
 * `AutoFixAllWaitCi.js`'s `sleepFn`/`pollIntervalMs` options.
 * @param {number} ms - how long to sleep, in milliseconds.
 * @returns {Promise<void>} resolves once the wait has elapsed.
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Native equivalent of `auto-fix-all/scripts/queue_<subcommand>_shell.sh`
 * (split from the former single `queue.sh`): queue management for
 * auto-fix-all, with one method per subcommand (`save`, `next`,
 * `waitNext`, `push`, `pop`, `empty`, `list`). State is a JSON array in
 * `.claude/state/auto-fix-all-queue.json`; `push`/`pop` are
 * lock-guarded (`.claude/state/auto-fix-all-queue.lock`, via
 * `core/lib/utils/file/Lock.js`) against concurrent mutation. `save`/`push` also
 * best-effort tag-mutate the affected GitHub issues (`enqueued` added,
 * `ready_for_work`/`created` removed) — see
 * docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md.
 * The queue file's I/O is delegated to `QueueStore`, and the label
 * mutation is delegated to `IssueTagger` — this class keeps owning the
 * lock acquire → read → write → release sequence itself, since that
 * transaction spans two `QueueStore` calls. See
 * docs/agents/plans/253-refactor-autofixallqueue/node.md.
 */
class AutoFixAllQueue {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper used to
   *   guard `push`/`pop`.
   * @param {QueueStore} [deps.queueStore] - the queue file's I/O
   *   delegate.
   * @param {Origin} [deps.origin] - git-origin resolver, shared across
   *   each per-call `RepoContext` built by `#_issueTagger`.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver,
   *   shared across each per-call `RepoContext` built by `#_issueTagger`.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default), forwarded to the default
   *   `issueTaggerFactory`.
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   forwarded to the default `issueTaggerFactory` (ignored if
   *   `issueTaggerFactory` is also given; defaults to `IssueClient`'s
   *   own real 30s protocol value).
   * @param {Function} [deps.issueTaggerFactory] - builds an
   *   `IssueTagger` (the best-effort GitHub label-mutation delegate used
   *   by `save`/`push`) from a per-call `RepoContext` — see
   *   `#_issueTagger`. A factory, not a pre-built instance, since a
   *   context-bound `IssueTagger` can't be shared across calls once
   *   `repoPath` varies call to call. Defaults to an `IssueTagger` built
   *   from `context` plus an `IssueClient` using `fetchFn`/`timeoutMs`,
   *   so callers can override just the label-mutation transport without
   *   also passing a whole custom factory.
   * @param {number} [deps.pollIntervalMs] - `waitNext`'s poll interval,
   *   overridable for tests (defaults to the shell script's real 5s
   *   `sleep 5`).
   * @param {Function} [deps.sleepFn] - `waitNext`'s poll-loop sleep
   *   implementation, overridable for tests (defaults to a real
   *   `setTimeout`-based sleep).
   */
  constructor({
    lock = new Lock(),
    queueStore = new QueueStore(),
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs,
    issueTaggerFactory = (context) => new IssueTagger({
      context,
      issueClient: new IssueClient({ context, fetchFn, timeoutMs })
    }),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._lock = lock;
    this._queueStore = queueStore;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueTaggerFactory = issueTaggerFactory;
    this._pollIntervalMs = pollIntervalMs;
    this._sleep = sleepFn;
  }

  /**
   * Native implementation of `queue_save_shell.sh`: overwrites the
   * queue with the given ids, then best-effort tags the affected
   * issues as enqueued. Not lock-guarded (matches today's `save`).
   * Writes directly to `process.stdout` (rather than returning a
   * string) because `_mark_enqueued`'s own per-tag stdout lines
   * (`tag_mutate_add_label`/`tag_mutate_remove_label`'s "already
   * present"/"Added tag"/etc. output) are interleaved with — and always
   * come after — the `Queue saved: ...` confirmation line; the whole
   * sequence must land on stdout in that exact order, including when a
   * later step throws (`dispatch()` only prints a returned string on
   * success, never partial output from a rejected promise).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {...string} ids - the ids to save, in order.
   * @returns {Promise<void>} resolves once the queue is written and the
   *   best-effort label mutation has finished.
   * @throws {Error} `Error: save requires at least one ID` when no ids
   *   are given.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the repo's origin/GitHub token can't be resolved —
   *   see `IssueTagger#markEnqueued`'s doc comment.
   */
  async save(repoPath, ...ids) {
    if (ids.length === 0) {
      throw new Error('Error: save requires at least one ID');
    }

    await this._queueStore.write(repoPath, ids.map((id) => ({ id })));

    process.stdout.write(`Queue saved: ${ids.join(' ')}\n`);

    await this._issueTagger(repoPath).markEnqueued(ids);
  }

  /**
   * Build a per-call `IssueTagger`, wrapping `repoPath` (plus the shared
   * `origin`/`githubToken`) into a fresh `RepoContext` — mirroring
   * `AutoFixAllGithub#_issueTagger`'s own per-call context construction,
   * since a context-bound `IssueTagger` can't be a constructor-level
   * shared singleton once `repoPath` varies call to call. Building the
   * `RepoContext` itself is synchronous and doesn't resolve `origin`/
   * `token` — the actual resolution only happens once `#markEnqueued` is
   * called, so moving the context-building call earlier (before
   * `save`/`push`'s own stdout confirmation line) doesn't change when a
   * resolution failure can occur.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {IssueTagger} the per-call `IssueTagger` delegate.
   */
  _issueTagger(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken
    });

    return this._issueTaggerFactory(context);
  }

  /**
   * Native implementation of `queue_next_shell.sh`: prints the first
   * entry's id without removing it. Not lock-guarded (read-only).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<id>\n`, or `\n` (empty id) when the
   *   queue is empty/absent.
   */
  async next(repoPath) {
    const queue = await this._queueStore.read(repoPath);
    const id = queue.length > 0 ? queue[0].id : '';

    return `${id}\n`;
  }

  /**
   * Native implementation of `queue_wait_next_shell.sh`: like `next`,
   * but if the queue is empty, polls every `pollIntervalMs` (instead of
   * returning empty) until it isn't.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<id>\n`, once the queue is non-empty.
   */
  async waitNext(repoPath) {
    let queue = await this._queueStore.read(repoPath);

    while (queue.length === 0) {
      await this._sleep(this._pollIntervalMs);
      queue = await this._queueStore.read(repoPath);
    }

    return `${queue[0].id}\n`;
  }

  /**
   * Native implementation of `queue_push_shell.sh`: lock-guarded append
   * of the given ids to the end of the queue, then best-effort tags the
   * affected issues as enqueued. Writes directly to `process.stdout` —
   * see `#save`'s doc comment for why.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {...string} ids - the ids to push, in order.
   * @returns {Promise<void>} resolves once the queue is written and the
   *   best-effort label mutation has finished.
   * @throws {Error} `Error: push requires at least one ID` when no ids
   *   are given.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the repo's origin/GitHub token can't be resolved —
   *   see `IssueTagger#markEnqueued`'s doc comment.
   */
  async push(repoPath, ...ids) {
    if (ids.length === 0) {
      throw new Error('Error: push requires at least one ID');
    }

    const lockFile = this._queueStore.lockFile(repoPath);

    await this._lock.acquire(lockFile);

    try {
      const queue = await this._queueStore.read(repoPath);

      await this._queueStore.write(repoPath, [...queue, ...ids.map((id) => ({ id }))]);
    } finally {
      await this._lock.release(lockFile);
    }

    process.stdout.write(`Pushed: ${ids.join(' ')}\n`);

    await this._issueTagger(repoPath).markEnqueued(ids);
  }

  /**
   * Native implementation of `queue_pop_shell.sh`: lock-guarded removal
   * of the first entry (marks the current issue as done). No stdout.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<void>} resolves once the entry is removed.
   */
  async pop(repoPath) {
    const lockFile = this._queueStore.lockFile(repoPath);

    await this._lock.acquire(lockFile);

    try {
      const queue = await this._queueStore.read(repoPath);

      await this._queueStore.write(repoPath, queue.slice(1));
    } finally {
      await this._lock.release(lockFile);
    }
  }

  /**
   * Native implementation of `queue_empty_shell.sh`.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<void>} resolves (no stdout) when the queue has
   *   zero entries.
   * @throws {DispatchFailure} with an empty stdout payload and exit
   *   code 1 when the queue has one or more entries.
   */
  async empty(repoPath) {
    const queue = await this._queueStore.read(repoPath);

    if (queue.length === 0) {
      return;
    }

    throw new DispatchFailure('', 1);
  }

  /**
   * Native implementation of `queue_list_shell.sh`: prints every
   * remaining id, one per line.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<id>\n<id>\n...` for a non-empty queue,
   *   or `(empty)\n` when the queue has zero entries.
   */
  async list(repoPath) {
    const queue = await this._queueStore.read(repoPath);

    if (queue.length === 0) {
      return '(empty)\n';
    }

    return `${queue.map((entry) => entry.id).join('\n')}\n`;
  }
}

export default AutoFixAllQueue;
