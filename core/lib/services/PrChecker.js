import SafeFetcher from '../utils/safe/SafeFetcher.js';

const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out']);

/**
 * One poll attempt's decision tree — extracted from
 * `AutoFixAllWaitCi#_pollOnce`/`#_isIgnored` — given a `PrOperations`
 * (and/or its `GitHubClient`) collaborator, resolves the target pull
 * request's current head commit and its check-runs, filters out ignored
 * check-runs, then decides `passed`/`failed`/still-pending (`null`).
 * Mirrors `PrOperations`/`IssueStateService`'s constructor-injection DI
 * convention.
 */
class PrChecker {
  /**
   * @param {object} deps - the checker's collaborators.
   * @param {import('../utils/github/PrOperations.js').default} deps.prOperations -
   *   the per-call, context-bound `PrOperations` facade (required — no
   *   default, always built per-call by
   *   `AutoFixAllWaitCi#_prChecker(repoPath)`, the same reason
   *   `PrOperations` itself takes a required `context`).
   * @param {SafeFetcher} [deps.safeFetcher] - swallow-and-retry wrapper
   *   around each REST call.
   */
  constructor({ prOperations, safeFetcher = new SafeFetcher() } = {}) {
    this._prOperations = prOperations;
    this._safeFetcher = safeFetcher;
  }

  /**
   * One poll attempt: fetch the PR's current head commit, fetch that
   * commit's check-runs, filter out ignored ones, then apply the shell
   * script's exact passed/failed/pending decision tree. Transient
   * fetch/API errors (and a malformed ignored-pattern regex, mirroring
   * the shell's own `jq test()` failure) are swallowed here (via
   * `safeFetcher`), returning `null` so the caller retries — matching
   * `wait_ci_shell.sh`'s `|| { sleep 5; continue; }` guards throughout
   * its loop body.
   * @param {number|string} prNumber - the pull request number.
   * @param {Array} ignoredPatterns - case-insensitive regex strings;
   *   check-runs whose name matches any of them are excluded entirely.
   * @returns {Promise<string|null>} the final `passed`/`failed` output
   *   once decided, or `null` to keep polling.
   */
  async pollOnce(prNumber, ignoredPatterns) {
    const sha = await this._safeFetcher.run(() => this._prOperations.headSha(prNumber));

    if (sha === null) {
      return null;
    }

    const checkRuns = await this._safeFetcher.run(() => this._prOperations.checkRuns(sha));

    if (checkRuns === null) {
      return null;
    }

    let filtered;

    try {
      filtered = checkRuns.filter((run) => !this._isIgnored(run.name, ignoredPatterns));
    } catch {
      return null;
    }

    const total = filtered.length;

    if (total === 0) {
      return null;
    }

    const failedRuns = filtered.filter(
      (run) => run.status === 'completed' && FAILURE_CONCLUSIONS.has(run.conclusion)
    );

    if (failedRuns.length > 0) {
      return `failed\n${failedRuns.map((run) => run.name).join('\n')}\n`;
    }

    const passedCount = filtered.filter(
      (run) => run.status === 'completed' && run.conclusion === 'success'
    ).length;

    if (passedCount === total) {
      return 'passed\n';
    }

    return null;
  }

  /**
   * @param {string} name - a check-run's name.
   * @param {Array} patterns - case-insensitive regex strings.
   * @returns {boolean} whether `name` matches any pattern in `patterns`.
   */
  _isIgnored(name, patterns) {
    return patterns.some((pattern) => new RegExp(pattern, 'i').test(name));
  }
}

export default PrChecker;
