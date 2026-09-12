# Write native unit tests

Create `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`,
following `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`'s
structure closely (fake `execFileAsync` answering `git add`/`commit -F
-`/`branch --show-current`/`push -u`; fake `ConfigChain` answering
`git.agents.architect.email` / `git.omit_model_coauthor`; a real temp dir via
`createTempDir`/`removeTempDir` from `core/spec/support/utils/tempDir.js` to
back the file-existence check). Cover:

- Missing `file_path` (and each of the other required arguments) → rejects with
  the exact usage message.
- `file_path` pointing at a nonexistent path → rejects with
  `Error: file not found: <file_path>`.
- Both commit-template shapes (`commit_template_engine_get` resolving `'old'`
  vs `'new'`) — verify the assembled commit message's agent email differs
  accordingly (falls back to `modelEmail` for `'old'`; resolves via
  `ConfigChain`'s `agents.architect.email` for `'new'`).
- `omit_model_coauthor` set vs. unset — verify the model's own
  `Co-Authored-By` trailer is present/absent accordingly, while the
  `architect agent` trailer is always present.
- The full assembled commit message and call sequence: `git add <file_path>` →
  `git commit -F -` (asserting the piped `options.input` message matches
  `docs(issue): add issue file (issue #<id>)` plus trailers exactly) → `git
  branch --show-current` → `git push -u origin <branch>:<branch>`, and that
  `run`'s resolved value is `commitStdout + pushStdout` concatenated.

## Files to Change

- `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js` — new
  unit test suite for the native module.
