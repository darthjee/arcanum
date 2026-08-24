import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import GithubToken from './utils/github/GithubToken.js';
import Origin from './utils/git/Origin.js';
import RepoConfig from './utils/config/RepoConfig.js';

const defaultExecFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const USAGE = 'Usage: wait_ci.sh <repo_path>';
const FAILURE_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out']);

/**
 * Sleep for `ms` milliseconds, overridable for tests, mirroring the
 * injectable-sleep precedent already established by `Lock.js`'s
 * `sleepMs` option and `SpawnIssue.js`'s `sleepFn` dependency.
 * @param {number} ms - how long to sleep, in milliseconds.
 * @returns {Promise<void>} resolves once the wait has elapsed.
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Native equivalent of `auto-fix-all/scripts/wait_ci_shell.sh`: blocks
 * until every CI check-run on the current branch's PR head commit has
 * completed, printing `passed` or `failed` (plus the failed check-run
 * names) to stdout. See
 * docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md.
 */
class AutoFixAllWaitCi {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {RepoConfig} [deps.repoConfig] - per-repo config reader.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default).
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value).
   * @param {number} [deps.pollIntervalMs] - the wait between poll
   *   attempts, overridable for tests (defaults to the shell script's
   *   real 5s `sleep 5`).
   * @param {Function} [deps.sleepFn] - the poll-loop sleep
   *   implementation, overridable for tests (defaults to a real
   *   `setTimeout`-based sleep).
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    repoConfig = new RepoConfig(),
    execFileAsync = defaultExecFileAsync,
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._repoConfig = repoConfig;
    this._execFileAsync = execFileAsync;
    this._fetch = fetchFn;
    this._timeoutMs = timeoutMs;
    this._pollIntervalMs = pollIntervalMs;
    this._sleep = sleepFn;
  }

  /**
   * Native implementation of the `auto-fix-all-wait-ci` migrated
   * entrypoint — byte-identical stdout/exit-code counterpart to
   * `wait_ci_shell.sh`. Blocks (polling every `pollIntervalMs`) until
   * every check-run on the current branch's PR head commit has
   * completed.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} `passed\n` on an all-green PR, or
   *   `failed\n<name>\n...` (one failed/cancelled/timed-out check-run
   *   name per line) otherwise.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo>` when the current branch has no open pull
   *   request.
   */
  async run(repoPath) {
    if (!repoPath) {
      throw new Error(USAGE);
    }

    const { repo } = await this._origin.resolve(repoPath);
    const token = await this._githubToken.get(repoPath);
    const branch = await this._currentBranch(repoPath);
    const ignoredPatterns = await this._repoConfig.getIgnoredCheckPatterns(repoPath);
    const prNumber = await this._resolvePrNumber(repo, branch, token);

    for (;;) {
      const outcome = await this._pollOnce(repo, prNumber, token, ignoredPatterns);

      if (outcome !== null) {
        return outcome;
      }

      await this._sleep(this._pollIntervalMs);
    }
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {Promise<string>} the current branch's name.
   */
  async _currentBranch(repoPath) {
    const { stdout } = await this._execFileAsync('git', ['-C', repoPath, 'branch', '--show-current']);

    return stdout.trim();
  }

  /**
   * Resolve the current branch's open pull request number, replacing
   * the shell script's `gh pr view --json number -q '.number'`.
   * @param {string} repo - the `owner/repo` path.
   * @param {string} branch - the current branch's name.
   * @param {string} token - the GitHub token.
   * @returns {Promise<number>} the resolved pull request number.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo>` on any lookup failure.
   */
  async _resolvePrNumber(repo, branch, token) {
    const notFound = () => new Error(`Error: no pull request found for the current branch on ${repo}`);
    const owner = repo.split('/')[0];
    const url = `https://api.github.com/repos/${repo}/pulls?head=${encodeURIComponent(owner)}:${encodeURIComponent(branch)}`;

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

    const number = Array.isArray(pulls) && pulls.length > 0 ? pulls[0].number : undefined;

    if (!number) {
      throw notFound();
    }

    return number;
  }

  /**
   * One poll attempt: fetch the PR's current head commit, fetch that
   * commit's check-runs, filter out ignored ones, then apply the shell
   * script's exact passed/failed/pending decision tree. Transient
   * fetch/API errors (and a malformed ignored-pattern regex, mirroring
   * the shell's own `jq test()` failure) are swallowed here, returning
   * `null` so the caller retries — matching `wait_ci_shell.sh`'s `||
   * { sleep 5; continue; }` guards throughout its loop body.
   * @param {string} repo - the `owner/repo` path.
   * @param {number} prNumber - the pull request number.
   * @param {string} token - the GitHub token.
   * @param {Array} ignoredPatterns - case-insensitive regex strings;
   *   check-runs whose name matches any of them are excluded entirely.
   * @returns {Promise<string|null>} the final `passed`/`failed` output
   *   once decided, or `null` to keep polling.
   */
  async _pollOnce(repo, prNumber, token, ignoredPatterns) {
    const sha = await this._safeFetch(() => this._fetchHeadSha(repo, prNumber, token));

    if (sha === null) {
      return null;
    }

    const checkRuns = await this._safeFetch(() => this._fetchCheckRuns(repo, sha, token));

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
   * @param {string} repo - the `owner/repo` path.
   * @param {number} prNumber - the pull request number.
   * @param {string} token - the GitHub token.
   * @returns {Promise<string>} the PR's current head commit sha.
   */
  async _fetchHeadSha(repo, prNumber, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Error: could not fetch pull request #${prNumber} from ${repo}`);
    }

    const pull = await response.json();
    const sha = pull && pull.head && pull.head.sha;

    if (!sha) {
      throw new Error(`Error: could not resolve head commit for pull request #${prNumber} in ${repo}`);
    }

    return sha;
  }

  /**
   * @param {string} repo - the `owner/repo` path.
   * @param {string} sha - the commit sha to look up check-runs for.
   * @param {string} token - the GitHub token.
   * @returns {Promise<Array>} the commit's `check_runs` array (first
   *   page only, `per_page=100` — no pagination, matching the shell
   *   script's own single-page fetch).
   */
  async _fetchCheckRuns(repo, sha, token) {
    const response = await this._fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this._timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Error: could not fetch check-runs for ${sha} in ${repo}`);
    }

    const body = await response.json();

    if (!Array.isArray(body.check_runs)) {
      throw new Error(`Error: malformed check-runs response for ${sha} in ${repo}`);
    }

    return body.check_runs;
  }

  /**
   * @param {string} name - a check-run's name.
   * @param {Array} patterns - case-insensitive regex strings.
   * @returns {boolean} whether `name` matches any pattern in `patterns`.
   */
  _isIgnored(name, patterns) {
    return patterns.some((pattern) => new RegExp(pattern, 'i').test(name));
  }

  /**
   * Run `fn`, swallowing any thrown error into `null`, mirroring the
   * shell script's `|| { sleep 5; continue; }` transient-error guards.
   * @param {Function} fn - a zero-argument async function to invoke.
   * @returns {Promise<*>} `fn`'s resolved value, or `null` if it threw.
   */
  async _safeFetch(fn) {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

export default AutoFixAllWaitCi;
