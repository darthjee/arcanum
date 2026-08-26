# Trim IssueState to dispatch only

Reduce `core/lib/commands/IssueState.js` to dispatch logic only, now that its CRUD/private methods live in `IssueStateService` and its helpers (Steps 01–03).

Keep:

- `USAGE_MESSAGE` constant.
- `run(repoPath, subcommand, id, field, value)` — same signature, dispatch, and `repoPath` validation as today.
- The constructor's `RepoPath` validator (`this._repoPath = repoPath` default `new RepoPath()`), unchanged.
- Add the `IssueStateService`'s own injectable collaborators to the constructor — `lock`, `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths` (same optional defaults `IssueStateService` itself uses) — stored on `this` for the new private helper below.
- A new private `_issueStateService(repoPath)` helper, mirroring `AutoFixAllGithub#_prOperations` (core/lib/commands/AutoFixAllGithub.js:128):
  ```js
  _issueStateService(repoPath) {
    const context = new RepoContext({ repoPath });

    return new IssueStateService({
      context,
      lock: this._lock,
      jsonParser: this._jsonParser,
      jsonValueFormatter: this._jsonValueFormatter,
      jsonReader: this._jsonReader,
      issueStatePaths: this._issueStatePaths
    });
  }
  ```

Remove: `get`, `set`, `setJson`, `appendJson`, `write`, `_mutate`, `_corrupt`, `_writeRaw`, `_paths`, `_parseJson`, `_formatValue`, `_read` — all moved out in Steps 01–03.

Update `run`'s `switch` body to call through the new helper instead of `this.<method>` directly, e.g.:

```js
case 'get': {
  const result = await this._issueStateService(repoPath).get(id, field);
  ...
}
```

`core/bin/arcanum`'s dispatch table entry (`'issue-state': { module: 'commands/IssueState.js', method: 'run' }`) does not change.

After this trim, `core/spec/lib/commands/IssueState_spec.js` has no remaining CRUD tests (they moved to `IssueStateService_spec.js` in Step 03) — delete the file. The `run`/dispatch behavior is already fully covered end-to-end by the black-box `core/spec/bin/issueStateParity_spec.js` (shell vs. native via subprocess), which needs no changes and is the main regression check that this trim preserved byte-identical behavior. Run it to confirm before moving on.

## Files to Change

- `core/lib/commands/IssueState.js` — trimmed to dispatch only, per above.
- `core/spec/lib/commands/IssueState_spec.js` — delete (content moved to `IssueStateService_spec.js` in Step 03).
