import Git from '../git/Git.js';
import GitHubTransport from './GitHubTransport.js';

/**
 * All GitHub REST API communication shared by PR lifecycle flows —
 * extracted from `PrOperations`'s `_findPr`/`_fetchPrCommits`/
 * `_resolveMergerLogin`/`_mergePr`/`_deleteBranchRef` private methods.
 * Bound to a single `RepoContext` at construction — `repo`/`repoRef`/
 * `token` are all resolved internally via the transport rather than
 * taken as method parameters, so a `GitHubClient` instance is scoped to
 * one repo (mirroring `GitClient`/`MergeBodyResolver`). Request
 * mechanics live in `GitHubTransport`; a "failed request" below means a
 * rejected fetch (network error, timeout), a non-ok response, or
 * unparseable JSON — all mapped to the method's own domain error.
 */
class GitHubClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for `repo`/`repoRef`/`token`
   *   resolution.
   * @param {typeof fetch} [deps.fetchFn] - `fetch`-compatible
   *   implementation (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each request's abort timeout,
   *   overridable for tests (defaults to the transport's real 30s
   *   protocol value).
   * @param {Git} [deps.git] - git facade, used by `createPr` to resolve
   *   the current branch as the new pull request's `head`.
   */
  constructor({ context, fetchFn, timeoutMs, git = new Git({ context }) } = {}) {
    this._git = git;
    this._transport = new GitHubTransport({ context, fetchFn, timeoutMs });
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
   * @param {number|string} number - the pull request number.
   * @returns {Promise<Array>} the pull request's commits (first page
   *   only, `per_page=100`), or `[]` on a malformed response.
   * @throws {Error} `could not fetch commits for pull request #<number>
   *   in <repo>` on a failed request.
   */
  async getPrCommits(number) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not fetch commits for pull request #${number} in ${repo}`);

    return this._transport.requestArray(`/repos/${repo}/pulls/${number}/commits?per_page=100`, { failure });
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
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not merge PR #${number} on ${repo}`);

    await this._transport.request(`/repos/${repo}/pulls/${number}/merge`, { method: 'PUT', body: payload, failure });
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
    await this._transport.bestEffort(async () => {
      const { repo } = await this._transport.repo();
      const failure = () => new Error(`could not delete branch ${branch} on ${repo}`);

      await this._transport.request(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'DELETE',
        failure
      });
    });
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
   * Resolve commit `sha`'s check-runs, replacing `AutoFixAllWaitCi`'s own
   * `_fetchCheckRuns`.
   * @param {string} sha - the commit sha to look up check-runs for.
   * @returns {Promise<Array>} the commit's `check_runs` array (first page
   *   only, `per_page=100` — no pagination, matching the shell script's
   *   own single-page fetch).
   * @throws {Error} `Error: could not fetch check-runs for <sha> in
   *   <repo>` on a failed request.
   * @throws {Error} `Error: malformed check-runs response for <sha> in
   *   <repo>` when `check_runs` isn't an array.
   */
  async getCheckRuns(sha) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`Error: could not fetch check-runs for ${sha} in ${repo}`);
    const body = await this._transport.requestJson(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`, { failure });

    if (!body || !Array.isArray(body.check_runs)) {
      throw new Error(`Error: malformed check-runs response for ${sha} in ${repo}`);
    }

    return body.check_runs;
  }

  /**
   * Resolve the acting GitHub user, replacing `gh api user`.
   * @returns {Promise<object>} the parsed `/user` response body.
   * @throws {Error} `could not fetch current user` on a failed
   *   request.
   */
  async getCurrentUser() {
    return this._transport.requestJson('/user', { failure: () => new Error('could not fetch current user') });
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
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`Error: could not fetch pull request #${prNumber} from ${repo}`);

    return this._transport.requestJson(`/repos/${repo}/pulls/${prNumber}`, { failure });
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
   * Resolve pull request `prNumber`'s reviews, replacing the `reviews`
   * field of `monitor_pr.sh`'s `gh pr view --json ...,reviews` fetch.
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the pull request's reviews (first page
   *   only, `per_page=100`), each with `user.login`, `state`,
   *   `submitted_at`, `body`, `node_id` — or `[]` on a malformed
   *   response.
   * @throws {Error} `could not fetch reviews for pull request #<prNumber>
   *   in <repo>` on a failed request.
   */
  async getPrReviews(prNumber) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not fetch reviews for pull request #${prNumber} in ${repo}`);

    return this._transport.requestArray(`/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`, { failure });
  }

  /**
   * Resolve pull request `prNumber`'s conversation (issue-level)
   * comments, replacing the `comments` field of `monitor_pr.sh`'s `gh pr
   * view --json comments,...` fetch. Deliberately the `/issues/...`
   * endpoint, not `/pulls/...` — a PR's "conversation" comments live on
   * the issue endpoint under the REST API (matching what `gh pr view
   * --json comments` surfaces under the hood).
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the comments (first page only,
   *   `per_page=100`), each with `user.login`, `created_at`, `body`,
   *   `node_id`, `html_url` — or `[]` on a malformed response.
   * @throws {Error} `could not fetch comments for pull request
   *   #<prNumber> in <repo>` on a failed request.
   */
  async getIssueComments(prNumber) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not fetch comments for pull request #${prNumber} in ${repo}`);

    return this._transport.requestArray(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`, { failure });
  }

  /**
   * Resolve pull request `prNumber`'s inline review comments, replacing
   * `monitor_pr.sh`'s separate `gh api repos/.../pulls/.../comments`
   * fetch. Distinct from `getPrCommits` (a pull request's commits, not
   * its review comments) and from `getIssueComments` (conversation
   * comments, not inline diff comments).
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the inline review comments (first page
   *   only, `per_page=100`), each with `user.login`, `created_at`,
   *   `body`, `node_id`, `html_url` — or `[]` on a malformed response.
   * @throws {Error} `could not fetch review comments for pull request
   *   #<prNumber> in <repo>` on a failed request.
   */
  async getPrReviewComments(prNumber) {
    const { repo } = await this._transport.repo();
    const failure = () => new Error(`could not fetch review comments for pull request #${prNumber} in ${repo}`);

    return this._transport.requestArray(`/repos/${repo}/pulls/${prNumber}/comments?per_page=100`, { failure });
  }

  /**
   * Best-effort `addReaction` GraphQL mutation, replacing
   * `monitor_pr.sh`'s `add_reaction` shell function — which redirects
   * all output and swallows any failure via `|| true`. Tolerance lives
   * here (never throws) rather than in `PrMonitor`, so callers never
   * need their own try/catch around it.
   * @param {string} nodeId - the target's GraphQL node id.
   * @param {'EYES'|'THUMBS_UP'} content - the `ReactionContent` enum
   *   value to add.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async addReaction(nodeId, content) {
    await this._mutateReaction('addReaction', 'reaction { id }', nodeId, content);
  }

  /**
   * Best-effort `removeReaction` GraphQL mutation, replacing
   * `monitor_pr.sh`'s `remove_reaction` shell function — same
   * error-tolerance as `addReaction`.
   * @param {string} nodeId - the target's GraphQL node id.
   * @param {'EYES'|'THUMBS_UP'} content - the `ReactionContent` enum
   *   value to remove.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async removeReaction(nodeId, content) {
    await this._mutateReaction('removeReaction', 'subject { id }', nodeId, content);
  }

  /**
   * Shared `addReaction`/`removeReaction` GraphQL mutation runner —
   * goes through the same `GitHubTransport#graphql` as `markPrReady`,
   * but never throws (both shell counterparts tolerate any failure,
   * matching `monitor_pr.sh`'s `|| true`).
   * @param {'addReaction'|'removeReaction'} mutationName - the GraphQL
   *   mutation to run.
   * @param {string} selection - the mutation's result selection set.
   * @param {string} nodeId - the target's GraphQL node id.
   * @param {'EYES'|'THUMBS_UP'} content - the `ReactionContent` enum
   *   value.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async _mutateReaction(mutationName, selection, nodeId, content) {
    const query = `mutation($id:ID!,$content:ReactionContent!){${mutationName}(input:{subjectId:$id,content:$content})` +
      `{${selection}}}`;
    const failure = () => new Error(`could not ${mutationName}`);

    await this._transport.bestEffort(() => this._transport.graphql(query, { id: nodeId, content }, { failure }));
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
}

export default GitHubClient;
