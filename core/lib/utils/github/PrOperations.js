import Git from '../git/Git.js';
import GitBranch from '../git/GitBranch.js';
import GitClient from '../git/GitClient.js';
import GitHubClient from './GitHubClient.js';
import MergeBodyResolver from './MergeBodyResolver.js';

/**
 * GitHub pull-request lifecycle operations shared by `github.sh`'s
 * `pr-number`, `pr-state`, and `pr-merge` subcommands — extracted from
 * `AutoFixAllGithub.js` (see `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`),
 * which now delegates to this class as a thin facade. A pure
 * orchestrator: every infrastructure concern (tokens, repo paths, repo
 * refs) is resolved by its context-bound collaborators (`GitClient`/
 * `GitHubClient`/`MergeBodyResolver`/`Git`/`GitBranch`, all bound to the
 * same `context` at construction — see
 * `docs/agents/plans/294-refactor-properations/`); this class only owns
 * `#_prStateLabel`, the one piece of pure derivation logic that stays
 * here.
 */
class PrOperations {
  /**
   * @param {object} deps - the operation's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context (`repoPath` plus `origin`/`githubToken`/
   *   `issueState`/`configChain`).
   * @param {GitClient} [deps.gitClient] - git CLI client, accepted for
   *   symmetry/testability with `GitBranch`'s own default — see
   *   `deps.git`.
   * @param {GitHubClient} [deps.githubClient] - GitHub REST client.
   * @param {GitBranch} [deps.gitBranch] - branch resolver, accepted for
   *   symmetry/testability even though this class only calls through
   *   `deps.git`, which wraps it.
   * @param {Git} [deps.git] - git facade, the collaborator this class
   *   actually calls through for `currentBranch`/`issueFromCurrentBranch`.
   * @param {MergeBodyResolver} [deps.mergeBodyResolver] - merge-body/
   *   co-authors resolver.
   */
  constructor({
    context,
    gitClient = new GitClient({ context }),
    githubClient = new GitHubClient({ context }),
    gitBranch = new GitBranch({ context }),
    git = new Git({ context }),
    mergeBodyResolver = new MergeBodyResolver({ context, githubClient })
  } = {}) {
    this._context = context;
    this._gitClient = gitClient;
    this._gitBranch = gitBranch;
    this._git = git;
    this._github = githubClient;
    this._mergeBodyResolver = mergeBodyResolver;
  }

  /**
   * Native implementation of `github.sh pr-number`: prints the current
   * branch's pull request number. When the current branch matches
   * `issue-<id>`, tries `RepoContext#getIssueState`'s cached `pr_id`
   * field first before falling back to a GitHub REST lookup.
   * @returns {Promise<string>} `<number>\n`.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   */
  async prNumber() {
    const issue = await this._git.issueFromCurrentBranch();

    if (issue) {
      const cached = await this._context.getIssueState(issue.id, 'pr_id');

      if (cached) {
        return `${cached}\n`;
      }
    }

    const branch = issue ? issue.branch : await this._git.currentBranch();
    const pull = await this._github.getPr(branch);

    return `${pull.number}\n`;
  }

  /**
   * Native implementation of `github.sh pr-state`: prints
   * `STATE=<OPEN|MERGED|CLOSED>` for the current branch's pull request.
   * @returns {Promise<string>} `STATE=<OPEN|MERGED|CLOSED>\n`.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   */
  async prState() {
    const branch = await this._git.currentBranch();
    const pull = await this._github.getPr(branch);

    return `STATE=${this._prStateLabel(pull)}\n`;
  }

  /**
   * Native implementation of `github.sh pr-merge`: squash-merges the
   * current branch's pull request, deletes its branch, and prints the
   * PR's URL. When the current branch matches `issue-<id>` and both
   * `pr_id`/`pr_url` are cached (`RepoContext#getIssueState`), the
   * cached number/url are trusted, but the title is still re-fetched via
   * REST (matching the shell's own `gh pr view ... --json title`
   * re-fetch in that branch).
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email, used by `coauthors` body mode to optionally exclude its
   *   own co-author entry.
   * @returns {Promise<string>} `<url>\n`, the merged PR's URL.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo_ref>` when no pull request is found.
   * @throws {Error} `could not merge PR #<number> on <repo>` when the
   *   merge call fails.
   */
  async prMerge(modelEmail) {
    const issue = await this._git.issueFromCurrentBranch();

    let cachedNumber = '';
    let cachedUrl = '';

    if (issue) {
      cachedNumber = await this._context.getIssueState(issue.id, 'pr_id');
      cachedUrl = await this._context.getIssueState(issue.id, 'pr_url');
    }

    const branch = issue ? issue.branch : await this._git.currentBranch();
    const pull = await this._github.getPr(branch);

    const number = cachedNumber && cachedUrl ? cachedNumber : pull.number;
    const url = cachedNumber && cachedUrl ? cachedUrl : pull.html_url;
    const commitTitle = `${pull.title} (#${number})`;

    const body = await this._mergeBodyResolver.buildBody(number, modelEmail);
    const payload = { merge_method: 'squash', commit_title: commitTitle };

    if (body.included) {
      payload.commit_message = body.body;
    }

    await this._github.mergePr(number, payload);
    await this._github.deleteBranch(branch);

    return `${url}\n`;
  }

  /**
   * Orchestrates `GitHubClient#getPrHeadSha` — thin delegation, same as
   * `prNumber()` delegates to `GitHubClient#getPr`.
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<string>} the pull request's current head commit
   *   sha.
   */
  async headSha(prNumber) {
    return this._github.getPrHeadSha(prNumber);
  }

  /**
   * Orchestrates `GitHubClient#getCheckRuns` — thin delegation.
   * @param {string} sha - the commit sha to look up check-runs for.
   * @returns {Promise<Array>} the commit's `check_runs` array.
   */
  async checkRuns(sha) {
    return this._github.getCheckRuns(sha);
  }

  /**
   * Mirrors `gh pr view --json state`'s derivation of `OPEN`/`MERGED`/
   * `CLOSED` from the REST API's `state`/`merged`/`merged_at` fields —
   * a merged PR always reports `MERGED`, even though the REST `state`
   * field itself is just `closed` for both a merged and a plain-closed
   * PR.
   * @param {object} pull - the pull request object.
   * @returns {'OPEN'|'MERGED'|'CLOSED'} the derived state label.
   */
  _prStateLabel(pull) {
    if (pull.merged || pull.merged_at) {
      return 'MERGED';
    }

    return pull.state === 'closed' ? 'CLOSED' : 'OPEN';
  }
}

export default PrOperations;
