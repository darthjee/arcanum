import Git from '../../utils/git/Git.js';
import GitHubClient from '../../utils/github/GitHubClient.js';
import IssueStateService from '../../services/IssueStateService.js';

const USAGE = 'Usage: resolve_pr_number.sh <repo_path> <id>';

/**
 * Native equivalent of
 * `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh`: resolves
 * the PR number for the current branch (expected to already be checked
 * out as `issue-<id>`), preferring the issue's cached `pr_id` state
 * field over a GitHub API lookup. A pure orchestrator, mirroring
 * `AutoFixIssueGithub.js`'s composition pattern: every infrastructure
 * concern (git, GitHub REST calls, issue-state persistence) is resolved
 * by context-bound collaborators (`Git`/`GitHubClient`/
 * `IssueStateService`, all bound to the same `repoContext` at
 * construction). See
 * docs/agents/plans/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js/node.md.
 */
class AutoMonitorIssuePrResolvePrNumber {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus `origin`/
   *   `githubToken` resolution).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Git} [deps.git] - git facade, for the current branch.
   * @param {GitHubClient} [deps.githubClient] - GitHub REST client, for
   *   the PR lookup.
   * @param {IssueStateService} [deps.issueStateService] - issue
   *   state-file reader, used to short-circuit on a cached `pr_id`.
   */
  constructor(repoContext, {
    git = new Git({ context: repoContext }),
    githubClient = new GitHubClient({ context: repoContext }),
    issueStateService = new IssueStateService({ context: repoContext })
  } = {}) {
    this._repoContext = repoContext;
    this._git = git;
    this._githubClient = githubClient;
    this._issueStateService = issueStateService;
  }

  /**
   * Native implementation of `resolve_pr_number_shell.sh`: validates
   * `id` (numeric, `#` prefix tolerated/stripped), returns the issue's
   * cached `pr_id` state field when present, otherwise resolves the
   * current branch's pull request via the GitHub API and returns its
   * number.
   * @param {string} id - the numeric GitHub issue id (`#` prefix
   *   tolerated), used only for validation and the cache lookup — the
   *   actual PR lookup is driven by the current branch.
   * @returns {Promise<string>} `<number>\n`, the resolved PR number.
   * @throws {Error} `Usage: resolve_pr_number.sh <repo_path> <id>` when
   *   `id` is missing or non-numeric (after stripping a leading `#`).
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repoRef>` (propagated from `GitHubClient#getPr`) when
   *   no cached `pr_id` exists and no matching pull request is found.
   */
  async run(id) {
    const strippedId = (id ?? '').replace(/^#/, '');

    if (!/^[0-9]+$/.test(strippedId)) {
      throw new Error(USAGE);
    }

    const cached = await this._issueStateService.get(strippedId, 'pr_id');

    if (cached !== '') {
      return `${cached}\n`;
    }

    const branch = await this._git.currentBranch();
    const pull = await this._githubClient.getPr(branch);

    return `${pull.number}\n`;
  }
}

export default AutoMonitorIssuePrResolvePrNumber;
