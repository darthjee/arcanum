# Guard RepoContext#createIssue with its own validate()

`GithubIssue#create` runs on two paths: the `github-issue-create` CLI entry
(covered by step 03's Dispatcher guard) and the `RepoContext#createIssue`
collaborator path (`core/lib/context/RepoContext.js:109-111`), whose only
in-process caller is `SpawnIssue.js:168`. Once step 05 removes the guard from
`GithubIssue.js`, the collaborator method must guard its own `repoPath` so it
does not depend on the caller having been dispatched.

- In `RepoContext#createIssue`, call `await this.validate()` before delegating:

  ```js
  async createIssue(title, bodyFile) {
    await this.validate();
    return this._githubIssue.create(this.repoPath, title, bodyFile);
  }
  ```

- This is behaviour-neutral for `spawn-issue` today (it is `context: 'repo'` and
  already Dispatcher-validated in step 03), and closes the gap for any future
  non-dispatched caller.

## Files to Change

- `core/lib/context/RepoContext.js` — `await this.validate()` at the top of
  `createIssue`.
