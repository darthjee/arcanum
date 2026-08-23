import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import DispatchFailure from './DispatchFailure.js';
import GithubToken from './GithubToken.js';
import Lock from './Lock.js';
import Origin from './Origin.js';
import { LABEL_TO_TAG } from './Tags.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const QUEUE_RELATIVE_PATH = path.join('.claude', 'state', 'auto-fix-all-queue.json');
const LOCK_RELATIVE_PATH = path.join('.claude', 'state', 'auto-fix-all-queue.lock');

// Reverse of Tags.js's LABEL_TO_TAG — resolves the 3 canonical tag
// names this module's best-effort label mutation touches
// (enqueued/ready_for_work/created) to their exact GitHub label names,
// rather than hardcoding a second copy of that mapping.
const TAG_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_TAG).map(([label, tag]) => [tag, label])
);

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
 * `core/lib/Lock.js`) against concurrent mutation. `save`/`push` also
 * best-effort tag-mutate the affected GitHub issues (`enqueued` added,
 * `ready_for_work`/`created` removed) — see
 * docs/agents/plans/264-migrate-auto-fix-all-queue-entrypoint-save-next-wait-next-push-pop-empty-list-to-native-node-js/node.md.
 */
class AutoFixAllQueue {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Lock} [deps.lock] - the lock/mutate/release helper used to
   *   guard `push`/`pop`.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default), used for the best-effort label
   *   mutation's GitHub REST calls.
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   * @param {number} [deps.pollIntervalMs] - `waitNext`'s poll interval,
   *   overridable for tests (defaults to the shell script's real 5s
   *   `sleep 5`).
   * @param {Function} [deps.sleepFn] - `waitNext`'s poll-loop sleep
   *   implementation, overridable for tests (defaults to a real
   *   `setTimeout`-based sleep).
   */
  constructor({
    lock = new Lock(),
    origin = new Origin(),
    githubToken = new GithubToken(),
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._lock = lock;
    this._origin = origin;
    this._githubToken = githubToken;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
    this._pollIntervalMs = pollIntervalMs;
    this._sleep = sleepFn;
  }

  /**
   * Native implementation of `queue_save_shell.sh`: overwrites the
   * queue with the given ids, then best-effort tags the affected
   * issues as enqueued. Not lock-guarded (matches today's `save`).
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {...string} ids - the ids to save, in order.
   * @returns {Promise<string>} `Queue saved: <ids>\n`.
   * @throws {Error} `Error: save requires at least one ID` when no ids
   *   are given.
   */
  async save(repoPath, ...ids) {
    if (ids.length === 0) {
      throw new Error('Error: save requires at least one ID');
    }

    await this._writeQueue(repoPath, ids.map((id) => ({ id })));

    const output = `Queue saved: ${ids.join(' ')}\n`;

    await this._markEnqueued(repoPath, ids);

    return output;
  }

  /**
   * Native implementation of `queue_next_shell.sh`: prints the first
   * entry's id without removing it. Not lock-guarded (read-only).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `<id>\n`, or `\n` (empty id) when the
   *   queue is empty/absent.
   */
  async next(repoPath) {
    const queue = await this._readQueue(repoPath);
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
    let queue = await this._readQueue(repoPath);

    while (queue.length === 0) {
      await this._sleep(this._pollIntervalMs);
      queue = await this._readQueue(repoPath);
    }

    return `${queue[0].id}\n`;
  }

  /**
   * Native implementation of `queue_push_shell.sh`: lock-guarded append
   * of the given ids to the end of the queue, then best-effort tags the
   * affected issues as enqueued.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {...string} ids - the ids to push, in order.
   * @returns {Promise<string>} `Pushed: <ids>\n`.
   * @throws {Error} `Error: push requires at least one ID` when no ids
   *   are given.
   */
  async push(repoPath, ...ids) {
    if (ids.length === 0) {
      throw new Error('Error: push requires at least one ID');
    }

    const lockFile = this._lockFile(repoPath);

    await this._lock.acquire(lockFile);

    try {
      const queue = await this._readQueue(repoPath);

      await this._writeQueue(repoPath, [...queue, ...ids.map((id) => ({ id }))]);
    } finally {
      await this._lock.release(lockFile);
    }

    const output = `Pushed: ${ids.join(' ')}\n`;

    await this._markEnqueued(repoPath, ids);

    return output;
  }

  /**
   * Native implementation of `queue_pop_shell.sh`: lock-guarded removal
   * of the first entry (marks the current issue as done). No stdout.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<void>} resolves once the entry is removed.
   */
  async pop(repoPath) {
    const lockFile = this._lockFile(repoPath);

    await this._lock.acquire(lockFile);

    try {
      const queue = await this._readQueue(repoPath);

      await this._writeQueue(repoPath, queue.slice(1));
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
    const queue = await this._readQueue(repoPath);

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
    const queue = await this._readQueue(repoPath);

    if (queue.length === 0) {
      return '(empty)\n';
    }

    return `${queue.map((entry) => entry.id).join('\n')}\n`;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {string} `.claude/state/auto-fix-all-queue.json`'s
   *   absolute path under `repoPath`.
   */
  _queueFile(repoPath) {
    return path.join(repoPath, QUEUE_RELATIVE_PATH);
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {string} `.claude/state/auto-fix-all-queue.lock`'s
   *   absolute path under `repoPath`.
   */
  _lockFile(repoPath) {
    return path.join(repoPath, LOCK_RELATIVE_PATH);
  }

  /**
   * Reads the queue array, mirroring `_read_queue`'s `[[ -s
   * "$QUEUE_FILE" ]]` check: absent or empty file reads as `[]`; an
   * existing, non-empty file is parsed as JSON (a malformed file throws,
   * matching the shell's own `jq` parse failure).
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<Array<{id: string}>>} the queue array.
   */
  async _readQueue(repoPath) {
    let raw;

    try {
      raw = await readFile(this._queueFile(repoPath), 'utf8');
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
  async _writeQueue(repoPath, entries) {
    const file = this._queueFile(repoPath);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`);
  }

  /**
   * Best-effort: adds the `enqueued` tag and removes the
   * `ready_for_work`/`created` tags from each given issue id, mirroring
   * `_mark_enqueued`. A failure anywhere in this step — including
   * resolving the repo's origin/GitHub token — warns to stderr and
   * never blocks the caller; the queue write has already happened by
   * the time this runs.
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string[]} ids - the affected issue ids.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _markEnqueued(repoPath, ids) {
    let repo;
    let repoRef;
    let token;

    try {
      const resolved = await this._origin.resolve(repoPath);

      repo = resolved.repo;
      repoRef = resolved.domain === 'github.com' ? resolved.repo : `${resolved.domain}/${resolved.repo}`;
      token = await this._githubToken.get(repoPath);
    } catch {
      return;
    }

    for (const id of ids) {
      await this._mutateTag(id, repo, repoRef, token, 'add', 'enqueued');
      await this._mutateTag(id, repo, repoRef, token, 'remove', 'ready_for_work');
      await this._mutateTag(id, repo, repoRef, token, 'remove', 'created');
    }
  }

  /**
   * Add or remove a single canonical tag's mapped GitHub label on issue
   * `id`, mirroring `tag_mutate_add_label`/`tag_mutate_remove_label`:
   * fetches the issue's current labels, no-ops if the label is
   * already in the desired state, otherwise mutates it. Any failure
   * (fetch or mutate) warns to stderr and never throws.
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path, for the REST calls.
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference, for the warning message only.
   * @param {string} token - the GitHub token.
   * @param {'add'|'remove'} action - whether to add or remove the tag.
   * @param {string} tag - the canonical tag name.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _mutateTag(id, repo, repoRef, token, action, tag) {
    try {
      const label = TAG_TO_LABEL[tag];
      const labels = await this._fetchLabels(id, repo, token);
      const present = labels.includes(label);

      if (action === 'add' && !present) {
        await this._addLabel(id, repo, token, label);
      } else if (action === 'remove' && present) {
        await this._removeLabel(id, repo, token, label);
      }
    } catch {
      const preposition = action === 'add' ? 'to' : 'from';

      process.stderr.write(`Warning: could not ${action} '${tag}' tag ${preposition} issue #${id} on ${repoRef}\n`);
    }
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @returns {Promise<string[]>} the issue's current GitHub label names.
   */
  async _fetchLabels(id, repo, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not fetch issue #${id} from ${repo}`);
    }

    const issue = await response.json();

    return (issue.labels || []).map((issueLabel) => issueLabel.name);
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @param {string} label - the GitHub label name to add.
   * @returns {Promise<void>} resolves once added.
   */
  async _addLabel(id, repo, token, label) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: [label] }),
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not add label '${label}' to issue #${id} on ${repo}`);
    }
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} token - the GitHub token.
   * @param {string} label - the GitHub label name to remove.
   * @returns {Promise<void>} resolves once removed.
   */
  async _removeLabel(id, repo, token, label) {
    const response = await this._fetch(
      `https://api.github.com/repos/${repo}/issues/${id}/labels/${encodeURIComponent(label)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      }
    );

    if (!response.ok) {
      throw new Error(`could not remove label '${label}' from issue #${id} on ${repo}`);
    }
  }
}

export default AutoFixAllQueue;
