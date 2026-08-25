import GitClient from './GitClient.js';

/**
 * Owns `issue-<id>` branch parsing, deduplicating the regex previously
 * repeated across `PrOperations#prNumber`/`#prMerge`. Delegates the
 * actual `git branch --show-current` call to an injected `GitClient`
 * rather than re-implementing it.
 */
class GitBranch {
  /**
   * @param {object} deps - the branch resolver's collaborators.
   * @param {import('../../context/RepoContext.js').default} deps.context -
   *   the target repo's context (for `repoPath`).
   * @param {GitClient} [deps.gitClient] - git CLI client.
   */
  constructor({ context, gitClient = new GitClient({ context }) } = {}) {
    this._context = context;
    this._gitClient = gitClient;
  }

  /**
   * @returns {Promise<string>} the current branch's name.
   */
  async currentBranch() {
    return this._gitClient.currentBranch();
  }

  /**
   * @returns {Promise<{id: string, branch: string}|null>} the parsed
   *   issue id and branch name when the current branch matches
   *   `issue-<id>`, or `null` otherwise.
   */
  async issueFromCurrentBranch() {
    const branch = await this.currentBranch();
    const match = branch.match(/^issue-(\d+)$/);

    return match ? { id: match[1], branch } : null;
  }
}

export default GitBranch;
