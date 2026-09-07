import path from 'node:path';

/**
 * Resolves the `.claude/state/issue-<id>.json` state/lock file paths
 * for a given repo checkout — a path-resolution concern distinct from
 * `IssueFileLocator.js`'s docs-issue markdown lookup.
 */
class IssueStatePaths {
  /**
   * @param {import('../../context/RepoContext.js').default} repoContext -
   *   the target repo's context, whose `repoPath` `#paths` resolves
   *   the state dir/file/lock paths against.
   */
  constructor(repoContext) {
    this._repoContext = repoContext;
  }

  /**
   * @param {string} id - the numeric issue id.
   * @returns {{stateDir: string, stateFile: string, lockFile: string}}
   *   the state dir/file/lock paths for `id`.
   */
  paths(id) {
    const base = this._repoContext.repoPath;
    const stateDir = path.join(base, '.claude', 'state');
    const stateFile = path.join(stateDir, `issue-${id}.json`);
    const lockFile = path.join(stateDir, `issue-${id}.lock`);

    return { stateDir, stateFile, lockFile };
  }
}

export default IssueStatePaths;
