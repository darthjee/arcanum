# node Plan: Migrate arcanum-split-issue-create-sub-issue-file entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

`scripter`'s `create_sub_issue_file_shell.sh` is the byte-identical output/exit-code reference this native module must match — see `plan.md`'s "Shared contracts" for the full behavior spec (usage/error messages, `RepoPath#validate` reuse, gap-tolerant counting, snake_case transform, output file shape).

## Implementation Steps

### Step 1 — Implement and wire up `ArcanumSplitIssueCreateSubIssueFile`

- Create `core/lib/ArcanumSplitIssueCreateSubIssueFile.js`, following `ArcanumSplitIssueFinish.js`'s shape (constructor-injected collaborators for testability, JSDoc on public methods, no runtime deps beyond built-ins):
  - Inject `RepoPath` (reuse `core/lib/RepoPath.js#validate`, do not reimplement) and `node:fs/promises` (`readdir`, `mkdir`, `readFile`, `writeFile`).
  - `run(repoPath, issueId, title, bodyFile)`: validates the 4 args are present (usage error otherwise, matching `Usage: create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>`), calls `RepoPath#validate(repoPath)`, checks `bodyFile` exists (`Error: file not found: <bodyFile>` otherwise), scans `docs/agents/issues/` for `<issueId>_[0-9][0-9]*_*` entries to compute the next gap-tolerant zero-padded count, snake_cases `title` via a private `_titleToSnakeCase` (identical transform to `ResolveIdAndFile.js`'s), writes `docs/agents/issues/<issueId>_<count>_<snakeTitle>.md` with `# <title>\n\n<body file content>`, creating `docs/agents/issues/` first if missing, and returns `FILE=<path>\n` (thrown `Error`s propagate uncaught for `core/bin/arcanum`'s `dispatch()` to turn into the `arcanum: <message>` / exit-1 shape).
- Register it in `core/bin/arcanum`'s `COMMANDS` map, alphabetically ordered among the existing `arcanum-split-issue-*` entries:
  ```js
  'arcanum-split-issue-create-sub-issue-file': { module: 'ArcanumSplitIssueCreateSubIssueFile.js', method: 'run' },
  ```
- Flip `"arcanum-split-issue-create-sub-issue-file"` from `false` to `true` in `arcanum/_lib/migration-status.json`.

### Step 2 — Tests

- `core/spec/lib/ArcanumSplitIssueCreateSubIssueFile_spec.js`: Jasmine unit specs covering usage errors (each of the 4 args missing), repo-path validation delegation, missing body file, fresh-id count `01`, incrementing counts, out-of-band files being picked up, gap-tolerance (a deleted count is never reused), the snake_case transform (punctuation, repeated separators, leading/trailing strip), and the success output/exit contract — mirror `test_create_sub_issue_file.sh`'s 5 assertions as the baseline case list.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js`: shell (`create_sub_issue_file_shell.sh`) vs. native (`core/bin/arcanum arcanum-split-issue-create-sub-issue-file`), same inputs, asserting identical stdout and exit code — follow the existing parity-spec pattern (e.g. `arcanumSplitIssueFinishParity_spec.js`).

## Files to Change

- `core/lib/ArcanumSplitIssueCreateSubIssueFile.js` — new native module.
- `core/bin/arcanum` — register the command.
- `arcanum/_lib/migration-status.json` — flip the entry to `true`.
- `core/spec/lib/ArcanumSplitIssueCreateSubIssueFile_spec.js` — new unit specs.
- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js` — new parity spec.

## CI Checks

- `core`: `make core-test` (CI job: `test`)

## Notes

- No `child_process` shell-out is needed for this entrypoint's own logic (pure filesystem/string work), so the security-review concern about string-interpolated `exec()` (script-engine.md's "Security requirements") doesn't apply here — unlike `ArcanumSplitIssueFinish.js`, which shells out to `github.sh mark-split`.
