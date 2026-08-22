# Unit tests

Write `core/spec/ArcanumSplitIssueCreateSubIssue_spec.js`, mirroring the structure of `core/spec/ArcanumSplitIssueFinish_spec.js` / `core/spec/SpawnIssue_spec.js` (constructor-injected fakes/spies for `repoPath`, `spawnIssue`, `issueState`, and the file-reading collaborator — no real filesystem, network, or `gh` calls).

Cover:

- Missing/empty `repoPath`, `issueId`, or `subIssueFile` — throws the usage `Error`.
- `repoPath.validate` rejecting — propagates.
- `subIssueFile` not found — throws `Error('Error: file not found: <path>')`.
- Title/body parsing: a draft file with `# Title` on line 1, blank line 2, multi-line body from line 3 on — asserts the exact `title`/`body` split, including a body containing blank lines of its own (must not stop at the first blank line inside the body).
- Count-segment derivation: filename `<issueId>_02_<slug>.md` → count `02` in the progress line; a filename where the segment isn't numeric → falls back to `?`.
- Happy path: `spawnIssue.run` resolves with `STATUS=ok\nID=42\nURL=...\n` → asserts `issueState.appendJson` (or `.run(..., 'append-json', ...)`) was called with `issueId`, `'sub-issues'`, and `JSON.stringify('42')`, and the returned string is `<progress-line>STATUS=ok\nID=42\n`.
- Failure path: `spawnIssue.run` rejects with `DispatchFailure('STATUS=failed\n')` → asserts the module throws/propagates a `DispatchFailure` whose `.stdout` still contains `STATUS=failed\n`, and that `issueState.appendJson` was **not** called.
- The temp body file passed to `spawnIssue.run` contains exactly the parsed `body` (plus trailing newline, matching `printf '%s\n'`), and is cleaned up (verify the injected cleanup collaborator was called) even on the failure path.

## Files to Change

- `core/spec/ArcanumSplitIssueCreateSubIssue_spec.js` — new unit test suite.
