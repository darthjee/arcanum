/**
 * GitHub user lookup, extracted from `GitHubClient`. Not repo-scoped —
 * it only needs the shared `GitHubTransport`'s token and request
 * mechanics.
 */
class GitHubUserClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('./GitHubTransport.js').default} deps.transport - the
   *   shared GitHub transport, bound to the target repo's context.
   */
  constructor({ transport }) {
    this._transport = transport;
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
}

export default GitHubUserClient;
