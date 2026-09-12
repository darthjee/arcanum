import SafeFetcher from '../utils/safe/SafeFetcher.js';
import GitHubClient from '../utils/github/GitHubClient.js';

const SHIPIT_RE = /^\s*:shipit:\s*$/;

/**
 * One poll attempt's decision tree and comment normalization for
 * `monitor_pr.sh` — extracted per
 * docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/node/03-build-pr-monitor-service.md,
 * mirroring `PrChecker.js`'s DI convention (a `GitHubClient` collaborator
 * plus a `SafeFetcher` for the same transient-error-swallows-to-`null`/`[]`
 * behavior the shell script gets from its `|| { echo pending; exit 0; }`
 * guards throughout). Deliberately ignorant of `.claude/state/*` — it
 * takes a `sinceIso` cursor in and returns comments/decisions out;
 * `AutoMonitorPrMonitorPr` owns all state-file persistence.
 */
class PrMonitor {
  /**
   * @param {object} deps - the monitor's collaborators.
   * @param {GitHubClient} deps.githubClient - the per-call, context-bound
   *   GitHub REST/GraphQL client (required — always built per-call by
   *   `AutoMonitorPrMonitorPr`, the same reason `PrOperations` itself
   *   takes a required `context`).
   * @param {SafeFetcher} [deps.safeFetcher] - swallow-and-retry wrapper
   *   around each REST call.
   */
  constructor({ githubClient, safeFetcher = new SafeFetcher() } = {}) {
    this._github = githubClient;
    this._safeFetcher = safeFetcher;
  }

  /**
   * One poll attempt's terminal-state check — mirrors
   * `monitor_pr.sh` lines 166–192: `MERGED`/`CLOSED` from the pull
   * request's own state, or `approved` when the LATEST review from
   * `owner` (by `submitted_at`) is `APPROVED`. Any transient fetch
   * failure degrades to `null`, same as "no terminal state yet".
   * @param {number|string} prNumber - the pull request number.
   * @param {string} owner - the GitHub login whose latest review counts.
   * @returns {Promise<'merged'|'closed'|'approved'|null>} the resolved
   *   terminal state, or `null` to keep polling (including on a
   *   transient error).
   */
  async resolveState(prNumber, owner) {
    const pull = await this._safeFetcher.run(() => this._github.getPrState(prNumber));

    if (pull === null) {
      return null;
    }

    const label = GitHubClient.prStateLabel(pull);

    if (label === 'MERGED') {
      return 'merged';
    }

    if (label === 'CLOSED') {
      return 'closed';
    }

    const reviews = await this._safeFetcher.run(() => this._github.getPrReviews(prNumber));

    if (reviews === null) {
      return null;
    }

    const latest = this._latestOwnerReview(reviews, owner);

    if (latest && latest.state === 'APPROVED') {
      return 'approved';
    }

    return null;
  }

  /**
   * @param {Array} reviews - the pull request's reviews.
   * @param {string} owner - the GitHub login to filter to.
   * @returns {object|undefined} `owner`'s latest review (by
   *   `submitted_at`), or `undefined` when `owner` has none.
   */
  _latestOwnerReview(reviews, owner) {
    return reviews
      .filter((review) => review.user && review.user.login === owner)
      .sort((a, b) => this._compareTimestamps(a.submitted_at, b.submitted_at))
      .pop();
  }

  /**
   * @param {string} a - an ISO 8601 timestamp.
   * @param {string} b - another ISO 8601 timestamp.
   * @returns {number} `-1`/`0`/`1`, per `Array#sort`'s comparator
   *   contract, from a plain lexicographic (same-format ISO 8601 strings
   *   sort chronologically) comparison.
   */
  _compareTimestamps(a, b) {
    if (a < b) {
      return -1;
    }

    return a > b ? 1 : 0;
  }

  /**
   * Fetch and normalize every comment source, filtered to `owner`'s
   * comments newer than `sinceIso` — mirrors lines 200–219: issue-level
   * (conversation) comments, inline review comments, and non-empty
   * review bodies, normalized to `{login, createdAt, body, id, url}` (a
   * GraphQL node id in every case) and concatenated in that exact order
   * (issue comments, then inline, then reviews) before filtering, so the
   * result's order is deterministic. Any transient fetch failure
   * degrades to `null`.
   * @param {number|string} prNumber - the pull request number.
   * @param {string} owner - the GitHub login to filter to.
   * @param {string} sinceIso - the ISO 8601 cursor; only comments created
   *   strictly after this are returned.
   * @returns {Promise<Array|null>} the new owner comments, oldest source
   *   order preserved, or `null` on a transient error.
   */
  async newOwnerComments(prNumber, owner, sinceIso) {
    const issueComments = await this._safeFetcher.run(() => this._github.getIssueComments(prNumber));

    if (issueComments === null) {
      return null;
    }

    const inlineComments = await this._safeFetcher.run(() => this._github.getPrReviewComments(prNumber));

    if (inlineComments === null) {
      return null;
    }

    const reviews = await this._safeFetcher.run(() => this._github.getPrReviews(prNumber));

    if (reviews === null) {
      return null;
    }

    const normalized = [
      ...issueComments.map((comment) => this._normalizeComment(comment)),
      ...inlineComments.map((comment) => this._normalizeComment(comment)),
      ...reviews
        .filter((review) => review.body !== null && review.body !== undefined && review.body.replace(/\s/g, '') !== '')
        .map((review) => this._normalizeReview(review))
    ];

    return normalized.filter((comment) => comment.login === owner && comment.createdAt > sinceIso);
  }

  /**
   * @param {object} comment - a raw issue/inline REST comment object.
   * @returns {{login: string, createdAt: string, body: string, id: string, url: string}}
   *   the normalized shape.
   */
  _normalizeComment(comment) {
    return {
      login: comment.user && comment.user.login,
      createdAt: comment.created_at,
      body: comment.body,
      id: comment.node_id,
      url: comment.html_url
    };
  }

  /**
   * @param {object} review - a raw REST review object.
   * @returns {{login: string, createdAt: string, body: string, id: string, url: string}}
   *   the normalized shape.
   */
  _normalizeReview(review) {
    return {
      login: review.user && review.user.login,
      createdAt: review.submitted_at,
      body: review.body,
      id: review.node_id,
      url: review.html_url
    };
  }

  /**
   * The whitespace-tolerant `:shipit:`-only match from line 224–226's
   * `^[[:space:]]*:shipit:[[:space:]]*$`.
   * @param {string} body - the comment body to test.
   * @returns {boolean} whether `body` is exactly `:shipit:`, ignoring
   *   surrounding whitespace.
   */
  isShipit(body) {
    return SHIPIT_RE.test(body);
  }

  /**
   * Add the `:eyes:` reaction marking a newly-fetched comment as
   * "processing" — mirrors `monitor_pr.sh`'s Phase 2 `add_reaction
   * "$node_id" EYES` call.
   * @param {string} nodeId - the comment's GraphQL node id.
   * @returns {Promise<void>} resolves regardless of outcome (best-effort,
   *   via `GitHubClient#addReaction`).
   */
  async addEyes(nodeId) {
    await this._github.addReaction(nodeId, 'EYES');
  }

  /**
   * Resolve a "processing" comment to "addressed": swap its `:eyes:`
   * reaction for `:+1:` — mirrors lines 150–154's exact two-call
   * sequence (remove `EYES`, then add `THUMBS_UP` — GitHub's reaction
   * set has no check-mark).
   * @param {string} nodeId - the comment's GraphQL node id.
   * @returns {Promise<void>} resolves regardless of outcome (best-effort,
   *   via `GitHubClient#removeReaction`/`#addReaction`).
   */
  async resolveAddressed(nodeId) {
    await this._github.removeReaction(nodeId, 'EYES');
    await this._github.addReaction(nodeId, 'THUMBS_UP');
  }
}

export default PrMonitor;
