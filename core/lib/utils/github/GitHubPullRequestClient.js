/**
 * Pull request lookup, state, and lifecycle (create, merge, mark ready,
 * branch cleanup), extracted from `GitHubClient` — itself extracted from
 * `PrOperations`'s `_findPr`/`_fetchPrCommits`/`_mergePr`/
 * `_deleteBranchRef` private methods. Bound to a single repo through the
 * shared `GitHubTransport` — `repo`/`repoRef`/`token` are all resolved
 * internally rather than taken as method parameters. A "failed request"
 * below means a rejected fetch (network error, timeout), a non-ok
 * response, or unparseable JSON — all mapped to the method's own domain
 * error.
 */
class GitHubPullRequestClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('./GitHubTransport.js').default} deps.transport - the
   *   shared GitHub transport, bound to the target repo's context.
   * @param {import('../git/Git.js').default} deps.git - git facade, used
   *   by `createPr` to resolve the current branch as the new pull
   *   request's `head`.
   */
  constructor({ transport, git }) {
    this._transport = transport;
    this._git = git;
  }

  /**
   * Resolve `branch`'s pull request, replacing the shell script's `gh pr
   * view -R "$repo_ref" "$branch"` lookup. Fetches across every state
   * (`state=all`) since callers need to report `MERGED`/`CLOSED` as well
   * as `OPEN`.
   * @param {string} branch - the branch name.
   * @returns {Promise<object>} the resolved pull request object.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repoRef>` on any lookup failure.
   */
  async getPr(branch) {
    const { repo, repoRef } = await this._transport.repo();
    const failure = () => new Error(`Error: no pull request found for the current branch on ${repoRef}`);
    const owner = repo.split('/')[0];
    const path = `/repos/${repo}/pulls?head=${encodeURIComponent(owner)}:${encodeURIComponent(branch)}&state=all`;
    const pulls = await this._transport.requestArray(path, { failure });
    const pull = pulls[0];

    if (!pull || !pull.number) {
      throw failure();
    }

    return pull;
  }

  /**
   * Resolve pull request `prNumber`'s raw pull object, replacing
   * `monitor_pr.sh`'s `gh pr view --json state` piece (via `pr_data`,
   * fetched once alongside `comments`/`reviews` there; here a dedicated
   * REST call, number-keyed like `getPrHeadSha`/`getCheckRuns`). Pair
   * with the static `GitHubClient.prStateLabel(pull)` to derive the
   * `MERGED`/`CLOSED`/`OPEN` label `PrOperations#prState` also needs —
   * kept as the one shared derivation so the two callers never fork it.
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<object>} the raw pull request object (`state`,
   *   `merged`, `merged_at`, etc.).
   * @throws {Error} `Error: could not fetch pull request #<prNumber> from
   *   <repo>` on a failed request.
   */
  async getPrState(prNumber) {
    return this._transport.repoRequestJson(
      ({ repo }) => `/repos/${repo}/pulls/${prNumber}`,
      { message: ({ repo }) => `Error: could not fetch pull request #${prNumber} from ${repo}` }
    );
  }

  /**
   * Derive the `gh pr view --json state`-equivalent label from a raw
   * pull object — extracted from `PrOperations`'s own former
   * `_prStateLabel` so `getPrState`'s caller (`PrMonitor`) and
   * `PrOperations#prState` share one derivation instead of forking it. A
   * merged PR always reports `MERGED`, even though the REST `state`
   * field itself is just `closed` for both a merged and a plain-closed
   * PR.
   * @param {object} pull - the pull request object.
   * @returns {'OPEN'|'MERGED'|'CLOSED'} the derived state label.
   */
  static prStateLabel(pull) {
    if (pull.merged || pull.merged_at) {
      return 'MERGED';
    }

    return pull.state === 'closed' ? 'CLOSED' : 'OPEN';
  }

  /**
   * Resolve pull request `prNumber`'s current head commit sha, replacing
   * `AutoFixAllWaitCi`'s own `_fetchHeadSha`.
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<string>} the pull request's current head commit
   *   sha.
   * @throws {Error} `Error: could not fetch pull request #<prNumber> from
   *   <repo>` on a failed request.
   * @throws {Error} `Error: could not resolve head commit for pull
   *   request #<prNumber> in <repo>` when the response has no
   *   `head.sha`.
   */
  async getPrHeadSha(prNumber) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`Error: could not fetch pull request #${prNumber} from ${repo}`);
    const pull = await this._transport.requestJson(`/repos/${repo}/pulls/${prNumber}`, { failure });
    const sha = pull && pull.head && pull.head.sha;

    if (!sha) {
      throw new Error(`Error: could not resolve head commit for pull request #${prNumber} in ${repo}`);
    }

    return sha;
  }

  /**
   * @param {number|string} number - the pull request number.
   * @returns {Promise<Array>} the pull request's commits (first page
   *   only, `per_page=100`), or `[]` on a malformed response.
   * @throws {Error} `could not fetch commits for pull request #<number>
   *   in <repo>` on a failed request.
   */
  async getPrCommits(number) {
    return this._transport.repoRequestArray(
      ({ repo }) => `/repos/${repo}/pulls/${number}/commits?per_page=100`,
      { message: ({ repo }) => `could not fetch commits for pull request #${number} in ${repo}` }
    );
  }

  /**
   * Create a pull request for the current branch, replacing `gh pr
   * create -R "$repo_ref" --title "$title" --body-file "$file"`. `gh pr
   * create` infers `head` (current branch) and `base` (repo default
   * branch) automatically; the REST endpoint requires both explicitly,
   * so `head` is resolved via `this._git.currentBranch()` and `base` via
   * a `GET /repos/{repo}` lookup of `.default_branch`.
   * @param {string} title - the pull request title.
   * @param {string} body - the pull request body.
   * @returns {Promise<string>} the created pull request's `html_url` —
   *   matching `gh pr create`'s own stdout (the created PR's web URL).
   * @throws {Error} `could not create pull request on <repo>` on any
   *   failed request (default-branch lookup or pull-request creation)
   *   or a created pull request with no `html_url` —
   *   a simple internal error for `AutoFixIssueGithub#prCreate` to catch
   *   and re-wrap into the shell's exact `Error: could not create PR on
   *   <repo_ref>` message.
   */
  async createPr(title, body) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not create pull request on ${repo}`);
    const head = await this._git.currentBranch();
    const base = await this._defaultBranch(repo, failure);
    const pull = await this._transport.requestJson(`/repos/${repo}/pulls`, {
      method: 'POST',
      body: { title, body, head, base },
      failure
    });

    if (!pull || !pull.html_url) {
      throw failure();
    }

    return pull.html_url;
  }

  /**
   * Resolve `repo`'s default branch, used by `createPr` to fill in the
   * new pull request's `base`.
   * @param {string} repo - the `<owner>/<name>` repo slug.
   * @param {() => Error} failure - builds the error to throw on any
   *   lookup failure, shared with `createPr`'s own caller-facing error.
   * @returns {Promise<string>} the repo's default branch name.
   * @throws {Error} whatever `failure()` builds, on a failed request
   *   or a response with no `default_branch`.
   */
  async _defaultBranch(repo, failure) {
    const repoInfo = await this._transport.requestJson(`/repos/${repo}`, { failure });

    if (!repoInfo || !repoInfo.default_branch) {
      throw failure();
    }

    return repoInfo.default_branch;
  }

  /**
   * Squash-merge pull request `number` via the REST merge endpoint,
   * replacing `gh pr merge --squash --subject ... [--body ...]`.
   * @param {number|string} number - the pull request number.
   * @param {object} payload - the REST merge payload (e.g.
   *   `{ merge_method: 'squash', commit_title, commit_message }`).
   * @returns {Promise<void>} resolves once the merge succeeds.
   * @throws {Error} `could not merge PR #<number> on <repo>` on a
   *   rejected fetch or non-ok response.
   */
  async mergePr(number, payload) {
    await this._transport.repoRequest(({ repo }) => `/repos/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      body: payload,
      message: ({ repo }) => `could not merge PR #${number} on ${repo}`
    });
  }

  /**
   * Mark pull request `nodeId` ready for review, replacing `gh pr ready
   * -R "$repo_ref" "$branch"`. GitHub's REST API has no field to toggle
   * a PR out of draft state, so this goes through the GraphQL
   * `markPullRequestReadyForReview` mutation instead, issued through
   * the same `GitHubTransport#graphql` as the reaction mutations.
   * @param {string} nodeId - the pull request's GraphQL node id
   *   (`pull.node_id` from the REST pull object) — not its number.
   * @returns {Promise<void>} resolves once the mutation succeeds.
   * @throws {Error} `could not mark pull request ready for review` on
   *   a failed request or GraphQL-reported error.
   */
  async markPrReady(nodeId) {
    const failure = () => new Error('could not mark pull request ready for review');
    const query = 'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) ' +
      '{ pullRequest { id } } }';

    await this._transport.graphql(query, { id: nodeId }, { failure });
  }

  /**
   * Best-effort delete of `branch`'s remote ref, replacing `gh pr merge
   * --delete-branch` (which has no REST merge-endpoint equivalent).
   * Tolerates any failure (network error or non-ok response, e.g. an
   * already-deleted/404 ref).
   * @param {string} branch - the branch name to delete.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async deleteBranch(branch) {
    await this._transport.bestEffort(() => this._transport.repoRequest(
      ({ repo }) => `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      { method: 'DELETE', message: ({ repo }) => `could not delete branch ${branch} on ${repo}` }
    ));
  }
}

export default GitHubPullRequestClient;
