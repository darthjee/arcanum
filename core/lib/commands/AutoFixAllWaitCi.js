import PrChecker from '../services/PrChecker.js';
import PrOperations from '../utils/github/PrOperations.js';
import RepoContextFactory from '../context/RepoContextFactory.js';
import RepoConfig from '../utils/config/RepoConfig.js';

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
 * per-call `PrOperations`/`PrChecker` pair built off a
 * `RepoContextFactory` bundle (mirroring `AutoFixAllGithub`), since
 * `repoPath` isn't known until `run(repoPath)` is called. See
 * docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md
 * and docs/agents/plans/300-refactor-autofixallwaitci/node.md.
 */
class AutoFixAllWaitCi {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoContextFactory} [deps.repoContextFactory] - builds each
   *   per-call `RepoContext` bundle (context plus context-bound
   *   clients) — see `#_prOperations`. Owns the low-level `origin`/
   *   `githubToken`/`issueStateService`/`configChain`/`execFileAsync`/
   *   `fetchFn`/`timeoutMs` wiring.
   * @param {RepoConfig} [deps.repoConfig] - per-repo config reader.
   * @param {number} [deps.pollIntervalMs] - the wait between poll
   *   attempts, overridable for tests (defaults to the shell script's
   *   real 5s `sleep 5`).
   * @param {Function} [deps.sleepFn] - the poll-loop sleep
   *   implementation, overridable for tests (defaults to a real
   *   `setTimeout`-based sleep).
   */
  constructor({
    repoContextFactory = new RepoContextFactory({ timeoutMs: DEFAULT_TIMEOUT_MS }),
    repoConfig = new RepoConfig(),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._repoContextFactory = repoContextFactory;
    this._repoConfig = repoConfig;
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
   * Build a per-call `PrOperations` from a fresh `RepoContextFactory`
   * bundle (its `context` plus a context-bound `gitClient`/`gitBranch`/
   * `git`/`githubClient` — the extra `issueClient` key is ignored by
   * `PrOperations`). The whole bundle is cheap, zero-I/O construction,
   * so building it per call has no meaningful cost.
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations(repoPath) {
    return new PrOperations(this._repoContextFactory.build(repoPath));
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
