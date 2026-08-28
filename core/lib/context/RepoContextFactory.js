import Git from '../utils/git/Git.js';
import GitBranch from '../utils/git/GitBranch.js';
import GitClient from '../utils/git/GitClient.js';
import GitHubClient from '../utils/github/GitHubClient.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueClient from '../utils/github/IssueClient.js';
import Origin from '../utils/git/Origin.js';
import RepoContext from './RepoContext.js';

/**
 * Single place that, given a `repoPath`, builds a `RepoContext` plus
 * every context-bound client built directly off it (`gitClient`/
 * `gitBranch`/`git`/`githubClient`/`issueClient`). One bundle is built
 * per call site — `repoPath` differs call to call, so none of
 * `RepoContext`/`GitClient`/`GitHubClient`/`IssueClient` can be shared
 * across calls once they become context-bound. Every value is a cheap,
 * zero-I/O construction (no I/O in their constructors), so building the
 * full bundle per call — even when a caller uses only part of it — has
 * no meaningful cost.
 */
class RepoContextFactory {
  /**
   * Holds one shared `origin`/`githubToken` pair plus the
   * `execFileAsync`/`fetchFn`/`timeoutMs` knobs, forwarding them into
   * each per-call bundle. `issueStateService`/`configChain` are
   * forwarded as-is (possibly `undefined`) into each `RepoContext`,
   * which supplies its own defaults when they are absent.
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {Origin} [deps.origin] - shared git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - shared GitHub token
   *   resolver.
   * @param {object} [deps.issueStateService] - forwarded to each
   *   per-call `RepoContext`.
   * @param {object} [deps.configChain] - forwarded to each per-call
   *   `RepoContext`.
   * @param {Function} [deps.execFileAsync] - forwarded to each per-call
   *   `GitClient`.
   * @param {Function} [deps.fetchFn] - forwarded to both the per-call
   *   `GitHubClient` and the per-call `IssueClient`.
   * @param {number} [deps.timeoutMs] - forwarded to both the per-call
   *   `GitHubClient` and the per-call `IssueClient`.
   */
  constructor({
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueStateService,
    configChain,
    execFileAsync,
    fetchFn = fetch,
    timeoutMs
  } = {}) {
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueStateService = issueStateService;
    this._configChain = configChain;
    this._execFileAsync = execFileAsync;
    this._fetchFn = fetchFn;
    this._timeoutMs = timeoutMs;
  }

  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @returns {{context: RepoContext, gitClient: GitClient,
   *   gitBranch: GitBranch, git: Git, githubClient: GitHubClient,
   *   issueClient: IssueClient}} a fresh, flat bundle wrapping
   *   `repoPath` (plus the shared `origin`/`githubToken`/
   *   `issueStateService`/`configChain`) into a new `RepoContext`, with
   *   every context-bound client built right alongside it.
   */
  build(repoPath) {
    const context = new RepoContext({
      repoPath,
      origin: this._origin,
      githubToken: this._githubToken,
      issueStateService: this._issueStateService,
      configChain: this._configChain
    });

    return this.buildFromContext(context);
  }

  /**
   * Wraps the context-bound clients around an existing `RepoContext`
   * instead of constructing a fresh one. Used when a caller already
   * holds a ready-made `RepoContext` (e.g. one injected by `Dispatcher`)
   * but still needs the full `PrOperations`/`PrChecker` bundle.
   *
   * `origin`/`githubToken`/`issueStateService`/`configChain` come from
   * the passed `context`, so the factory's own copies of those are not
   * consulted on this path — only `execFileAsync`/`fetchFn`/`timeoutMs`
   * are.
   * @param {RepoContext} context - an existing `RepoContext` to reuse
   *   verbatim as the bundle's `context`.
   * @returns {{context: RepoContext, gitClient: GitClient,
   *   gitBranch: GitBranch, git: Git, githubClient: GitHubClient,
   *   issueClient: IssueClient}} the same flat six-key bundle `build`
   *   returns, with `context` being the passed-in instance verbatim.
   */
  buildFromContext(context) {
    const gitClient = new GitClient({ context, execFileAsync: this._execFileAsync });
    const gitBranch = new GitBranch({ context, gitClient });
    const git = new Git({ context, gitBranch });
    const githubClient = new GitHubClient({ context, fetchFn: this._fetchFn, timeoutMs: this._timeoutMs });
    const issueClient = new IssueClient({ context, fetchFn: this._fetchFn, timeoutMs: this._timeoutMs });

    return { context, gitClient, gitBranch, git, githubClient, issueClient };
  }
}

export default RepoContextFactory;
