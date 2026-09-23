/**
 * Pull request feedback — reviews, conversation comments, inline review
 * comments, and reaction mutations — extracted from `GitHubClient`.
 * Bound to a single repo through the shared `GitHubTransport`; a
 * "failed request" below means a rejected fetch (network error,
 * timeout), a non-ok response, or unparseable JSON — all mapped to the
 * method's own domain error.
 */
class GitHubPullRequestFeedbackClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('./GitHubTransport.js').default} deps.transport - the
   *   shared GitHub transport, bound to the target repo's context.
   */
  constructor({ transport }) {
    this._transport = transport;
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
    return this._transport.repoRequestArray(
      ({ repo }) => `/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
      { message: ({ repo }) => `could not fetch reviews for pull request #${prNumber} in ${repo}` }
    );
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
    return this._transport.repoRequestArray(
      ({ repo }) => `/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
      { message: ({ repo }) => `could not fetch comments for pull request #${prNumber} in ${repo}` }
    );
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
    return this._transport.repoRequestArray(
      ({ repo }) => `/repos/${repo}/pulls/${prNumber}/comments?per_page=100`,
      { message: ({ repo }) => `could not fetch review comments for pull request #${prNumber} in ${repo}` }
    );
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
}

export default GitHubPullRequestFeedbackClient;
