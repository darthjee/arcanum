# Add the native AutoFixIssueMergeMain command

Create `core/lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js`, following `AutoFixIssueCreateBranch.js`'s shape (constructor takes `repoContext` + an injectable `execFileAsync`, `run()` is the sole public method, private `_`-prefixed helpers do the actual work, full JSDoc).

Re-derive `arcanum/_lib/git_branch.sh`'s `git_branch_fetch_main` + `git_branch_merge_main` natively (they stay untouched in bash — no wholesale `_lib` migration, per `docs/agents/architecture/script-engine.md`'s scope boundaries):

1. **Fetch**: run `git fetch origin main` (`execFile('git', ['fetch', 'origin', 'main'], { cwd: repoPath })`). If it fails, inspect the captured stderr: when it matches (case-insensitively) `couldn't find remote ref`, `not found`, or `no such ref`, tolerate it (continue as if `origin/main` doesn't exist) — any other failure is a hard error, propagated uncaught (`dispatch()` turns it into the standard `arcanum: <message>` / exit 1 path, matching the shell script's `exit 1`).
2. **No-op check**: run `git show-ref --verify --quiet refs/remotes/origin/main` (`execFile` resolves on exit 0, rejects otherwise). If it rejects (ref doesn't exist), return `'STATUS=ok\n'` immediately — mirrors the shell's `git show-ref ... || return 0`.
3. **Merge**: run `git merge --no-edit origin/main` in `repoPath`. On success, return `'STATUS=ok\n'`.
4. **Conflict**: if the merge fails, run `git diff --name-only --diff-filter=U` to collect the conflicted paths (one per line, same as the shell script), and throw `new (core/lib/utils/errors/DispatchFailure.js)('STATUS=conflict\n' + files.join('\n') + '\n', 2)` — this is exactly the "print to stdout, still fail" shape `DispatchFailure`'s own docstring calls out as its `merge conflict` example. Do **not** run `git merge --abort` — the shell script leaves the conflict markers in the working tree on purpose, so the native path must too.

`run()` takes no arguments beyond what `repoContext` already provides (`repoPath`) — `merge_main_shell.sh`'s only CLI arg is `<repo_path>`, and per `script-engine.md`'s known divergence note, the `context: 'repo'` dispatcher already validates `repoPath` unconditionally before calling `run()`, so no separate usage guard is needed inside the command itself.

## Files to Change

- `core/lib/commands/auto-fix-issue/AutoFixIssueMergeMain.js` — new file, native command as described above.
