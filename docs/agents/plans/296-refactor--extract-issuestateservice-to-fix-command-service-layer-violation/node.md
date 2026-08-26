# Node Plan: Refactor: Extract IssueStateService to fix command→service layer violation

Main plan: [plan.md](plan.md)

## Overview

`RepoContext` (core/lib/context/) and, transitively, `PrOperations` (core/lib/utils/github/) currently depend on `IssueState` (core/lib/commands/), a CLI entrypoint class — a layering violation (`commands`/`context`/`services` should never be depended on by `utils`/`context`, and `services`/`utils` should never import from `commands`). This plan extracts `IssueState`'s CRUD logic bottom-up: first the small stateless helpers (JSON parsing/formatting/reading, path resolution) into `utils/`, then the CRUD orchestration into a new `IssueStateService` in a new `core/lib/services/` layer, then updates every caller (`IssueState` itself, `RepoContext`, `GithubIssue`, `ArcanumSplitIssueCreateSubIssue`) to go through it via a per-call builder — mirroring the existing `AutoFixAllGithub#_prOperations` pattern for bridging the CLI dispatcher's zero-arg construction with a `repoPath`-bound collaborator. Every observable behavior (CLI stdout/exit codes, state-file contents) stays byte-identical throughout.

## Context

`core/bin/arcanum`'s dispatcher instantiates every command with zero constructor args and passes `repoPath` only as a per-call method argument — no command has `repoPath` at construction time. `IssueStateService` is bound to a `RepoContext` fixed at construction (the newer context-bound convention `PrOperations` already uses), so each caller builds a fresh, per-call `RepoContext`/`IssueStateService` pair via a small private helper, exactly like `AutoFixAllGithub#_prOperations` (core/lib/commands/AutoFixAllGithub.js:128) already does for `PrOperations`.

## Steps

- [01 — Extract JSON utility classes](node/01-extract-json-utility-classes.md)
- [02 — Extract IssueStatePaths](node/02-extract-issuestatepaths.md)
- [03 — Create IssueStateService](node/03-create-issuestateservice.md)
- [04 — Trim IssueState to dispatch only](node/04-trim-issuestate-to-dispatch-only.md)
- [05 — Update RepoContext and its dependents](node/05-update-repocontext-and-its-dependents.md)
- [06 — Update GithubIssue and ArcanumSplitIssueCreateSubIssue](node/06-update-githubissue-and-arcanumsplitissuecreatesubissue.md)
- [07 — Document the core/lib/ layering](node/07-document-the-core-lib-layering.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `lint`)

## Notes

- The `issue-state` CLI's dispatch/`run` behavior is already covered end-to-end by the black-box `core/spec/bin/issueStateParity_spec.js` (shell vs. native, via `core/bin/arcanum issue-state ...` subprocess calls) — this spec needs no changes, and passing it unmodified is the main regression check that Step 04's trim didn't alter observable behavior.
- Steps 06's `GithubIssue`/`ArcanumSplitIssueCreateSubIssue` spec updates are a real testing-style change, not just a rename: today they inject a fully-faked `issueState` object (`{ write: spy }` / `{ appendJson: spy }`) at construction. Post-refactor there is no clean seam to fake at that granularity (the real `IssueStateService`'s file I/O lives several layers deeper), so those specs switch to asserting on the actual `.claude/state/issue-<id>.json` content written under the temp `repoPath` they already create — the same real-filesystem style `core/spec/lib/services/IssueStateService_spec.js` (née `IssueState_spec.js`) already uses. Do not introduce a new factory-injection constructor parameter just to preserve the old spy-based style — that would be a bespoke abstraction with a single caller, which this repo avoids.
- Out of scope (see the issue's Scope section for the full list): `arcanum/_lib/issue_state_shell.sh` and its parity test, `core/bin/arcanum`'s dispatch table, `PrOperations.js` itself, any repo-wide dispatch-pattern change, a lint rule enforcing the layering, and a CI-enforced coverage gate for the new files.
