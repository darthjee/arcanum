# Issue: Refactor: Extract IssueStateService to fix command→service layer violation

## Description

Extract a new `IssueStateService` (plus 4 supporting utility classes) out of the `IssueState` command class, so that `RepoContext` and (transitively) `PrOperations` stop depending on a CLI entrypoint class. After this refactor, `IssueState` (command) keeps only dispatch logic (`run`), and the state-file CRUD moves to `IssueStateService` (a new `core/lib/services/` layer).

## Problem

`RepoContext` (core/lib/context/) and `PrOperations` (core/lib/utils/github/) currently reference `IssueState` (core/lib/commands/), which is a command — an entrypoint class. Library and context layers should not depend on commands; the dependency direction should be commands → services → utils.

This creates a layering violation:

```
PrOperations (utils/github) → RepoContext (context) → IssueState (commands)
```

### Alternative solutions considered

- **Minimal fix (move CRUD to `IssueStateService` only, keep `_parseJson`/`_formatValue`/`_read`/`_paths` as its own private methods).** Would fully resolve the layering violation with a smaller diff. Rejected in favor of the full extraction described in Solution below, to match this repo's recent precedent (the `PrOperations` refactor chain, #284/#288/#289/#292/#294/#295) of single-responsibility, individually-testable classes — each concern (JSON parsing, jq-`-r`-style formatting, safe reading, path resolution) becomes independently unit-tested and reusable, consistent with how that chain broke `PrOperations` itself apart.
- **Dependency inversion / duck-typed port.** Keep `IssueState` where it is; have `RepoContext` depend on an untyped "port" shape instead of importing the concrete command class. Rejected: this codebase has no interface/type system, so the "port" would be an unenforced convention, and it doesn't address the underlying smell — CRUD logic would still live inside a class named and shaped around CLI dispatch (`USAGE_MESSAGE`, `run(repoPath, subcommand, ...)`).
- **Loosen the layering rule instead of the code**, on the grounds that command→command dependencies already exist elsewhere (`GithubIssue`→`IssueState`, `ArcanumSplitIssueCreateSubIssue`→`IssueState`). Rejected: those are peer command→command dependencies (both are CLI entrypoints); `RepoContext`/`PrOperations` sit below the entrypoint layer, and pulling in a command class there risks entrypoint concerns leaking downward, even where today's specific methods happen to be clean.

## Expected Behavior

Purely internal refactor — every observable behavior stays byte-identical: the `issue-state` CLI's stdout/exit codes, `GithubIssue#fetch`'s state-file writes, `ArcanumSplitIssueCreateSubIssue`'s sub-issue linking, and `RepoContext#getIssueState`'s resolved values are all unchanged. Only class boundaries and file locations move.

### Acceptance Criteria

- [ ] `IssueStateService` implements all CRUD operations.
- [ ] No file in `core/lib/utils/`, `core/lib/context/`, or `core/lib/services/` imports from `core/lib/commands/`.
- [ ] Existing `IssueState` specs pass with byte-identical behavior.
- [ ] `GithubIssue` and `ArcanumSplitIssueCreateSubIssue` specs pass with byte-identical behavior after switching to the per-call `IssueStateService` builder.
- [ ] New extracted utility classes have 100% unit test coverage.
- [ ] `docs/agents/architecture/script-engine.md` documents the `commands/context/services/utils` layering and dependency direction.

## Solution

### IssueState — core/lib/commands/IssueState.js

Keep only:

- `run(repoPath, subcommand, id, field, value)` — dispatch + `repoPath` validation (signature order unchanged from today)
- `USAGE_MESSAGE` constant
- Constructor keeps its own `RepoPath` validator (`this._repoPath`, as today) plus the `IssueStateService`'s own injectable collaborators (`lock`, `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths`) — not a ready `IssueStateService` instance
- A private `_issueStateService(repoPath)` helper: builds a per-call `RepoContext({ repoPath })` and `new IssueStateService({ context, lock, jsonParser, jsonValueFormatter, jsonReader, issueStatePaths })`, then `run` dispatches to it

Extract to new classes:

- `get`, `set`, `setJson`, `appendJson`, `write`, `_mutate`, `_corrupt`, `_writeRaw` → `IssueStateService`
- `_parseJson` → `JsonParser` (core/lib/utils/json/JsonParser.js)
- `_formatValue` → `JsonValueFormatter` (core/lib/utils/json/JsonValueFormatter.js)
- `_read` → `JsonReader` (core/lib/utils/json/JsonReader.js)
- `_paths` → `IssueStatePaths` (core/lib/utils/file/IssueStatePaths.js — not `IssueFilePaths`/`utils/json/`: it only resolves `stateDir`/`stateFile`/`lockFile` paths, not JSON, and the original name would collide with the unrelated `utils/file/IssueFile.js`, which handles docs-issue markdown file lookup)

### File locations

- `JsonParser`, `JsonValueFormatter`, `JsonReader` go in a new `core/lib/utils/json/` folder — framed as generic JSON operations (parse-or-fail, jq-`-r`-style formatting, read-or-empty-on-error), not state-file-specific, even though `IssueStateService` is currently their only caller.
- `IssueStatePaths` goes in the existing `core/lib/utils/file/` folder, alongside `RepoPath.js` — it's a path-resolution concern, not a JSON one.

### `repoPath`/context wiring

`core/bin/arcanum`'s dispatcher instantiates every command with zero constructor args (`new ModuleClass()`) and passes `repoPath` only as a per-call method argument (`core/bin/arcanum:116`) — no command has `repoPath` available at construction time. Meanwhile `IssueStateService` (per its constructor below) is bound to a `RepoContext` fixed at construction, matching the newer context-bound convention `PrOperations` already uses.

The bridge between these two is an existing pattern, not a new one: `AutoFixAllGithub` already does exactly this in `_prOperations(repoPath)` (core/lib/commands/AutoFixAllGithub.js:128) — its shared, stateless collaborators (`origin`, `githubToken`) are injected once at construction, and each method builds a **fresh, per-call** `RepoContext`/`PrOperations` from them via a small private helper. Tests inject fakes for the shared collaborators at construction (see `AutoFixAllGithub_spec.js:95,176`, injecting a fake `issueState`), not for the per-call context/service object itself.

`IssueState.run`, `GithubIssue.fetch`, and `ArcanumSplitIssueCreateSubIssue`'s sub-issue-linking method all follow the same shape: keep their existing shared collaborators at construction, add a private `_issueStateService(repoPath)` helper mirroring `_prOperations`, and call through it instead of a directly-injected `IssueState`/`IssueStateService` instance. No change to `core/bin/arcanum`'s dispatch pattern is needed or in scope.

### New: IssueStateService — core/lib/services/IssueStateService.js

Constructor:

- `context` (RepoContext — provides `repoPath`)
- `lock` (optional, defaults to `new Lock()`)
- `jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths` (optional injectables)

Methods:

- `get(id, field)`, `set(id, field, value)`, `setJson(id, field, jsonValue)`, `appendJson(id, field, jsonValue)`, `write(id, fields)`
- Internal skeleton: `_mutate`, `_corrupt`, `_writeRaw`

### RepoContext — core/lib/context/RepoContext.js

- Remove `import IssueState`
- Constructor's `issueState` dep becomes `issueStateService` (default `new IssueStateService({ context: this })` — needs the instance's own `repoPath`, so it's built after `this.repoPath` is assigned, not in the destructured defaults)
- `getIssueState(id, key)` delegates to `IssueStateService#get`

### Other command-layer callers of IssueState (in scope)

Both follow the same per-call builder shape described above:

- `GithubIssue.fetch` (core/lib/commands/GithubIssue.js) — replace its injected `issueState` with the shared collaborators `IssueStateService` needs, add a private `_issueStateService(repoPath)` helper, and change the `this._issueState.write(repoPath, id, {...})` call to `this._issueStateService(repoPath).write(id, {...})`.
- `ArcanumSplitIssueCreateSubIssue` (core/lib/commands/ArcanumSplitIssueCreateSubIssue.js) — same treatment for its `this._issueState.appendJson(repoPath, issueId, SUB_ISSUES_FIELD, ...)` call.

### New architectural layer: `core/lib/services/`

This is the first class under `core/lib/services/`. Document it in `docs/agents/architecture/script-engine.md`'s "The `core/` package layout" section, alongside the existing `commands/`/`context/`/`utils/` folders:

- `commands/` — CLI entrypoints, dispatched directly by `core/bin/arcanum`. May depend on `context/`, `services/`, and `utils/`.
- `context/` — per-call-site bundles of a `repoPath` plus its resolved collaborators (currently just `RepoContext`). May depend on `services/` and `utils/`.
- `services/` — stateful or I/O-owning logic that isn't a CLI entrypoint itself, shared by multiple commands/contexts (currently just `IssueStateService`). May depend on `utils/`.
- `utils/` — stateless or narrowly-scoped helpers with no knowledge of the CLI dispatch surface.

Dependency direction is one-way: `commands` → `context`/`services` → `utils`. Nothing under `context/`, `services/`, or `utils/` may import from `commands/`.

### Scope

**In scope:**

- `IssueState.js` trimmed to dispatch + `RepoPath` validation + a private `_issueStateService(repoPath)` builder (as above).
- New: `services/IssueStateService.js`, `utils/json/{JsonParser,JsonValueFormatter,JsonReader}.js`, `utils/file/IssueStatePaths.js`.
- `RepoContext.js`: `issueState` dep renamed `issueStateService`; `getIssueState(id, key)` calls `.get(id, key)` — 2-arg, no `repoPath`, since it's already bound into the service's `context`.
- `GithubIssue.js` and `ArcanumSplitIssueCreateSubIssue.js`: same per-call-builder treatment as `IssueState.js`.
- `script-engine.md`'s layering documentation.
- Test side: split `IssueState_spec.js` (dispatch-only tests remain; CRUD tests move to a new `IssueStateService_spec.js`), add specs for the 4 new extracted classes, update `core/spec/support/factories/repoContextFactory.js` (rename `issueState` → `issueStateService`, and drop `repoPath` from its `get` spy's signature — it's now `(id, field)`, not `(repoPath, id, field)`), and update the 2 spec files that currently fake the 3-arg shape: `PrOperations_spec.js`'s `issueStateValues` fake and `RepoContext_spec.js`.

**Explicitly out of scope:**

- `arcanum/_lib/issue_state_shell.sh` and its shell↔native parity test — unaffected; the `issue-state` CLI's stdout/exit-code contract doesn't change.
- `core/bin/arcanum`'s dispatch table entry — unchanged (`'issue-state'` still maps to `commands/IssueState.js`/`run`).
- `PrOperations.js` itself — no code changes; it only ever went through `context.getIssueState`, never imported `IssueState` directly. This issue's Problem-section diagram describes a *transitive* violation through `RepoContext`, not a direct one in `PrOperations`.
- Any repo-wide change to `core/bin/arcanum`'s zero-constructor-arg dispatch pattern.
- A lint rule enforcing the `commands`→`context`/`services`→`utils` dependency direction — stays convention + code review for now, matching how coverage thresholds are already "declared but not hard-enforced" repo-wide (per `script-engine.md`'s Testing conventions section). Revisit as a separate issue if this class of violation recurs.
- A CI-enforced coverage gate for the new files — the 100%-coverage acceptance criterion is achieved and verified in PR review, not wired into CI, consistent with the repo's current coverage-gate-off state.

## Benefits

- Restores `commands → context/services → utils` as a strictly one-way dependency graph, removing the last known violation of it.
- Each extracted concern (JSON parsing, jq-style formatting, safe reading, path resolution) becomes independently unit-tested and reusable, consistent with the recent `PrOperations` refactor chain.
- Establishes `core/lib/services/` as a documented architectural layer for future service classes.
