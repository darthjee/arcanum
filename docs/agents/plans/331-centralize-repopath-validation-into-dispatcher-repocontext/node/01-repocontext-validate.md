# Add RepoContext#validate() and its RepoPath collaborator

Give `RepoContext` an explicit lazy `async validate()` that runs the same three
checks each command does today, throwing the identical `RepoPath#validate`
messages. It must NOT run from the constructor — `RepoContext` is built with fake
paths throughout the specs, and `RepoPath#validate` does real `stat` +
`git rev-parse` I/O.

- Add a `repoPathValidator = new RepoPath()` entry to the constructor's `deps`
  destructure (a distinct name from the existing `repoPath` *string* param — do
  not shadow it), stored as `this._repoPathValidator`. Import `RepoPath` from
  `../utils/file/RepoPath.js`.
- Add:

  ```js
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
  ```

- Update the class JSDoc (`core/lib/context/RepoContext.js:7-15`) to mention it
  now owns `repoPath` validation, mirroring `repo_path_enter`'s role.

## Files to Change

- `core/lib/context/RepoContext.js` — import `RepoPath`, add the
  `repoPathValidator` dep, add the `validate()` method, refresh the class JSDoc.
