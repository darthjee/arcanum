import path from 'node:path';

/**
 * Resolves the `.claude/state/issue-<id>.json` state/lock file paths
 * for a given repo checkout — a path-resolution concern distinct from
 * `IssueFile.js`'s docs-issue markdown lookup.
 */
class IssueStatePaths {
  /**
   * @param {string} repoPath - the target repo's local checkout path.
   * @param {string} id - the numeric issue id.
   * @returns {{stateDir: string, stateFile: string, lockFile: string}}
   *   the state dir/file/lock paths for `id`.
   */
  paths(repoPath, id) {
    const stateDir = path.join(repoPath, '.claude', 'state');
    const stateFile = path.join(stateDir, `issue-${id}.json`);
    const lockFile = path.join(stateDir, `issue-${id}.lock`);

    return { stateDir, stateFile, lockFile };
  }
}

export default IssueStatePaths;
