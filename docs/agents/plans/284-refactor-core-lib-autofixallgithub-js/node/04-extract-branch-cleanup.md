# Extract BranchCleanup.js

Move `AutoFixAllGithub#cleanupBranch` into a new `core/lib/utils/git/BranchCleanup.js` class, verbatim (relocation, not a rewrite — output must stay byte-identical, including its tolerant `git push origin --delete` step and the concatenated stdout of `git checkout main` / `git reset --hard origin/main` / `git branch -D <branch>`).

This class needs **no** `fetch`/`githubToken` dependency — it's pure local `git` via the same injectable `execFileAsync` pattern `Origin.js` already uses. Do not wire it into `PrOperations.js`; it belongs in `utils/git/`, not `utils/github/`, since it makes no GitHub API calls at all.

## Files to Change

- `core/lib/utils/git/BranchCleanup.js` (new) — the moved `cleanupBranch` logic (rename the public method however reads best standalone, e.g. `cleanup(repoPath, id)` or keep `cleanupBranch(repoPath, id)` — either is fine as long as the facade's own method name/behavior in step 05 doesn't change), with an injectable `execFileAsync` collaborator (default `promisify(execFile)`, same as `Origin.js`).
- `core/spec/lib/utils/git/BranchCleanup_spec.js` (new) — move the corresponding spec cases from `AutoFixAllGithub_spec.js`, unchanged in assertions/fixtures.

Leave `AutoFixAllGithub.js` itself untouched in this step, for the same reason as step 03 — removal and facade wiring happen together in step 05.
