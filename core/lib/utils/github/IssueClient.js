const DEFAULT_TIMEOUT_MS = 30000;

/**
 * All GitHub REST API communication for issue-domain (not PR-domain)
 * calls shared by `IssueTagger`/`GithubIssue`/`AutoFixAllReplyComment` —
 * extracted from those three classes' own duplicated raw-`fetch`
 * patterns. Bound to a single `RepoContext` at construction — `repo`/
 * `token` are resolved internally via `this._context` rather than taken
 * as method parameters, mirroring `GitHubClient`.
 */
class IssueClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for `repo`/`token` resolution.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({ context, fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this._context = context;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<object>} the parsed issue body (used for its
   *   `labels` array by `IssueTagger`, or its `title`/`body`/`state`/
   *   `updated_at`/`labels` fields by `GithubIssue#fetch`).
   * @throws {Error} `Error: could not fetch issue #<id> from <repo>` on
   *   any non-ok response or fetch failure.
   */
  async getIssue(id) {
    const { repo } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const failure = () => new Error(`Error: could not fetch issue #${id} from ${repo}`);

    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }

    return response.json();
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to add.
   * @returns {Promise<void>} resolves once added.
   * @throws {Error} `could not add label '<label>' to issue #<id> on
   *   <repo>` on any non-ok response or fetch failure.
   */
  async addLabel(id, label) {
    const { repo } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const failure = () => new Error(`could not add label '${label}' to issue #${id} on ${repo}`);

    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${id}/labels`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels: [label] }),
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to remove.
   * @returns {Promise<void>} resolves once removed.
   * @throws {Error} `could not remove label '<label>' from issue #<id>
   *   on <repo>` on any non-ok response or fetch failure.
   */
  async removeLabel(id, label) {
    const { repo } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const failure = () => new Error(`could not remove label '${label}' from issue #${id} on ${repo}`);

    let response;

    try {
      response = await this._fetch(
        `https://api.github.com/repos/${repo}/issues/${id}/labels/${encodeURIComponent(label)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(this._timeoutMs)
        }
      );
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }
  }

  /**
   * @param {string} title - the new issue's title.
   * @param {string} body - the new issue's body.
   * @returns {Promise<object>} the created issue (its `number` is used
   *   by `GithubIssue#create`).
   * @throws {Error} `Error: could not create issue on <repo>` on any
   *   non-ok response or fetch failure.
   */
  async createIssue(title, body) {
    const { repo } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const failure = () => new Error(`Error: could not create issue on ${repo}`);

    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, body }),
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }

    return response.json();
  }

  /**
   * Posts `body` as a comment on issue/pull-request `number` — PR
   * comments live under the `issues` REST endpoint too, so this is
   * reused for both.
   * @param {string|number} number - the target issue/pull-request number.
   * @param {string} body - the comment body.
   * @returns {Promise<void>} resolves once the comment is posted.
   * @throws {Error} `Error: could not post comment on pull request
   *   #<number> in <repo>` on any non-ok response or fetch failure.
   */
  async postComment(number, body) {
    const { repo } = await this._context.resolveWithRef();
    const token = await this._context.getToken();
    const failure = () => new Error(`Error: could not post comment on pull request #${number} in ${repo}`);

    let response;

    try {
      response = await this._fetch(`https://api.github.com/repos/${repo}/issues/${number}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body }),
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw failure();
    }

    if (!response.ok) {
      throw failure();
    }
  }
}

export default IssueClient;
