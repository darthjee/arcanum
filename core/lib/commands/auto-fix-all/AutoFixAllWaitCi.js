import PrChecker from '../../services/PrChecker.js';
import PrOperations from '../../utils/github/PrOperations.js';
import RepoConfig from '../../utils/config/RepoConfig.js';
import RepoContextFactory from '../../context/RepoContextFactory.js';

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
   * @param {import('../context/RepoContext.js').default} repoContext -
   *   the target repo's context (provides `repoPath` plus the low-level
   *   `origin`/`githubToken`/`issueStateService`/`configChain` wiring
   *   the per-call bundle is built off).
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {RepoContextFactory} [deps.repoContextFactory] - wraps the
   *   injected `RepoContext` into a per-call bundle (context plus
   *   context-bound clients) via `buildFromContext` — see
   *   `#_prOperations`. Only its `execFileAsync`/`fetchFn`/`timeoutMs`
   *   knobs are consulted on this path.
   * @param {RepoConfig} [deps.repoConfig] - per-repo config reader.
   * @param {number} [deps.pollIntervalMs] - the wait between poll
   *   attempts, overridable for tests (defaults to the shell script's
   *   real 5s `sleep 5`).
   * @param {Function} [deps.sleepFn] - the poll-loop sleep
   *   implementation, overridable for tests (defaults to a real
   *   `setTimeout`-based sleep).
   */
  constructor(repoContext, {
    repoContextFactory = new RepoContextFactory({ timeoutMs: DEFAULT_TIMEOUT_MS }),
    repoConfig = new RepoConfig(),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    sleepFn = defaultSleep
  } = {}) {
    this._repoContext = repoContext;
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
   * @returns {Promise<string>} `passed\n` on an all-green PR, or
   *   `failed\n<name>\n...` (one failed/cancelled/timed-out check-run
   *   name per line) otherwise.
   * @throws {Error} `Error: no pull request found for the current
   *   branch on <repo>` when the current branch has no open pull
   *   request.
   */
  async run() {
    const repoPath = this._repoContext.repoPath;

    if (!repoPath) {
      throw new Error(USAGE);
    }

    const ignoredPatterns = await this._repoConfig.getIgnoredCheckPatterns(repoPath);
    const prNumber = Number((await this._prOperations().prNumber()).trim());
    const prChecker = this._prChecker();

    for (;;) {
      const outcome = await prChecker.pollOnce(prNumber, ignoredPatterns);

      if (outcome !== null) {
        return outcome;
      }

      await this._sleep(this._pollIntervalMs);
    }
  }

  /**
   * Build a per-call `PrOperations` by wrapping the injected
   * `RepoContext` into a `RepoContextFactory` bundle (its `context` plus
   * a context-bound `gitClient`/`gitBranch`/`git`/`githubClient` — the
   * extra `issueClient` key is ignored by `PrOperations`). The bundle is
   * cheap, zero-I/O construction, so building it per call has no
   * meaningful cost.
   * @returns {PrOperations} the per-call `PrOperations` facade.
   */
  _prOperations() {
    return new PrOperations(this._repoContextFactory.buildFromContext(this._repoContext));
  }

  /**
   * Build a per-call `PrChecker`, wrapping a fresh `_prOperations()` —
   * mirrors `_prOperations`'s own per-call construction, since a
   * context-bound `PrChecker` can't be a constructor-level shared
   * singleton.
   * @returns {PrChecker} the per-call `PrChecker` delegate.
   */
  _prChecker() {
    return new PrChecker({ prOperations: this._prOperations() });
  }
}

export default AutoFixAllWaitCi;
