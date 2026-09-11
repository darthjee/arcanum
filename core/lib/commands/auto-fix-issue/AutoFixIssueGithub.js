import { readFile } from 'node:fs/promises';
import DispatchFailure from '../../utils/errors/DispatchFailure.js';
import Git from '../../utils/git/Git.js';
import GitHubClient from '../../utils/github/GitHubClient.js';
import IssueStateService from '../../services/IssueStateService.js';
import IssueStatePaths from '../../utils/file/IssueStatePaths.js';
import IssueTagger from '../../utils/issue/IssueTagger.js';
import Tags from '../../utils/issue/Tags.js';

const PR_CREATE_USAGE = 'Usage: github.sh pr-create <repo_path> <title> <file>';

/**
 * Native equivalent of `auto-fix-issue/scripts/github_shell.sh`: the
 * `info`/`pr-create`/`pr-view`/`pr-ready` subcommands, each exposed here
 * as its own public method (`info`/`prCreate`/`prView`/`prReady`,
 * dispatched to individually via `core/lib/core/commands.js`'s
 * `auto-fix-issue-github-*` entries). A pure orchestrator, mirroring
 * `PrOperations.js`'s direct-construction style: every infrastructure
 * concern (tokens, repo refs, GitHub REST/GraphQL calls, issue-state
 * persistence, label mutation) is resolved by context-bound
 * collaborators (`GitHubClient`/`Git`/`IssueTagger`/`IssueStateService`,
 * all bound to the same `repoContext` at construction). See
 * docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node.md.
 */
class AutoFixIssueGithub {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus `origin`/
   *   `githubToken` resolution).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {GitHubClient} [deps.githubClient] - GitHub REST/GraphQL
   *   client, for PR lookup/create/ready-for-review.
   * @param {Git} [deps.git] - git facade, for the current branch.
   * @param {IssueTagger} [deps.issueTagger] - best-effort issue label
   *   mutation/lookup delegate, used by `#_syncPrLabelsAndState`.
   * @param {Function} [deps.readFile] - `fs.readFile`-compatible reader,
   *   used by `prCreate` to read the PR body file.
   * @param {IssueStatePaths} [deps.issueStatePaths] - state/lock path
   *   resolver, forwarded to the self-built `IssueStateService` when
   *   `issueStateService` is omitted.
   * @param {IssueStateService} [deps.issueStateService] - issue
   *   state-file reader/writer, used by `#_persistPrState`/
   *   `#_syncPrLabelsAndState` to persist `pr_url`/`pr_id`/`tags`
   *   in-process (not by shelling out to `core/bin/arcanum issue-state`).
   */
  constructor(repoContext, {
    githubClient = new GitHubClient({ context: repoContext }),
    git = new Git({ context: repoContext }),
    issueTagger = new IssueTagger({ context: repoContext }),
    issueStatePaths = new IssueStatePaths(repoContext),
    issueStateService = new IssueStateService({ context: repoContext, issueStatePaths }),
    readFile: readFileDep = readFile
  } = {}) {
    this._repoContext = repoContext;
    this._githubClient = githubClient;
    this._git = git;
    this._issueTagger = issueTagger;
    this._issueStateService = issueStateService;
    this._readFile = readFileDep;
  }

  /**
   * Native implementation of `github_shell.sh`'s `cmd_info`: prints the
   * target repo's origin domain/repo. No usage-arg validation beyond
   * `repoPath` — handled upstream by `Dispatcher`/`RepoContext#validate()`.
   * @returns {Promise<string>} `DOMAIN=<domain>\nREPO=<repo>\n`.
   */
  async info() {
    const { domain, repo } = await this._repoContext.resolveWithRef();

    return `DOMAIN=${domain}\nREPO=${repo}\n`;
  }

  /**
   * Native implementation of `github_shell.sh`'s `cmd_pr_create`:
   * creates a pull request from `title`/`file`'s contents, persists its
   * url/number onto the current `issue-<id>` branch's state (if any),
   * and best-effort syncs the issue's `pr` label/tags.
   * @param {string} title - the pull request title.
   * @param {string} file - the local file whose contents become the
   *   pull request body.
   * @returns {Promise<string>} `<url>\n`, the created pull request's URL.
   * @throws {Error} `Usage: github.sh pr-create <repo_path> <title>
   *   <file>` when `title`/`file` is missing.
   * @throws {Error} `Error: file not found: <file>` when `file` doesn't
   *   exist.
   * @throws {Error} `Error: could not create PR on <repoRef>` on any
   *   creation failure.
   */
  async prCreate(title, file) {
    if (!title || !file) {
      throw new Error(PR_CREATE_USAGE);
    }

    let body;

    try {
      body = await this._readFile(file, 'utf8');
    } catch {
      throw new Error(`Error: file not found: ${file}`);
    }

    const { repoRef } = await this._repoContext.resolveWithRef();
    let url;

    try {
      url = await this._githubClient.createPr(title, body);
    } catch {
      throw new Error(`Error: could not create PR on ${repoRef}`);
    }

    await this._persistPrState(url);
    await this._syncPrLabelsAndState();

    return `${url}\n`;
  }

  /**
   * Native implementation of `github_shell.sh`'s `cmd_pr_view`: prints
   * the current branch's pull request url/draft-state, persisting its
   * url onto the current `issue-<id>` branch's state (if any).
   * @returns {Promise<string>} `URL=<url>\nIS_DRAFT=<draft>\n`.
   * @throws {DispatchFailure} an empty stdout payload and exit code 1,
   *   matching the shell's silent exit-1 contract, when no pull request
   *   is found for the current branch.
   */
  async prView() {
    const branch = await this._git.currentBranch();
    let pull;

    try {
      pull = await this._githubClient.getPr(branch);
    } catch {
      throw new DispatchFailure('', 1);
    }

    await this._persistPrState(pull.html_url);

    return `URL=${pull.html_url}\nIS_DRAFT=${pull.draft}\n`;
  }

  /**
   * Native implementation of `github_shell.sh`'s `cmd_pr_ready`: marks
   * the current branch's pull request ready for review, best-effort
   * re-persists its url, and best-effort syncs the issue's `pr` label/
   * tags.
   * @returns {Promise<string>} `OK\n`.
   * @throws {Error} `Error: could not mark PR ready on <repoRef>` when
   *   the pull request lookup or the ready-for-review mutation fails.
   */
  async prReady() {
    const branch = await this._git.currentBranch();
    const { repoRef } = await this._repoContext.resolveWithRef();

    try {
      const pull = await this._githubClient.getPr(branch);

      await this._githubClient.markPrReady(pull.node_id);
    } catch {
      throw new Error(`Error: could not mark PR ready on ${repoRef}`);
    }

    try {
      const refreshed = await this._githubClient.getPr(branch);

      if (refreshed && refreshed.html_url) {
        await this._persistPrState(refreshed.html_url);
      }
    } catch {
      // best-effort re-fetch, mirroring the shell's own `|| true`.
    }

    await this._syncPrLabelsAndState();

    return 'OK\n';
  }

  /**
   * Native equivalent of `github_shell.sh`'s `_current_issue_id`.
   * @returns {Promise<{id: string, branch: string}|null>} the current
   *   branch's parsed issue id/branch, or `null` when the current branch
   *   doesn't match `issue-<id>`.
   */
  async _currentIssueId() {
    return this._git.issueFromCurrentBranch();
  }

  /**
   * Native equivalent of `github_shell.sh`'s `_persist_pr_state`: a
   * no-op off an `issue-<id>` branch; otherwise best-effort persists
   * `pr_url`/`pr_id` (extracted from `url`'s last path segment) onto the
   * current issue's state, tolerating any failure (mirroring the
   * shell's own `2>/dev/null || true` on both calls).
   * @param {string} url - the pull request's url.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _persistPrState(url) {
    const issue = await this._currentIssueId();

    if (!issue) {
      return;
    }

    const number = url.split('/').pop();

    try {
      await this._issueStateService.set(issue.id, 'pr_url', url);
    } catch {
      // best-effort — mirrors the shell's own `2>/dev/null || true`.
    }

    try {
      await this._issueStateService.set(issue.id, 'pr_id', number);
    } catch {
      // best-effort — mirrors the shell's own `2>/dev/null || true`.
    }
  }

  /**
   * Native equivalent of `github_shell.sh`'s `_sync_pr_labels_and_state`:
   * a no-op off an `issue-<id>` branch; otherwise best-effort adds the
   * `pr` label to the issue (via `IssueTagger#mutateTag`, which already
   * prints its own stdout/stderr exactly like `tag_mutate_add_label`),
   * refreshes the issue's `tags` state field from its current GitHub
   * labels, and — when those tags include `shipit` — best-effort adds
   * the PR-only `auto-shipit` label directly to the pull request.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _syncPrLabelsAndState() {
    const issue = await this._currentIssueId();

    if (!issue) {
      return;
    }

    const { repoRef } = await this._repoContext.resolveWithRef();

    try {
      await this._issueTagger.mutateTag(issue.id, repoRef, 'add', 'pr');
    } catch {
      // best-effort — `IssueTagger#mutateTag` already handles/warns every
      // failure internally and never rejects, but this extra guard keeps
      // `_syncPrLabelsAndState` robust to a future change in that
      // contract.
    }

    let labelNames;

    try {
      labelNames = await this._issueTagger.fetchLabels(issue.id);
    } catch {
      process.stderr.write(`Warning: could not fetch issue #${issue.id} from ${repoRef} to refresh tags\n`);

      return;
    }

    const tags = Tags.extractTags(labelNames);

    try {
      await this._issueStateService.setJson(issue.id, 'tags', JSON.stringify(tags));
    } catch {
      process.stderr.write(`Warning: could not persist refreshed tags for issue #${issue.id}\n`);
    }

    if (tags.includes('shipit')) {
      try {
        const pull = await this._githubClient.getPr(issue.branch);

        await this._issueTagger.addLabel(pull.number, 'auto-shipit');
      } catch {
        process.stderr.write(
          `Warning: could not add 'auto-shipit' label to PR for issue #${issue.id} on ${repoRef}\n`
        );
      }
    }
  }
}

export default AutoFixIssueGithub;
