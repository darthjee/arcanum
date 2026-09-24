const PER_PAGE = 100;

/**
 * GitHub repository-label operations (list, create, update), used by
 * `init-claude-sync-labels`. Bound to a single repo through the shared
 * `GitHubTransport`; a "failed request" below means a rejected fetch
 * (network error, timeout), a non-ok response, or unparseable JSON — all
 * mapped to the method's own domain error naming the repo ref.
 */
class GitHubLabelClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('./GitHubTransport.js').default} deps.transport - the
   *   shared GitHub transport, bound to the target repo's context.
   */
  constructor({ transport }) {
    this._transport = transport;
  }

  /**
   * List every label name in the repo, paginating
   * `GET /repos/<repo>/labels?per_page=100&page=N` until a short page.
   * @returns {Promise<string[]>} the label names, in API order.
   * @throws {Error} `Error: could not list labels on <repoRef>` on a
   *   failed request.
   */
  async listLabelNames() {
    const names = [];
    let page = 1;
    let batch;

    do {
      const currentPage = page;

      batch = await this._transport.repoRequestArray(
        ({ repo }) => `/repos/${repo}/labels?per_page=${PER_PAGE}&page=${currentPage}`,
        { message: ({ repoRef }) => `Error: could not list labels on ${repoRef}` }
      );
      names.push(...batch.map((label) => label?.name).filter((name) => typeof name === 'string'));
      page += 1;
    } while (batch.length >= PER_PAGE);

    return names;
  }

  /**
   * Create a label: `POST /repos/<repo>/labels {name, color}`.
   * @param {string} name - the label name.
   * @param {string} color - the 6-hex-digit color, no leading `#`.
   * @returns {Promise<void>} resolves once the label is created.
   * @throws {Error} `Error: could not create label '<name>' on <repoRef>`
   *   on a failed request.
   */
  async createLabel(name, color) {
    await this._transport.repoRequest(({ repo }) => `/repos/${repo}/labels`, {
      method: 'POST',
      body: { name, color },
      message: ({ repoRef }) => `Error: could not create label '${name}' on ${repoRef}`
    });
  }

  /**
   * Update (and possibly rename) a label:
   * `PATCH /repos/<repo>/labels/<existingName> {new_name, color}`.
   * @param {string} existingName - the label's current name on GitHub.
   * @param {string} name - the label's new name.
   * @param {string} color - the 6-hex-digit color, no leading `#`.
   * @returns {Promise<void>} resolves once the label is updated.
   * @throws {Error} `Error: could not update label '<existingName>' on
   *   <repoRef>` on a failed request.
   */
  async updateLabel(existingName, name, color) {
    await this._transport.repoRequest(
      ({ repo }) => `/repos/${repo}/labels/${encodeURIComponent(existingName)}`,
      {
        method: 'PATCH',
        body: { new_name: name, color },
        message: ({ repoRef }) => `Error: could not update label '${existingName}' on ${repoRef}`
      }
    );
  }
}

export default GitHubLabelClient;
