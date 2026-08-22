# Create the native module

Write `core/lib/ArcanumSplitIssueFinish.js`, the native equivalent of `arcanum-split-issue/scripts/finish_shell.sh`. Follow the constructor-injection shape used by `core/lib/SpawnIssue.js`/`core/lib/SafeBranch.js`: a `constructor({ repoPath, execFileAsync, safeBranch, readdir, unlink } = {})` with real defaults (`new RepoPath()`, `promisify(execFile)`, `new SafeBranch()`, `node:fs/promises`'s `readdir`/`unlink`), so specs can inject fakes.

`run(repoPath, issueId)`:
1. `if (!repoPath || !issueId) throw new Error('Usage: finish.sh <repo_path> <issue_id>')` — mirror the shell script's own usage message text exactly.
2. `await this._repoPath.validate(repoPath)`.
3. Shell out to the relabel step: `await this._execFileAsync(path.join(repoPath, 'arcanum-split-issue', 'scripts', 'github.sh'), ['mark-split', repoPath, issueId])` — array args only, matching the security requirement in `docs/agents/architecture/script-engine.md` (no string-interpolated `exec()`). Let any failure here propagate uncaught (`finish_shell.sh` runs under `set -euo pipefail`, so a failing `github.sh mark-split` call aborts the whole script the same way).
4. Delete matching local files under `<repoPath>/docs/agents/issues/`:
   - `readdir` that directory.
   - First pass: every entry whose name starts with `${issueId}-`, delete it (`unlink`), collect its `docs/agents/issues/<name>` relative path into a `deleted` array.
   - Second pass: every entry whose name starts with `${issueId}_`, same treatment, appended after the first pass's entries — the two-pass order matters for parity with the shell script's two separate `for` loops.
   - Build the `Deleted:` block: `deleted.length ? 'Deleted:\n' + deleted.map((f) => `  ${f}\n`).join('') : 'Deleted: (nothing to clean up)\n'`.
5. Release the branch: `const branch = await this._safeBranch.checkout(repoPath);` then append `` `BRANCH=${branch}\n` `` to the output. Use `SafeBranch#checkout` (not `#run`) since `repoPath` was already validated in step 2 — calling `#run` again would re-validate redundantly.
6. Return the concatenated `Deleted:` block + `BRANCH=` line as the method's resolved string (this is what `core/bin/arcanum`'s `dispatch()` writes to stdout on success).

Add full JSDoc on the class and every public method, matching the density/style of `core/lib/SafeBranch.js` and `core/lib/IssueState.js` (explain the *why*/mirrored-shell-behavior, not just the *what*).

## Files to Change

- `core/lib/ArcanumSplitIssueFinish.js` — new file.
