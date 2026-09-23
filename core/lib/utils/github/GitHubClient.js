import Git from '../git/Git.js';
import GitHubChecksClient from './GitHubChecksClient.js';
import GitHubPullRequestClient from './GitHubPullRequestClient.js';
import GitHubPullRequestFeedbackClient from './GitHubPullRequestFeedbackClient.js';
import GitHubTransport from './GitHubTransport.js';
import GitHubUserClient from './GitHubUserClient.js';

/**
 * Compatibility facade over the focused GitHub clients, all sharing one
 * `GitHubTransport` bound to a single `RepoContext` — so a `GitHubClient`
 * instance is scoped to one repo (mirroring `GitClient`/
 * `MergeBodyResolver`). Each public method delegates to the client that
 * owns its concern:
 * - `GitHubPullRequestClient` — PR lookup/state and lifecycle
 *   (`getPr`, `getPrState`, `prStateLabel`, `getPrHeadSha`,
 *   `getPrCommits`, `createPr`, `mergePr`, `markPrReady`,
 *   `deleteBranch`).
 * - `GitHubPullRequestFeedbackClient` — reviews, comments and reactions
 *   (`getPrReviews`, `getIssueComments`, `getPrReviewComments`,
 *   `addReaction`, `removeReaction`).
 * - `GitHubChecksClient` — check runs (`getCheckRuns`).
 * - `GitHubUserClient` — the acting user (`getCurrentUser`).
 *
 * See each focused client for the full method contracts.
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
    const transport = new GitHubTransport({ context, fetchFn, timeoutMs });

    this._pullRequests = new GitHubPullRequestClient({ transport, git });
    this._feedback = new GitHubPullRequestFeedbackClient({ transport });
    this._checks = new GitHubChecksClient({ transport });
    this._users = new GitHubUserClient({ transport });
  }

  /**
   * @see GitHubPullRequestClient#getPr
   * @param {string} branch - the branch name.
   * @returns {Promise<object>} the resolved pull request object.
   */
  getPr(branch) {
    return this._pullRequests.getPr(branch);
  }

  /**
   * @see GitHubPullRequestClient#getPrCommits
   * @param {number|string} number - the pull request number.
   * @returns {Promise<Array>} the pull request's commits.
   */
  getPrCommits(number) {
    return this._pullRequests.getPrCommits(number);
  }

  /**
   * @see GitHubPullRequestClient#mergePr
   * @param {number|string} number - the pull request number.
   * @param {object} payload - the REST merge payload.
   * @returns {Promise<void>} resolves once the merge succeeds.
   */
  mergePr(number, payload) {
    return this._pullRequests.mergePr(number, payload);
  }

  /**
   * @see GitHubPullRequestClient#deleteBranch
   * @param {string} branch - the branch name to delete.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  deleteBranch(branch) {
    return this._pullRequests.deleteBranch(branch);
  }

  /**
   * @see GitHubPullRequestClient#getPrHeadSha
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<string>} the pull request's current head sha.
   */
  getPrHeadSha(prNumber) {
    return this._pullRequests.getPrHeadSha(prNumber);
  }

  /**
   * @see GitHubChecksClient#getCheckRuns
   * @param {string} sha - the commit sha to look up check-runs for.
   * @returns {Promise<Array>} the commit's `check_runs` array.
   */
  getCheckRuns(sha) {
    return this._checks.getCheckRuns(sha);
  }

  /**
   * @see GitHubUserClient#getCurrentUser
   * @returns {Promise<object>} the parsed `/user` response body.
   */
  getCurrentUser() {
    return this._users.getCurrentUser();
  }

  /**
   * @see GitHubPullRequestClient#createPr
   * @param {string} title - the pull request title.
   * @param {string} body - the pull request body.
   * @returns {Promise<string>} the created pull request's `html_url`.
   */
  createPr(title, body) {
    return this._pullRequests.createPr(title, body);
  }

  /**
   * @see GitHubPullRequestClient#getPrState
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<object>} the raw pull request object.
   */
  getPrState(prNumber) {
    return this._pullRequests.getPrState(prNumber);
  }

  /**
   * @see GitHubPullRequestClient.prStateLabel
   * @param {object} pull - the pull request object.
   * @returns {'OPEN'|'MERGED'|'CLOSED'} the derived state label.
   */
  static prStateLabel(pull) {
    return GitHubPullRequestClient.prStateLabel(pull);
  }

  /**
   * @see GitHubPullRequestFeedbackClient#getPrReviews
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the pull request's reviews.
   */
  getPrReviews(prNumber) {
    return this._feedback.getPrReviews(prNumber);
  }

  /**
   * @see GitHubPullRequestFeedbackClient#getIssueComments
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the pull request's conversation comments.
   */
  getIssueComments(prNumber) {
    return this._feedback.getIssueComments(prNumber);
  }

  /**
   * @see GitHubPullRequestFeedbackClient#getPrReviewComments
   * @param {number|string} prNumber - the pull request number.
   * @returns {Promise<Array>} the pull request's inline review comments.
   */
  getPrReviewComments(prNumber) {
    return this._feedback.getPrReviewComments(prNumber);
  }

  /**
   * @see GitHubPullRequestFeedbackClient#addReaction
   * @param {string} nodeId - the target's GraphQL node id.
   * @param {'EYES'|'THUMBS_UP'} content - the reaction to add.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  addReaction(nodeId, content) {
    return this._feedback.addReaction(nodeId, content);
  }

  /**
   * @see GitHubPullRequestFeedbackClient#removeReaction
   * @param {string} nodeId - the target's GraphQL node id.
   * @param {'EYES'|'THUMBS_UP'} content - the reaction to remove.
   * @returns {Promise<void>} resolves regardless of outcome.
   */
  removeReaction(nodeId, content) {
    return this._feedback.removeReaction(nodeId, content);
  }

  /**
   * @see GitHubPullRequestClient#markPrReady
   * @param {string} nodeId - the pull request's GraphQL node id.
   * @returns {Promise<void>} resolves once the mutation succeeds.
   */
  markPrReady(nodeId) {
    return this._pullRequests.markPrReady(nodeId);
  }
}

export default GitHubClient;
