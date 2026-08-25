import GitClient from '../git/GitClient.js';
import GitHubClient from './GitHubClient.js';
import MergeBodyResolver from './MergeBodyResolver.js';

/**
 * GitHub pull-request lifecycle operations shared by `github.sh`'s
 * `pr-number`, `pr-state`, and `pr-merge` subcommands — extracted from
 * `AutoFixAllGithub.js` (see `docs/agents/plans/284-refactor-core-lib-autofixallgithub-js/`),
 * which now delegates to this class as a thin facade. Per-call
 * orchestration only — git CLI interaction, GitHub REST communication,
 * and merge-body/co-authors resolution live in `GitClient`/
 * `GitHubClient`/`MergeBodyResolver` respectively (see
 * `docs/agents/plans/292-reduce-size-of-properations/`); this class
 * still owns PR-state derivation (`#_prStateLabel`), the one piece of
 * logic that stays here.
 */
class PrOperations {
  /**
   * @param {object} deps - the operation's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context (`repoPath` plus `origin`/`githubToken`/
   *   `issueState`/`configChain`).
   * @param {GitClient} [deps.gitClient] - git CLI client.
   * @param {GitHubClient} [deps.githubClient] - GitHub REST client.
   */
  constructor({ context, gitClient = new GitClient(), githubClient = new GitHubClient() } = {}) {
    this._context = context;
    this._git = gitClient;
    this._github = githubClient;
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
    const branch = await this._git.currentBranch(this._context.repoPath);
    const idMatch = branch.match(/^issue-(\d+)$/);

    if (idMatch) {
      const cached = await this._context.getIssueState(idMatch[1], 'pr_id');

      if (cached) {
        return `${cached}\n`;
      }
    }

    const { repo, repoRef } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const pull = await this._github.getPr(repo, branch, token, repoRef);

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
    const branch = await this._git.currentBranch(this._context.repoPath);
    const { repo, repoRef } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const pull = await this._github.getPr(repo, branch, token, repoRef);

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
   * @throws {Error} `Error: could not merge PR #<number> on <repo_ref>`
   *   when the merge call fails.
   */
  async prMerge(modelEmail) {
    const branch = await this._git.currentBranch(this._context.repoPath);
    const idMatch = branch.match(/^issue-(\d+)$/);

    let cachedNumber = '';
    let cachedUrl = '';

    if (idMatch) {
      cachedNumber = await this._context.getIssueState(idMatch[1], 'pr_id');
      cachedUrl = await this._context.getIssueState(idMatch[1], 'pr_url');
    }

    const { repo, repoRef } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const pull = await this._github.getPr(repo, branch, token, repoRef);

    const number = cachedNumber && cachedUrl ? cachedNumber : pull.number;
    const url = cachedNumber && cachedUrl ? cachedUrl : pull.html_url;
    const commitTitle = `${pull.title} (#${number})`;

    const body = await this._resolveMergeBody(repo, number, token, modelEmail);
    const payload = { merge_method: 'squash', commit_title: commitTitle };

    if (body.included) {
      payload.commit_message = body.body;
    }

    try {
      await this._github.mergePr(repo, number, token, payload);
    } catch {
      throw new Error(`Error: could not merge PR #${number} on ${repoRef}`);
    }

    await this._github.deleteBranch(repo, branch, token);

    return `${url}\n`;
  }

  /**
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {string} [modelEmail] - the acting model's commit-author
   *   email.
   * @returns {Promise<{included: boolean, body: string}>} `#prMerge`'s
   *   resolved `commit_message` payload — see
   *   `MergeBodyResolver#buildBody`.
   */
  async _resolveMergeBody(repo, number, token, modelEmail) {
    const resolver = new MergeBodyResolver({ context: this._context, githubClient: this._github });

    return resolver.buildBody(repo, number, token, modelEmail);
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
