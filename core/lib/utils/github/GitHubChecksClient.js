/**
 * GitHub check-run queries, extracted from `GitHubClient`. Bound to a
 * single repo through the shared `GitHubTransport`; a "failed request"
 * below means a rejected fetch (network error, timeout), a non-ok
 * response, or unparseable JSON — all mapped to the method's own domain
 * error.
 */
class GitHubChecksClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('./GitHubTransport.js').default} deps.transport - the
   *   shared GitHub transport, bound to the target repo's context.
   */
  constructor({ transport }) {
    this._transport = transport;
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
}

export default GitHubChecksClient;
