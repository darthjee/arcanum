const DEFAULT_TIMEOUT_MS = 30000;

/**
 * All GitHub REST API communication shared by PR lifecycle flows —
 * extracted from `PrOperations`'s `_findPr`/`_fetchPrCommits`/
 * `_resolveMergerLogin`/`_mergePr`/`_deleteBranchRef` private methods.
 * `token` comes in as a method parameter on each call (not the
 * constructor), so a single `GitHubClient` instance stays reusable
 * across every repo/caller.
 */
class GitHubClient {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   */
  constructor({ fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * Resolve `branch`'s pull request, replacing the shell script's `gh pr
   * view -R "$repo_ref" "$branch"` lookup. Fetches across every state
   * (`state=all`) since callers need to report `MERGED`/`CLOSED` as well
   * as `OPEN`.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} branch - the branch name.
   * @param {string} token - the GitHub token.
   * @param {string} repoRef - the (possibly domain-qualified) repo
   *   reference, used in the not-found error message.
   * @returns {Promise<object>} the resolved pull request object.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repoRef>` on any lookup failure.
   */
  async getPr(repo, branch, token, repoRef) {
    const notFound = () => new Error(`Error: no pull request found for the current branch on ${repoRef}`);
    const owner = repo.split('/')[0];
    const url = `https://api.github.com/repos/${repo}/pulls?head=${encodeURIComponent(owner)}:${encodeURIComponent(branch)}&state=all`;

    let response;

    try {
      response = await this._fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      throw notFound();
    }

    if (!response.ok) {
      throw notFound();
    }

    let pulls;

    try {
      pulls = await response.json();
    } catch {
      throw notFound();
    }

    const pull = Array.isArray(pulls) && pulls.length > 0 ? pulls[0] : undefined;

    if (!pull || !pull.number) {
      throw notFound();
    }

    return pull;
  }

  /**
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @returns {Promise<Array>} the pull request's commits (first page
   *   only, `per_page=100`), or `[]` on a malformed response.
   * @throws {Error} `could not fetch commits for pull request #<number>
   *   in <repo>` on any non-ok response.
   */
  async getPrCommits(repo, number, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/pulls/${number}/commits?per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not fetch commits for pull request #${number} in ${repo}`);
    }

    const commits = await response.json();

    return Array.isArray(commits) ? commits : [];
  }

  /**
   * Squash-merge pull request `number` via the REST merge endpoint,
   * replacing `gh pr merge --squash --subject ... [--body ...]`.
   * @param {string} repo - the `owner/repo` path.
   * @param {number|string} number - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {object} payload - the REST merge payload (e.g.
   *   `{ merge_method: 'squash', commit_title, commit_message }`).
   * @returns {Promise<void>} resolves once the merge succeeds.
   * @throws {Error} `could not merge PR #<number> on <repo>` on any
   *   non-ok response.
   */
  async mergePr(repo, number, token, payload) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`could not merge PR #${number} on ${repo}`);
    }
  }

  /**
   * Best-effort delete of `branch`'s remote ref, replacing `gh pr merge
   * --delete-branch` (which has no REST merge-endpoint equivalent).
   * Tolerates any failure (network error or non-ok response, e.g. an
   * already-deleted/404 ref).
   * @param {string} repo - the `owner/repo` path.
   * @param {string} branch - the branch name to delete.
   * @param {string} token - the GitHub token.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  async deleteBranch(repo, branch, token) {
    try {
      await this._fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this._timeoutMs)
      });
    } catch {
      // best-effort — tolerate any failure.
    }
  }

  /**
   * Resolve the acting GitHub user, replacing `gh api user`.
   * @param {string} token - the GitHub token.
   * @returns {Promise<object>} the parsed `/user` response body.
   * @throws {Error} `could not fetch current user` on any non-ok
   *   response.
   */
  async getCurrentUser(token) {
    const response = await this._fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error('could not fetch current user');
    }

    return response.json();
  }
}

export default GitHubClient;
