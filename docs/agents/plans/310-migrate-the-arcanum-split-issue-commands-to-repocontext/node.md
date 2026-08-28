# Node Plan: Migrate the arcanum-split-issue commands to RepoContext

Main plan: [plan.md](plan.md)

Issue: [310-migrate-the-arcanum-split-issue-commands-to-repocontext.md](../../issues/310-migrate-the-arcanum-split-issue-commands-to-repocontext.md)

## Overview

Sub-issue 1 (`Dispatcher` + `core/lib/core/commands.js` + the `takesRepoContext`
flag) has landed and is wired into `core/bin/arcanum`. This plan applies that
mechanism to the four `arcanum-split-issue` commands:

- `arcanum-split-issue-create-sub-issue` → `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`
- `arcanum-split-issue-create-sub-issue-file` → `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js`
- `arcanum-split-issue-finish` → `core/lib/commands/ArcanumSplitIssueFinish.js`
- `arcanum-split-issue-push-sub-issues` → `core/lib/commands/ArcanumSplitIssuePushSubIssues.js`

Each command: constructor becomes `constructor(repoContext, { ...deps } = {})`
(context stored as `this._repoContext`), `repoPath` reached via
`this._repoContext.repoPath`, the leading `repoPath` method parameter dropped
(the `Dispatcher` strips `args[0]` when the flag is set), the deps key
`repoPath` (a `RepoPath` validator) renamed `repoPathValidator`, and the
`COMMANDS` entry gets `takesRepoContext: true`.

## Context

- **Constructor shape is forced.** `core/lib/core/dispatcher.js` does
  `new ModuleClass(this.repoContext)` — one positional argument — so
  `repoContext` must be the leading positional parameter, no default. The
  second `{ ...deps } = {}` argument keeps every existing injectable
  collaborator for tests and defaults to `{}` so `new Foo(repoContext)` works.
- **Both `repoPath` checks stay per-command**, in order: the presence guard
  (`if (!this._repoContext.repoPath || !issueId || …) throw new Error(USAGE)`)
  then `this._repoPathValidator.validate(this._repoContext.repoPath)`. Neither
  `Dispatcher` nor `RepoContext` validates. The `USAGE` strings are unchanged
  (they keep their `<repo_path>` token). Hoisting validation up is #308
  sub-issue 6, explicitly not done here.
- **`ArcanumSplitIssueCreateSubIssue` needs `IssueStateService#appendJson`.**
  Today it builds its own `new RepoContext({ repoPath })` in a private
  `_issueStateService(repoPath)` helper and forwards five knobs (`lock`,
  `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths`) the spec
  never overrides. `RepoContext` already owns an `IssueStateService`
  (`this._issueStateService`) but only exposes the read side
  (`getIssueState` → `.get()`). Add a `RepoContext#appendIssueState(id, field,
  jsonValue)` passthrough mirroring `getIssueState`; the command then calls
  `this._repoContext.appendIssueState(issueId, SUB_ISSUES_FIELD,
  JSON.stringify(newId))`, and the helper + five knobs are deleted. Final deps
  for that command: `spawnIssue`, `readFile`, `writeFile`, `mkdtemp`, `rm`,
  `repoPathValidator`.
- **`ArcanumSplitIssuePushSubIssues` → `ArcanumSplitIssueCreateSubIssue`.** The
  only intra-group call. `push`'s constructor default becomes
  `createSubIssue = new ArcanumSplitIssueCreateSubIssue(repoContext)` (its own
  `repoContext` positional is in scope for the second-arg defaults), and the
  per-file call becomes `this._createSubIssue.run(issueId, file)` (was
  `.run(repoPath, issueId, file)`). Output format, `_extractField(output,
  'ID')`, the `<file>:<newId>` CSV and the `DispatchFailure` catch/re-throw are
  unchanged.
- **Collaborators not migrated in this issue** keep their `repoPath`-per-call
  signatures and just receive `this._repoContext.repoPath`:
  `SpawnIssue#run(repoPath, …)` (from `ArcanumSplitIssueCreateSubIssue`; #308
  sub-issue 4), `SafeBranch#checkout(repoPath)` and the
  `arcanum-split-issue/scripts/github.sh` `execFile` shellout — both path and
  `['mark-split', repoPath, issueId]` args — (from `ArcanumSplitIssueFinish`;
  `SafeBranch` is #308 sub-issue 5). The `spawnIssue` / `safeBranch` deps stay
  `new SpawnIssue()` / `new SafeBranch()`.
- **Private helpers** (`_spawn`, `_deleteWorkingFiles`, …) currently thread
  `repoPath` as a parameter; prefer reading `this._repoContext.repoPath`
  directly and dropping the parameter, to shrink signatures.
- **`core/bin/arcanum` call sites are unchanged.** The
  `arcanum-split-issue/scripts/*.sh` shims invoke `engine_dispatch "$REPO_PATH"
  <command> … -- "$@"` i.e. `core/bin/arcanum <command> <repoPath> "$@"`; the
  `Dispatcher` consumes the leading `repoPath`. No skill-side edit; just verify.
- **`arcanum/_lib/migration-status.json`** already has all four entries `true`;
  do not touch it.

## Backward-compat gate

The four `core/spec/bin/arcanumSplitIssue*Parity_spec.js` files
(`…CreateSubIssueParity`, `…CreateSubIssueFileParity`, `…FinishParity`,
`…PushSubIssuesParity`) must pass **with zero edits**. They run the real
`*_shell.sh` against `core/bin/arcanum <cmd> <repoPath> …` and assert
byte-identical stdout + exit code (+ stderr). Watch:

- Error ordering — presence guard before `validate` (the "missing `<repo_path>`"
  parity case asserts empty stdout + non-zero exit, so a native throw must
  precede any stdout write).
- Error routing — `USAGE`/`validate` → stderr with the `arcanum: ` prefix (owned
  by `core/bin/arcanum`); `DispatchFailure` → stdout + exit 1. Untouched here.
- `ArcanumSplitIssueCreateSubIssue`'s retry-exhausted parity case still drives
  `new SpawnIssue()` + `.run(repoPath, …)`.

## Steps

- [01 — Add RepoContext#appendIssueState passthrough](node/01-add-repocontext-append-issue-state.md)
- [02 — Migrate ArcanumSplitIssueCreateSubIssueFile](node/02-migrate-create-sub-issue-file.md)
- [03 — Migrate ArcanumSplitIssueFinish](node/03-migrate-finish.md)
- [04 — Migrate ArcanumSplitIssueCreateSubIssue](node/04-migrate-create-sub-issue.md)
- [05 — Migrate ArcanumSplitIssuePushSubIssues](node/05-migrate-push-sub-issues.md)
- [06 — Dispatcher/registry assertions and full verification](node/06-verify.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

Run both from the `core/` directory (CI uses `working_directory: ~/project/core`).

## Notes

- Steps 02–05 each flip one `COMMANDS` flag and adjust
  `core/spec/lib/core/commands_spec.js`'s `takesRepoContext` assertion to the
  set flipped so far, keeping the tree green after every step. Registry
  (insertion) order puts the four `arcanum-split-issue-*` keys first, before
  `dispatch-fixture-repo-context`, so the final expected `withFlag` array is
  `['arcanum-split-issue-create-sub-issue',
  'arcanum-split-issue-create-sub-issue-file', 'arcanum-split-issue-finish',
  'arcanum-split-issue-push-sub-issues', 'dispatch-fixture-repo-context']`. Also
  rename that spec's `it(...)` description away from "only sets takesRepoContext
  on the dispatch-fixture-repo-context test entry".
- Unit-spec edits are construction-only (build/pass a `RepoContext` instead of
  threading `repoPath` to the method) and spy-call argument shifts. No
  `expect(...stdout...)` / expected-output line changes anywhere.
- `RepoContext` test double per command: plain `{ repoPath }` literal for
  `…CreateSubIssueFile`, `…Finish`, `…PushSubIssues` (they call no method on the
  context); real `new RepoContext({ repoPath: <createTempDir()> })` for
  `…CreateSubIssue` (keeps its on-disk `.claude/state/issue-<id>.json`
  assertions verbatim and exercises `appendIssueState` → `appendJson` for real).
- `createRepoContextMock` (`core/spec/support/factories/repoContextFactory.js`)
  gains an `appendJson: jasmine.createSpy()` on its `issueStateService` mock
  (step 01) so the factory stays a faithful mirror of `RepoContext`'s API,
  even though `…CreateSubIssue`'s own spec uses a real context.
- Not a root-folder change; no `arcanum/migrations/repos/` migration; no
  script-driven interactive flow.
