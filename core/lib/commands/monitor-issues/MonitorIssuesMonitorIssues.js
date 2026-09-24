import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllQueue from '../auto-fix-all/AutoFixAllQueue.js';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import GithubToken from '../../utils/github/GithubToken.js';
import IssueClient from '../../utils/github/IssueClient.js';
import IssueStateService from '../../services/IssueStateService.js';
import MonitorIssuesRewriteQueue from './MonitorIssuesRewriteQueue.js';
import Tags from '../../utils/issue/Tags.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const EPOCH = '1970-01-01T00:00:00Z';
const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 };

/**
 * @param {number} ms - how long to sleep, in milliseconds.
 * @returns {Promise<void>} resolves once the wait has elapsed.
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Formats `date` as `date -u +%FT%TZ` does (UTC, whole seconds).
 * @param {Date} date - the instant to format.
 * @returns {string} e.g. `2026-01-02T03:04:05Z`.
 */
function formatTimestamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Native equivalent of `monitor-issues/scripts/monitor_issues_shell.sh`:
 * the continuous issue monitor. Every `pollIntervalMs` it searches the
 * repo's open issues (the `user.ghuser` author's only, when set) updated
 * since the cursor in `.claude/state/issue-monitor-last-checked.txt`,
 * and for each issue newer than its stored `updated_at` dispatches its
 * actionable tags in-process — `created` to the rewrite queue
 * (`MonitorIssuesRewriteQueue#push`), `ready_for_work` to the auto-fix
 * queue (`AutoFixAllQueue#push`, which also marks it enqueued),
 * `question` log-only. The issue's `updated_at`/`tags` state is only
 * recorded when every dispatch succeeded, so a failed dispatch is
 * retried on the next poll. Runs until killed; `SIGINT`/`SIGTERM`
 * remove `.claude/state/issue-monitor.lock` and exit 130/143, matching
 * the shell's `trap _release_lock EXIT`.
 *
 * The shell's `_ensure_gh_user` (`gh auth switch` to `user.ghuser`) is
 * performed by token resolution (`GithubToken#get`), which every GitHub
 * request goes through.
 */
class MonitorIssuesMonitorIssues {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {IssueClient} [deps.issueClient] - runs the issue search.
   * @param {IssueStateService} [deps.issueStateService] - per-issue
   *   state reader/writer.
   * @param {GithubToken} [deps.githubToken] - resolves `user.ghuser`.
   * @param {MonitorIssuesRewriteQueue} [deps.rewriteQueue] - the
   *   `created` dispatch target.
   * @param {AutoFixAllQueue} [deps.autoFixQueue] - the `ready_for_work`
   *   dispatch target.
   * @param {() => Date} [deps.clock] - returns the current instant.
   * @param {(ms: number) => Promise<void>} [deps.sleepFn] - the
   *   between-cycles sleep.
   * @param {number} [deps.pollIntervalMs] - the between-cycles delay.
   * @param {number} [deps.maxCycles] - stops after this many cycles
   *   (tests only; runs forever by default).
   * @param {{write: (chunk: string) => boolean}} [deps.stdout] - log sink.
   * @param {{write: (chunk: string) => boolean}} [deps.stderr] - error
   *   sink for failed dispatches.
   * @param {(code: number) => void} [deps.exitFn] - exits the process on
   *   a handled signal.
   * @param {import('node:events').EventEmitter} [deps.processRef] - the
   *   process the signal handlers are installed on.
   */
  constructor(repoContext, {
    issueClient,
    issueStateService,
    githubToken,
    rewriteQueue,
    autoFixQueue,
    clock = () => new Date(),
    sleepFn = defaultSleep,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxCycles = Infinity,
    stdout = process.stdout,
    stderr = process.stderr,
    exitFn = (code) => process.exit(code),
    processRef = process
  } = {}) {
    this._repoContext = repoContext;
    this._issueClient = issueClient ?? new IssueClient({ context: repoContext });
    this._issueStateService = issueStateService ?? new IssueStateService({ context: repoContext });
    this._githubToken = githubToken ?? new GithubToken({ repoContext });
    this._rewriteQueue = rewriteQueue ?? new MonitorIssuesRewriteQueue(repoContext);
    this._autoFixQueue = autoFixQueue ?? new AutoFixAllQueue(repoContext);
    this._clock = clock;
    this._sleep = sleepFn;
    this._pollIntervalMs = pollIntervalMs;
    this._maxCycles = maxCycles;
    this._stdout = stdout;
    this._stderr = stderr;
    this._exit = exitFn;
    this._process = processRef;
  }

  /**
   * Native `monitor_issues.sh <repo_path>`: the poll loop.
   * @returns {Promise<void>} never resolves in production (only once
   *   `maxCycles` cycles have run).
   */
  async run() {
    const handlers = this._installSignalHandlers();

    try {
      await mkdir(this._stateDir(), { recursive: true });

      const { repoRef } = await this._repoContext.resolveWithRef();

      this._author = await this._githubToken.ghUser();
      this._log(`Starting issue monitor for repo=${repoRef} user=${this._author || '<default>'}`);

      for (let cycle = 0; cycle < this._maxCycles; cycle += 1) {
        try {
          await this._pollOnce();
        } catch {
          this._log('ERROR in poll cycle — retrying after sleep');
        }

        await this._sleep(this._pollIntervalMs);
      }
    } finally {
      this._removeSignalHandlers(handlers);
      await this._releaseLock();
    }
  }

  /**
   * One poll cycle (the shell's `_poll_once`).
   * @returns {Promise<void>} resolves once every returned issue is handled.
   * @throws {Error} when the issue search fails.
   */
  async _pollOnce() {
    const since = await this._readLastChecked();

    await writeFile(this._lastCheckedFile(), `${formatTimestamp(new Date(this._clock().getTime() - 1000))}\n`);
    this._log(`Polling issues updated since ${since} ...`);

    let issues;

    try {
      issues = await this._issueClient.searchOpenIssuesUpdatedSince(since, { author: this._author });
    } catch (error) {
      this._log(`ERROR: gh issue list failed: ${error.message}`);
      throw error;
    }

    this._log(`Got ${issues.length} issue(s) from GitHub.`);

    for (const issue of issues) {
      await this._processIssue(issue);
    }
  }

  /**
   * Handles one returned issue: skip if not newer, dispatch its
   * actionable tags, and record its state only if every dispatch
   * succeeded.
   * @param {{number: number, updatedAt: string, labels: Array<{name: string}>}} issue -
   *   the search result.
   * @returns {Promise<void>} resolves once handled.
   */
  async _processIssue(issue) {
    const id = String(issue.number);
    const stored = (await this._issueStateService.get(id, 'updated_at')) || EPOCH;

    if (!(issue.updatedAt > stored)) {
      this._log(`Skipping #${id} — not newer (gh=${issue.updatedAt} stored=${stored})`);

      return;
    }

    const labels = issue.labels.map((label) => label.name);
    const tagsJson = JSON.stringify(Tags.extractTags(labels), null, 2);

    this._log(`Processing #${id} — tags: ${tagsJson}`);

    let failed = false;

    for (const tag of Tags.actionableTags(labels)) {
      if (!await this._dispatch(id, tag)) {
        failed = true;
      }
    }

    if (failed) {
      this._log(`Skipping updated_at write for #${id} — a dispatched action failed; will retry next poll`);

      return;
    }

    await this._issueStateService.set(id, 'updated_at', formatTimestamp(this._clock()));
    await this._issueStateService.setJson(id, 'tags', tagsJson);
    this._log(`Processed #${id} — updated_at recorded`);
  }

  /**
   * Dispatches one actionable tag.
   * @param {string} id - the issue id.
   * @param {string} tag - one of `Tags.actionableTags`' values.
   * @returns {Promise<boolean>} `false` when the dispatch failed.
   */
  async _dispatch(id, tag) {
    if (tag === 'question') {
      this._log(`Issue #${id} has actionable tag 'question' — needs an answer from the agent`);

      return true;
    }

    if (tag === 'created') {
      this._log(`Issue #${id} has actionable tag 'created' — pushing to rewrite queue`);

      return this._attempt(
        async () => this._stdout.write(await this._rewriteQueue.push(id)),
        `ERROR: failed to push #${id} to the rewrite queue`
      );
    }

    this._log(`Issue #${id} has actionable tag 'ready_for_work' — pushing to auto-fix-all queue`);

    return this._attempt(
      () => this._autoFixQueue.push(id),
      `ERROR: failed to push #${id} to the queue`
    );
  }

  /**
   * Runs an in-process dispatch, reporting its failure the way the
   * shell's subprocess would (a `DispatchFailure`'s stdout payload, or
   * the error message on stderr) followed by `failureLog`.
   * @param {() => Promise<unknown>} fn - the dispatch.
   * @param {string} failureLog - the log line on failure.
   * @returns {Promise<boolean>} whether it succeeded.
   */
  async _attempt(fn, failureLog) {
    try {
      await fn();

      return true;
    } catch (error) {
      if (error instanceof DispatchFailure) {
        this._stdout.write(error.stdout);
      } else {
        this._stderr.write(`${error.message}\n`);
      }

      this._log(failureLog);

      return false;
    }
  }

  /**
   * The shell's `_read_last_checked`: the cursor file's content (minus
   * its trailing newline), or the epoch when absent/empty.
   * @returns {Promise<string>} the `SINCE` timestamp.
   */
  async _readLastChecked() {
    let raw;

    try {
      raw = await readFile(this._lastCheckedFile(), 'utf8');
    } catch {
      return EPOCH;
    }

    return raw.length === 0 ? EPOCH : raw.replace(/\n+$/, '');
  }

  /**
   * @param {string} message - the log message.
   * @returns {void}
   */
  _log(message) {
    this._stdout.write(`[${formatTimestamp(this._clock())}] ${message}\n`);
  }

  /**
   * Installs the `SIGINT`/`SIGTERM` handlers releasing the lock and
   * exiting 130/143.
   * @returns {Array<[string, () => Promise<void>]>} the installed
   *   handlers, for `_removeSignalHandlers`.
   */
  _installSignalHandlers() {
    return Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => {
      const handler = async () => {
        await this._releaseLock();
        this._exit(code);
      };

      this._process.on(signal, handler);

      return [signal, handler];
    });
  }

  /**
   * @param {Array<[string, () => Promise<void>]>} handlers - the
   *   handlers `_installSignalHandlers` returned.
   * @returns {void}
   */
  _removeSignalHandlers(handlers) {
    for (const [signal, handler] of handlers) {
      this._process.removeListener(signal, handler);
    }
  }

  /**
   * The shell's `_release_lock`: removes the monitor's lock file.
   * @returns {Promise<void>} resolves once removed.
   */
  async _releaseLock() {
    await rm(path.join(this._stateDir(), 'issue-monitor.lock'), { force: true });
  }

  /**
   * @returns {string} `<repoPath>/.claude/state`.
   */
  _stateDir() {
    return path.join(this._repoContext.repoPath, '.claude', 'state');
  }

  /**
   * @returns {string} the cursor file's path.
   */
  _lastCheckedFile() {
    return path.join(this._stateDir(), 'issue-monitor-last-checked.txt');
  }
}

export default MonitorIssuesMonitorIssues;
