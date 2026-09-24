import GitHubTransport from './GitHubTransport.js';

/**
 * All GitHub REST API communication for issue-domain (not PR-domain)
 * calls shared by `IssueTagger`/`GithubIssue`/`AutoFixAllReplyComment` —
 * extracted from those three classes' own duplicated raw-`fetch`
 * patterns. Bound to a single `RepoContext` at construction — `repo`/
 * `token` are resolved internally via `GitHubTransport` rather than
 * taken as method parameters, mirroring `GitHubClient`. A "failed
 * request" below means a rejected fetch (network error, timeout), a
 * non-ok response, or unparseable JSON — all mapped to the method's own
 * domain error.
 */
class IssueClient {
  /**
   * @param {object} deps - the client's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context, for `repo`/`token` resolution.
   * @param {typeof fetch} [deps.fetchFn] - `fetch`-compatible
   *   implementation (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each request's abort timeout,
   *   overridable for tests (defaults to the transport's real 30s
   *   protocol value).
   */
  constructor({ context, fetchFn, timeoutMs } = {}) {
    this._transport = new GitHubTransport({ context, fetchFn, timeoutMs });
  }

  /**
   * @param {string} id - the issue id.
   * @returns {Promise<object>} the parsed issue body (used for its
   *   `labels` array by `IssueTagger`, or its `title`/`body`/`state`/
   *   `updated_at`/`labels` fields by `GithubIssue#fetch`).
   * @throws {Error} `Error: could not fetch issue #<id> from <repo>` on
   *   a failed request.
   */
  async getIssue(id) {
    return this._transport.repoRequestJson(
      ({ repo }) => `/repos/${repo}/issues/${id}`,
      { message: ({ repo }) => `Error: could not fetch issue #${id} from ${repo}` }
    );
  }

  /**
   * Open issues (never pull requests) of the bound repo updated after
   * `since`, optionally restricted to `author` — the native equivalent
   * of `gh issue list -R <repo> [--author <user>] --state open --json
   * number,title,updatedAt,labels --search "updated:>SINCE" --limit
   * 100`, which itself goes through the search API.
   * @param {string} since - the ISO timestamp (`updated:>SINCE`).
   * @param {object} [opts] - options.
   * @param {string} [opts.author] - restricts to this author's issues
   *   when non-empty.
   * @returns {Promise<Array<{number: number, title: string, updatedAt: string, labels: Array<{name: string}>}>>}
   *   up to 100 matching issues, in `gh issue list --json`'s shape.
   * @throws {Error} `Error: could not search issues in <repo>` on a
   *   failed request.
   */
  async searchOpenIssuesUpdatedSince(since, { author } = {}) {
    const body = await this._transport.repoRequestJson(
      ({ repo }) => {
        const terms = [`repo:${repo}`, 'is:issue', 'is:open'];

        if (author) {
          terms.push(`author:${author}`);
        }

        terms.push(`updated:>${since}`);

        return `/search/issues?q=${encodeURIComponent(terms.join(' '))}&per_page=100`;
      },
      { message: ({ repo }) => `Error: could not search issues in ${repo}` }
    );
    const items = body && Array.isArray(body.items) ? body.items : [];

    return items.map((item) => ({
      number: item.number,
      title: item.title,
      updatedAt: item.updated_at,
      labels: (item.labels || []).map((label) => ({ name: label.name }))
    }));
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to add.
   * @returns {Promise<void>} resolves once added.
   * @throws {Error} `could not add label '<label>' to issue #<id> on
   *   <repo>` on a rejected fetch or non-ok response.
   */
  async addLabel(id, label) {
    await this._transport.repoRequest(({ repo }) => `/repos/${repo}/issues/${id}/labels`, {
      method: 'POST',
      body: { labels: [label] },
      message: ({ repo }) => `could not add label '${label}' to issue #${id} on ${repo}`
    });
  }

  /**
   * @param {string} id - the issue id.
   * @param {string} label - the GitHub label name to remove.
   * @returns {Promise<void>} resolves once removed.
   * @throws {Error} `could not remove label '<label>' from issue #<id>
   *   on <repo>` on a rejected fetch or non-ok response.
   */
  async removeLabel(id, label) {
    await this._transport.repoRequest(
      ({ repo }) => `/repos/${repo}/issues/${id}/labels/${encodeURIComponent(label)}`,
      {
        method: 'DELETE',
        message: ({ repo }) => `could not remove label '${label}' from issue #${id} on ${repo}`
      }
    );
  }

  /**
   * @param {string} title - the new issue's title.
   * @param {string} body - the new issue's body.
   * @returns {Promise<object>} the created issue (its `number` is used
   *   by `GithubIssue#create`).
   * @throws {Error} `Error: could not create issue on <repo>` on a
   *   failed request.
   */
  async createIssue(title, body) {
    return this._transport.repoRequestJson(({ repo }) => `/repos/${repo}/issues`, {
      method: 'POST',
      body: { title, body },
      message: ({ repo }) => `Error: could not create issue on ${repo}`
    });
  }

  /**
   * Replaces issue `id`'s title and body (PATCH), mirroring
   * `github_issue_shell.sh`'s `cmd_update` — the response body is
   * discarded.
   * @param {string} id - the issue id.
   * @param {object} fields - the new issue fields.
   * @param {string} fields.title - the new issue title.
   * @param {string} fields.body - the new issue body.
   * @returns {Promise<void>} resolves once updated.
   * @throws {Error} `Error: could not update issue #<id> on <repo>` on a
   *   rejected fetch or non-ok response.
   */
  async updateIssue(id, { title, body }) {
    await this._transport.repoRequest(({ repo }) => `/repos/${repo}/issues/${id}`, {
      method: 'PATCH',
      body: { title, body },
      message: ({ repo }) => `Error: could not update issue #${id} on ${repo}`
    });
  }

  /**
   * Posts `body` as a comment on issue/pull-request `number` — PR
   * comments live under the `issues` REST endpoint too, so this is
   * reused for both.
   * @param {string|number} number - the target issue/pull-request number.
   * @param {string} body - the comment body.
   * @returns {Promise<void>} resolves once the comment is posted.
   * @throws {Error} `Error: could not post comment on pull request
   *   #<number> in <repo>` on a rejected fetch or non-ok response.
   */
  async postComment(number, body) {
    await this._transport.repoRequest(({ repo }) => `/repos/${repo}/issues/${number}/comments`, {
      method: 'POST',
      body: { body },
      message: ({ repo }) => `Error: could not post comment on pull request #${number} in ${repo}`
    });
  }
}

export default IssueClient;
