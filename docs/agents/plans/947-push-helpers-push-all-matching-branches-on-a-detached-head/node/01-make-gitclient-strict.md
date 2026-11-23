# Make GitClient strict
Add `requireCurrentBranch()` to `core/lib/utils/git/GitClient.js`: it calls `currentBranch()` and, when the result is empty, throws `new Error('refusing to push: no current branch (detached HEAD?)')`; otherwise it returns the name. Export the message as a named constant (e.g. `DETACHED_HEAD_MESSAGE`) so specs and commands reference one source.

Rewrite `pushCurrentBranch()` as strict: `const branch = await this.requireCurrentBranch();`, then `execFileAsync('git', ['push', '-u', 'origin', `${branch}:${branch}`], { cwd })`, returning its `stdout`. Remove the swallowing `try/catch`, and replace the doc comment (which wrongly claims every caller of the shell function tolerates failure) with one describing the strict contract and noting that best-effort callers wrap it themselves.

Update `core/spec/lib/utils/git/GitClient_spec.js`:
- `#requireCurrentBranch`: returns the trimmed name; rejects with the refusal message on empty output.
- `#pushCurrentBranch`: pushes `<b>:<b>` and resolves to stdout; on an empty branch rejects and never invokes `git push` (assert on the `execFileAsync` spy's calls); a failing `git push` now rejects. Replace the two "tolerates …" expectations.

## Files to Change
- `core/lib/utils/git/GitClient.js`: `requireCurrentBranch`, strict `pushCurrentBranch`, message constant, doc comment.
- `core/spec/lib/utils/git/GitClient_spec.js`: new/updated expectations.
