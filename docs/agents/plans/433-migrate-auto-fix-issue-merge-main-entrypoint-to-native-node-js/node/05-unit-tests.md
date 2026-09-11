# Native unit tests

Create `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js`, mirroring `AutoFixIssueCreateBranch_spec.js`'s conventions (inject a fake/spy `execFileAsync` via the constructor's `deps` argument rather than shelling out for real — unit tests stay fast and hermetic; real-git behavior is covered by the parity test in step 06).

Cover, at minimum:

- **No `origin/main` ref**: fetch succeeds, `git show-ref --verify --quiet refs/remotes/origin/main` rejects → `run()` resolves `'STATUS=ok\n'`, no `git merge` call made.
- **Clean merge**: fetch succeeds, ref exists, `git merge --no-edit origin/main` resolves → `run()` resolves `'STATUS=ok\n'`.
- **Conflict**: fetch succeeds, ref exists, `git merge --no-edit origin/main` rejects, `git diff --name-only --diff-filter=U` resolves with a multi-line file list → `run()` rejects with a `DispatchFailure` whose `.stdout` is `'STATUS=conflict\n<file1>\n<file2>\n'` and `.exitCode` is `2`.
- **Fetch — tolerated failure**: `git fetch origin main` rejects with stderr matching `couldn't find remote ref` (or `not found` / `no such ref`, case-insensitively) → treated as "no `origin/main`", same as the no-ref case above (resolves `'STATUS=ok\n'`).
- **Fetch — hard failure**: `git fetch origin main` rejects with an unrelated stderr message → `run()` rejects, propagating the error uncaught (mirrors the shell script's `exit 1`).

## Files to Change

- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueMergeMain_spec.js` — new file, unit tests as described above.
