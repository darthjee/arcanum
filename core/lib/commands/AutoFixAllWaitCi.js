import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Git from '../utils/git/Git.js';
import GitBranch from '../utils/git/GitBranch.js';
import GitClient from '../utils/git/GitClient.js';
import GithubToken from '../utils/github/GithubToken.js';
import GitHubClient from '../utils/github/GitHubClient.js';
import Origin from '../utils/git/Origin.js';
import PrChecker from '../services/PrChecker.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoConfig from '../utils/config/RepoConfig.js';
import RepoContext from '../context/RepoContext.js';

const defaultExecFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const USAGE = 'Usage: wait_ci.sh <repo_path>';

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
 * names) to stdout. A thin entrypoint orchestrator — PR-number
 * resolution and the poll-once decision tree are delegated to a
 * per-call, context-bound `PrOperations`/`PrChecker` pair (mirroring
 * `AutoFixAllGithub#_prOperations`), since `repoPath` isn't known until
 * `run(repoPath)` is called. See
 * docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md
 * and docs/agents/plans/300-refactor-autofixallwaitci/node.md.
 */
class AutoFixAllWaitCi {
  /**
   * Keeps `origin`/`githubToken`/`repoConfig`/`execFileAsync`/`fetchFn`/
   * `timeoutMs` around as *shared* low-level collaborators, forwarded
   * into each call's fresh, context-bound `_prOperations(repoPath)`/
   * `_prChecker(repoPath)` build — not pre-built singletons, since a
   * `GitClient`/`GitHubClient` built without a `context` can't resolve
   * `repoPath`/`token`/`repo`/`repoRef` at all (see
   * `AutoFixAllGithub#_prOperations`'s own docstring).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {RepoConfig} [deps.repoConfig] - per-repo config reader.
   * @param {Function} [deps.execFileAsync] - promisified `execFile`,
   *   forwarded to each per-call `gitClient`.
   * @param {Function} [deps.fetchFn] - `fetch`-compatible implementation
   *   (global `fetch` by default), forwarded to each per-call
   *   `githubClient`.
   * @param {number} [deps.timeoutMs] - each REST call's abort timeout,
   *   overridable for tests (defaults to the real 30s protocol value),
   *   forwarded to each per-call `githubClient`.
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

    const ignoredPatterns = await this._repoConfig.getIgnoredCheckPatterns(repoPath);
    const prNumber = Number((await this._prOperations(repoPath).prNumber()).trim());
    const prChecker = this._prChecker(repoPath);

    for (;;) {
      const outcome = await prChecker.pollOnce(prNumber, ignoredPatterns);

      if (outcome !== null) {
        return outcome;
      }

      await this._sleep(this._pollIntervalMs);
    }
  }

  /**
   * Build a per-call `PrOperations`, wrapping `repoPath` (plus the
   * shared `origin`/`githubToken`) into a fresh `RepoContext`, and
   * building a fresh, context-bound `gitClient`/`githubClient` pair
   * right alongside it — mirrors `AutoFixAllGithub#_prOperations`
   * exactly.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken
    });
    const gitClient = new GitClient({ context, execFileAsync: this._execFileAsync });
    const gitBranch = new GitBranch({ context, gitClient });
    const git = new Git({ context, gitBranch });
    const githubClient = new GitHubClient({ context, fetchFn: this._fetch, timeoutMs: this._timeoutMs });

    return new PrOperations({ context, gitClient, gitBranch, git, githubClient });
  }

  /**
   * Build a per-call `PrChecker`, wrapping a fresh
   * `_prOperations(repoPath)` — mirrors `_prOperations`'s own per-call
   * construction, since a context-bound `PrChecker` can't be a
   * constructor-level shared singleton once `repoPath` varies call to
   * call.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrChecker} the per-call `PrChecker` delegate.
   */
  _prChecker(repoPath) {
    return new PrChecker({ prOperations: this._prOperations(repoPath) });
  }
}

export default AutoFixAllWaitCi;
