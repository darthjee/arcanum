import GitBranch from './GitBranch.js';

/**
 * Thin git facade, bound to a single `RepoContext`, that
 * `PrOperations` depends on directly — keeping `GitBranch` an
 * implementation detail.
 */
class Git {
  /**
   * @param {object} deps - the facade's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context.
   * @param {GitBranch} [deps.gitBranch] - the branch resolver.
   */
  constructor({ context, gitBranch = new GitBranch({ context }) } = {}) {
    this._context = context;
    this._gitBranch = gitBranch;
  }

  /**
   * @returns {Promise<string>} the current branch's name — see
   *   `GitBranch#currentBranch`.
   */
  async currentBranch() {
    return this._gitBranch.currentBranch();
  }

  /**
   * @returns {Promise<{id: string, branch: string}|null>} the current
   *   branch's parsed issue id, when it matches `issue-<id>` — see
   *   `GitBranch#issueFromCurrentBranch`.
   */
  async issueFromCurrentBranch() {
    return this._gitBranch.issueFromCurrentBranch();
  }
}

export default Git;
