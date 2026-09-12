import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import GitClient from '../../utils/git/GitClient.js';
import GitHubClient from '../../utils/github/GitHubClient.js';
import GithubToken from '../../utils/github/GithubToken.js';
import IssueStatePaths from '../../utils/file/IssueStatePaths.js';
import IssueStateService from '../../services/IssueStateService.js';
import JsonReader from '../../utils/json/JsonReader.js';
import PrMonitor from '../../services/PrMonitor.js';

const USAGE = 'Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]';
const DEFAULT_LAST_COMMENT_TIME = '1970-01-01T00:00:00Z';

/**
 * Native equivalent of `auto-monitor-pr/scripts/monitor_pr_shell.sh`: a
 * single-pass check for merge/close/approval/new-owner-comments on a
 * pull request. A pure orchestrator (CLI-flag parsing, dual state-file
 * read/write, and calling into `PrMonitor` for every decision) — no
 * GitHub-call or comment-normalization logic lives here, matching
 * `AutoMonitorIssuePrResolvePrNumber.js`'s composition pattern. See
 * docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/node.md.
 *
 * Two design notes worth recording (per that plan's node/01 and node/04
 * steps):
 *   - `PR_OWNER` resolution is deliberately `GithubToken#ghUser` (the
 *     configured `user.ghuser` git config value), NOT
 *     `GitHubClient#getCurrentUser()` — the shell's own `get_gh_user`
 *     (`arcanum/_lib/origin.sh`) reads that git config value directly,
 *     never `gh api user`. An unset `user.ghuser` means "watch nobody's
 *     comments" (empty owner, matches nothing) in the shell, which only
 *     `ghUser` reproduces exactly; `getCurrentUser()` would instead
 *     resolve to whichever account `gh auth token` currently returns,
 *     diverging from the shell on that edge case.
 *   - `push_current_branch` (best-effort, `arcanum/_lib/push.sh`) is
 *     replicated via `GitClient#pushCurrentBranch` (added alongside this
 *     command) rather than omitted — this script is reachable right
 *     after `auto-fix-all` pushes a fix for previously-reported
 *     comments (see `auto-monitor-issue-pr/steps/run.md`), so the push
 *     is a genuine, not dead-weight, behavior to preserve.
 */
class AutoMonitorPrMonitorPr {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus `origin`/
   *   `githubToken` resolution).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {GitHubClient} [deps.githubClient] - GitHub REST/GraphQL
   *   client, forwarded into the self-built `PrMonitor` when `prMonitor`
   *   is omitted.
   * @param {GithubToken} [deps.githubToken] - resolves `PR_OWNER` via
   *   `#ghUser`.
   * @param {GitClient} [deps.gitClient] - git CLI client, for the
   *   best-effort `pushCurrentBranch` call.
   * @param {IssueStatePaths} [deps.issueStatePaths] - state/lock path
   *   resolver, for both the issue-state file path and the
   *   `issueStateService` default.
   * @param {IssueStateService} [deps.issueStateService] - issue
   *   state-file reader/writer, used on the `--issue-id` path.
   * @param {JsonReader} [deps.jsonReader] - JSON-file reader, used to
   *   read the raw comments-state object on either state-file shape.
   * @param {PrMonitor} [deps.prMonitor] - poll/normalize/decide service.
   */
  constructor(repoContext, {
    githubClient = new GitHubClient({ context: repoContext }),
    githubToken = new GithubToken({ repoContext }),
    gitClient = new GitClient({ context: repoContext }),
    issueStatePaths = new IssueStatePaths(repoContext),
    issueStateService = new IssueStateService({ context: repoContext, issueStatePaths }),
    jsonReader = new JsonReader(),
    prMonitor = new PrMonitor({ githubClient })
  } = {}) {
    this._repoContext = repoContext;
    this._githubToken = githubToken;
    this._gitClient = gitClient;
    this._issueStatePaths = issueStatePaths;
    this._issueStateService = issueStateService;
    this._jsonReader = jsonReader;
    this._prMonitor = prMonitor;
  }

  /**
   * Native implementation of `monitor_pr_shell.sh`'s full body — see
   * this file's own class doc for the two behavior-preserving design
   * choices (`PR_OWNER` resolution, `push_current_branch`).
   * @param {...string} args - `--pr-number <pr_number> [--issue-id
   *   <id>]`, in either order.
   * @returns {Promise<string>} `merged\n` / `closed\n` / `approved\n` /
   *   `pending\n`, or `commented\n` followed by one `---`-preceded
   *   `id`/`url`/body block per new owner comment.
   * @throws {Error} `Usage: monitor_pr.sh <repo_path> --pr-number
   *   <pr_number> [--issue-id <id>]` when `--pr-number` is missing/empty
   *   or an unrecognized flag appears.
   */
  async run(...args) {
    const { prNumber, issueId } = this._parseArgs(args);
    const owner = await this._githubToken.ghUser(this._repoContext.repoPath);

    let state = await this._loadCommentsState(issueId, prNumber);
    state = await this._resolveProcessingToAddressed(issueId, prNumber, state);

    await this._gitClient.pushCurrentBranch();

    const terminal = await this._prMonitor.resolveState(prNumber, owner);

    if (terminal === 'merged') {
      await this._deleteCommentsState(issueId, prNumber);

      return 'merged\n';
    }

    if (terminal === 'closed') {
      return 'closed\n';
    }

    if (terminal === 'approved') {
      return 'approved\n';
    }

    const newComments = await this._prMonitor.newOwnerComments(prNumber, owner, state.lastCommentTime);

    if (!newComments || newComments.length === 0) {
      return 'pending\n';
    }

    if (newComments.some((comment) => this._prMonitor.isShipit(comment.body))) {
      return 'approved\n';
    }

    return this._recordAndReportComments(issueId, prNumber, state, newComments);
  }

  /**
   * Parse `--pr-number <n>` / `--issue-id <id>`, matching
   * `monitor_pr_shell.sh` lines 76–98 exactly: `--pr-number` tolerates
   * a leading `#` (stripped), `--issue-id` does not, and any
   * unrecognized flag (or a missing/empty `--pr-number`) is a usage
   * error.
   * @param {string[]} args - the raw CLI arguments.
   * @returns {{prNumber: string, issueId: string}} the parsed flags.
   * @throws {Error} `USAGE` on a missing/empty `--pr-number` or an
   *   unrecognized flag.
   */
  _parseArgs(args) {
    const remaining = [...args];
    let prNumber = '';
    let issueId = '';

    while (remaining.length > 0) {
      const flag = remaining.shift();

      if (flag === '--pr-number') {
        prNumber = remaining.shift() ?? '';
        continue;
      }

      if (flag === '--issue-id') {
        issueId = remaining.shift() ?? '';
        continue;
      }

      throw new Error(USAGE);
    }

    prNumber = prNumber.replace(/^#/, '');

    if (!prNumber) {
      throw new Error(USAGE);
    }

    return { prNumber, issueId };
  }

  /**
   * @param {string} prNumber - the pull request number.
   * @returns {string} the legacy per-PR comments-state file's path.
   */
  _legacyCommentsFile(prNumber) {
    return path.join(this._repoContext.repoPath, '.claude', 'state', `auto-monitor-pr-${prNumber}-comments.json`);
  }

  /**
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @returns {string} whichever comments-state file is active for this
   *   invocation.
   */
  _commentsFile(issueId, prNumber) {
    return issueId ? this._issueStatePaths.paths(issueId).stateFile : this._legacyCommentsFile(prNumber);
  }

  /**
   * Native equivalent of `load_comments_state` (lines 115–130): reads
   * whichever comments-state file is active, defaulting to `[]`/
   * `1970-01-01T00:00:00Z` for a missing/malformed file or field.
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @returns {Promise<{prComments: Array, lastCommentTime: string}>} the
   *   loaded state.
   */
  async _loadCommentsState(issueId, prNumber) {
    const current = await this._jsonReader.read(this._commentsFile(issueId, prNumber));

    return {
      prComments: Array.isArray(current.pr_comments) ? current.pr_comments : [],
      lastCommentTime: typeof current.last_comment_time === 'string' ? current.last_comment_time : DEFAULT_LAST_COMMENT_TIME
    };
  }

  /**
   * Native equivalent of `save_comments_state` (lines 132–143): merges
   * `pr_comments`/`last_comment_time` into `issue-<id>.json` (via
   * `IssueStateService#write`, lock-protected) when `issueId` is given,
   * or flat-overwrites the legacy per-PR file otherwise.
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @param {{prComments: Array, lastCommentTime: string}} state - the
   *   state to persist.
   * @returns {Promise<void>} resolves once the state file is written.
   */
  async _saveCommentsState(issueId, prNumber, state) {
    const fields = { pr_comments: state.prComments, last_comment_time: state.lastCommentTime };

    if (issueId) {
      await this._issueStateService.write(issueId, fields);

      return;
    }

    const file = this._legacyCommentsFile(prNumber);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(fields, null, 2)}\n`);
  }

  /**
   * `rm -f`-equivalent delete of whichever comments-state file is
   * active, on a `merged` outcome (lines 168–176).
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @returns {Promise<void>} resolves regardless of whether the file
   *   existed.
   */
  async _deleteCommentsState(issueId, prNumber) {
    await rm(this._commentsFile(issueId, prNumber), { force: true });
  }

  /**
   * Native equivalent of lines 145–157: on every invocation, before
   * polling, resolve any `processing` entry to `addressed` (swap its
   * `:eyes:` reaction for `:+1:`), unconditionally and regardless of
   * which state-file shape is active.
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @param {{prComments: Array, lastCommentTime: string}} state - the
   *   freshly loaded state.
   * @returns {Promise<{prComments: Array, lastCommentTime: string}>} the
   *   (possibly updated) state — unchanged when there was nothing to
   *   resolve.
   */
  async _resolveProcessingToAddressed(issueId, prNumber, state) {
    const processing = state.prComments.filter((comment) => comment.state === 'processing');

    if (processing.length === 0) {
      return state;
    }

    for (const comment of processing) {
      await this._prMonitor.resolveAddressed(comment.id);
    }

    const updated = {
      prComments: state.prComments.map((comment) => (
        comment.state === 'processing' ? { ...comment, state: 'addressed', emojis: [':+1:'] } : comment
      )),
      lastCommentTime: state.lastCommentTime
    };

    await this._saveCommentsState(issueId, prNumber, updated);

    return updated;
  }

  /**
   * Native equivalent of lines 233–251 ("Phase 1"/"Phase 2"/"Phase 3"):
   * persist `newComments` as `fetched` (crash-recovery checkpoint), add
   * `:eyes:` and persist them as `processing`, then build the
   * `commented` output. Only reached once `newComments` is known
   * non-empty and shipit-free.
   * @param {string} issueId - the issue id (empty for the legacy shape).
   * @param {string} prNumber - the pull request number.
   * @param {{prComments: Array, lastCommentTime: string}} state - the
   *   state loaded (and possibly processing→addressed-resolved) earlier
   *   in `#run`.
   * @param {Array} newComments - the newly observed owner comments, in
   *   source-concatenation order.
   * @returns {Promise<string>} the `commented\n---\n...` output.
   */
  async _recordAndReportComments(issueId, prNumber, state, newComments) {
    const latestTime = newComments.reduce(
      (max, comment) => (comment.createdAt > max ? comment.createdAt : max), newComments[0].createdAt
    );

    const fetchedEntries = newComments.map((comment) => (
      { id: comment.id, user: comment.login, url: comment.url, state: 'fetched', emojis: [] }
    ));

    let updated = { prComments: [...state.prComments, ...fetchedEntries], lastCommentTime: latestTime };

    await this._saveCommentsState(issueId, prNumber, updated);

    for (const comment of newComments) {
      await this._prMonitor.addEyes(comment.id);
    }

    updated = {
      prComments: updated.prComments.map((entry) => (
        entry.state === 'fetched' ? { ...entry, state: 'processing', emojis: [':eyes:'] } : entry
      )),
      lastCommentTime: updated.lastCommentTime
    };

    await this._saveCommentsState(issueId, prNumber, updated);

    const blocks = newComments
      .map((comment) => `---\nid: ${comment.id}\nurl: ${comment.url}\n${comment.body}`)
      .join('\n');

    return `commented\n${blocks}\n`;
  }
}

export default AutoMonitorPrMonitorPr;
