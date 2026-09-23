# Add the table-driven GithubIssueMark command

Create `core/lib/commands/shared/GithubIssueMark.js`, the native equivalent of `github_issue_shell.sh`'s six `cmd_mark_*` functions. Don't grow `GithubIssue.js`, which is already large and covers a different concern (issue body/file I/O).

Shape:

```js
const MARK_TRANSITIONS = Object.freeze({
  created:   { add: 'created',   removes: ['idea', 'writting', 'enhancing'] },
  refined:   { add: 'refined',   removes: ['created', 'idea', 'writting'] },
  ready:     { add: 'ready',     removes: ['refined'] },
  enhancing: { add: 'enhancing', removes: ['idea', 'writting'] },
  planning:  { add: 'planning',  removes: ['idea', 'writting', 'created'] },
  split:     { add: 'split',     removes: ['planning'] }
});

class GithubIssueMark {
  constructor(repoContext, { issueTagger = new IssueTagger({ context: repoContext }) } = {}) { ... }

  async markCreated(id) { return this.mark('created', id); }
  // ...markRefined / markReady / markEnhancing / markPlanning / markSplit

  async mark(name, id) {
    const { repo } = await this._repoContext.resolve();   // Origin#resolve error → propagates → exit 1
    const { add, removes } = MARK_TRANSITIONS[name];

    await this._issueTagger.mutateTag(id, repo, 'add', add);
    for (const tag of removes) {
      await this._issueTagger.mutateTag(id, repo, 'remove', tag);
    }

    return '';
  }
}
```

Key points:
- **One shared implementation**, driven by a `{ add, removes[] }` table keyed by subcommand. The per-command methods exist only because `commands.js` maps each command to a method name. Export `MARK_TRANSITIONS` for the specs.
- **Reuse `IssueTagger#mutateTag`** (fixed in step 01) for every mutation, and through it `Tags.js`'s `TAG_TO_LABEL`. Do not re-derive label mapping or presence checks here.
- **`repo`, not `repoRef`**: `cmd_mark_*` sets `repo_ref="$_ORIGIN_REPO_PATH"` (plain `owner/repo`), so use `RepoContext#resolve().repo`. `resolveWithRef()` would add the domain for non-github.com hosts and break parity.
- **Origin failure**: let `resolve()`'s rejection propagate unchanged. `Dispatcher` already prints it and exits 1 for `github-issue-info`, which has the same `_load_origin`-only shell behavior. Check that the message matches `Error: '<repo_path>' is not a git repository or has no 'origin' remote`.
- **Return value**: `mutateTag` writes directly to stdout/stderr, so the method returns `''` (or whatever makes `Dispatcher` print nothing extra and exit 0). Check how `Dispatcher` treats an empty string or `undefined`, and match what `markEnqueued`'s command wrapper does.
- Confirm the `RepoContext` constructor signature the Dispatcher passes (`context: 'repo'` entries receive the context as the first constructor argument, as `GithubIssue` does).

Add unit specs at `core/spec/lib/commands/shared/GithubIssueMark_spec.js`, mirroring `core/lib/` one-to-one. Use an injected fake `issueTagger` and a stubbed `repoContext.resolve`. Split the spec file if it grows past the repo's usual size, following the existing `GithubIssue*_spec.js` naming. Cover:
- each of the six methods calling `mutateTag` with the exact `(id, 'owner/repo', action, tag)` sequence from the table;
- `repo` (not `repoRef`) being passed;
- a `resolve()` rejection propagating with no `mutateTag` calls;
- the method resolving even when `mutateTag` hits a failure path (with a real `IssueTagger` over a failing fake client, if practical).

## Files to Change
- `core/lib/commands/shared/GithubIssueMark.js` — new: `MARK_TRANSITIONS`, six thin methods, and the shared `mark`.
- `core/spec/lib/commands/shared/GithubIssueMark_spec.js` — new unit specs.
- `core/spec/support/factories/githubIssueMark.js` — new factory, only if the other command specs use one (compare `githubIssue.js`).
