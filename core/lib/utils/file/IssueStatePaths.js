import path from 'node:path';

/**
 * Resolves the `.claude/state/issue-<id>.json` state/lock file paths
 * for a given repo checkout — a path-resolution concern distinct from
 * `IssueFileLocator.js`'s docs-issue markdown lookup.
 */
class IssueStatePaths {
  /**
   * @param {object} [deps] - injectable collaborators, for testing.
   * @param {import('../../context/RepoContext.js').default} [deps.repoContext] -
   *   the target repo's context, whose `repoPath` `#paths` falls back to
   *   when its own `repoPath` argument is omitted. Optional — every
   *   current caller still passes `repoPath` explicitly on every
   *   `#paths` call.
   */
  constructor({ repoContext } = {}) {
    this._repoContext = repoContext;
  }

  /**
   * @param {string} [repoPath] - the target repo's local checkout path.
   *   When omitted (falsy/`undefined`), falls back to the constructor-
   *   injected `repoContext`'s `repoPath` — an explicit `repoPath` here
   *   always wins over a constructor-injected `repoContext`.
   * @param {string} id - the numeric issue id.
   * @returns {{stateDir: string, stateFile: string, lockFile: string}}
   *   the state dir/file/lock paths for `id`.
   */
  paths(repoPath, id) {
    const base = repoPath ?? this._repoContext?.repoPath;
    const stateDir = path.join(base, '.claude', 'state');
    const stateFile = path.join(stateDir, `issue-${id}.json`);
    const lockFile = path.join(stateDir, `issue-${id}.lock`);

    return { stateDir, stateFile, lockFile };
  }
}

export default IssueStatePaths;
