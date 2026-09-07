import ConfigChain from '../utils/config/ConfigChain.js';
import GithubIssueService from '../services/GithubIssueService.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueStateService from '../services/IssueStateService.js';
import Origin from '../utils/git/Origin.js';
import RepoPath from '../utils/file/RepoPath.js';

/**
 * Bundles a single repo's `repoPath` with the 5 collaborators
 * `PrOperations` (and friends) resolve it against — `origin`,
 * `githubToken`, `issueStateService`, `configChain`, `githubIssueService`
 * — so callers stop threading `repoPath` through every method call
 * individually. One `RepoContext` is built per call site (`repoPath`
 * differs call to call), wrapping whichever shared collaborator
 * instances the caller already holds.
 *
 * It also owns `repoPath` validation — present / is-a-directory /
 * is-a-git-repository — via the lazy `validate()` method, mirroring
 * `arcanum/_lib/repo_path.sh`'s `repo_path_enter`. `Dispatcher` calls it
 * once on the `context: 'repo'` path (and `#createIssue` calls it for
 * the in-process collaborator path); it never runs from the constructor,
 * since specs build `RepoContext` with fake paths.
 */
class RepoContext {
  /**
   * @param {object} [deps] - the context's target repo and injectable
   *   collaborators, for testing.
   * @param {string} deps.repoPath - the target repo's local checkout
   *   path.
   * @param {Origin} [deps.origin] - git-origin resolver.
   * @param {GithubToken} [deps.githubToken] - GitHub token resolver.
   * @param {IssueStateService} [deps.issueStateService] - issue
   *   state-file reader/writer, bound to this context.
   * @param {ConfigChain} [deps.configChain] - 3-tier config reader.
   * @param {GithubIssueService} [deps.githubIssueService] - GitHub issue
   *   creator.
   * @param {RepoPath} [deps.repoPathValidator] - `repoPath`
   *   present/directory/git-repo validator (distinct from the
   *   `repoPath` string param).
   */
  constructor({
    repoPath,
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueStateService,
    configChain = new ConfigChain(),
    githubIssueService = new GithubIssueService(),
    repoPathValidator = new RepoPath()
  } = {}) {
    this.repoPath = repoPath;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueStateService = issueStateService ?? new IssueStateService({ context: this });
    this._configChain = configChain;
    this._githubIssueService = githubIssueService;
    this._repoPathValidator = repoPathValidator;
  }

  /**
   * Validate this context's `repoPath` — present, a directory, a git
   * repository — throwing the exact `repo_path_enter` messages on
   * failure. Called once by `Dispatcher` on the `context: 'repo'` path
   * (and by `#createIssue`); never from the constructor, since specs
   * build `RepoContext` with fake paths.
   * @returns {Promise<void>}
   */
  async validate() {
    return this._repoPathValidator.validate(this.repoPath);
  }

  /**
   * @returns {Promise<{domain: string, repo: string, repoRef: string}>}
   *   `this.repoPath`'s parsed origin, plus its derived `repoRef` — see
   *   `Origin#resolveWithRef`.
   */
  async resolveWithRef() {
    return this._origin.resolveWithRef(this.repoPath);
  }

  /**
   * @returns {Promise<{domain: string, repo: string}>} `this.repoPath`'s
   *   parsed origin — see `Origin#resolve`.
   */
  async resolve() {
    return this._origin.resolve(this.repoPath);
  }

  /**
   * @returns {Promise<string>} `this.repoPath`'s GitHub token — see
   *   `GithubToken#get`.
   */
  async getToken() {
    return this._githubToken.get(this.repoPath);
  }

  /**
   * @param {string} id - the numeric issue id.
   * @param {string} key - the state field's name.
   * @returns {Promise<string>} `this.repoPath`'s cached issue-state
   *   field value — see `IssueStateService#get`.
   */
  async getIssueState(id, key) {
    return this._issueStateService.get(id, key);
  }

  /**
   * @param {string} id - the numeric issue id.
   * @param {string} field - the state field's name.
   * @param {string} jsonValue - the raw JSON text to parse and append.
   * @returns {Promise<void>} resolves once the state file is written —
   *   see `IssueStateService#appendJson`.
   */
  async appendIssueState(id, field, jsonValue) {
    return this._issueStateService.appendJson(id, field, jsonValue);
  }

  /**
   * @param {string} scope - the top-level config namespace.
   * @param {string} key - the config key to read.
   * @returns {Promise<*>} `this.repoPath`'s resolved config value — see
   *   `ConfigChain#read`.
   */
  async readConfig(scope, key) {
    return this._configChain.read(this.repoPath, scope, key);
  }

  /**
   * @param {string} title - the new issue's title.
   * @param {string} bodyFile - the local file whose contents become the
   *   issue's body.
   * @returns {Promise<string>} `this.repoPath`'s newly created issue's
   *   `ID=...\nTITLE=...\nFILE=...\nDOMAIN=...\nREPO=...\n` output —
   *   see `GithubIssueService#create`.
   */
  async createIssue(title, bodyFile) {
    await this.validate();
    return this._githubIssueService.create(this.repoPath, title, bodyFile);
  }
}

export default RepoContext;
