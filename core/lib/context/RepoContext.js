import ConfigChain from '../utils/config/ConfigChain.js';
import GithubIssue from '../commands/GithubIssue.js';
import GithubToken from '../utils/github/GithubToken.js';
import IssueStateService from '../services/IssueStateService.js';
import Origin from '../utils/git/Origin.js';

/**
 * Bundles a single repo's `repoPath` with the 5 collaborators
 * `PrOperations` (and friends) resolve it against — `origin`,
 * `githubToken`, `issueStateService`, `configChain`, `githubIssue` — so
 * callers stop threading `repoPath` through every method call
 * individually. One `RepoContext` is built per call site (`repoPath`
 * differs call to call), wrapping whichever shared collaborator
 * instances the caller already holds.
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
   * @param {GithubIssue} [deps.githubIssue] - GitHub issue creator.
   */
  constructor({
    repoPath,
    origin = new Origin(),
    githubToken = new GithubToken(),
    issueStateService,
    configChain = new ConfigChain(),
    githubIssue = new GithubIssue()
  } = {}) {
    this.repoPath = repoPath;
    this._origin = origin;
    this._githubToken = githubToken;
    this._issueStateService = issueStateService ?? new IssueStateService({ context: this });
    this._configChain = configChain;
    this._githubIssue = githubIssue;
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
   *   see `GithubIssue#create`.
   */
  async createIssue(title, bodyFile) {
    return this._githubIssue.create(this.repoPath, title, bodyFile);
  }
}

export default RepoContext;
