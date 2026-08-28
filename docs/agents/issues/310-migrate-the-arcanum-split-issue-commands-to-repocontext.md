# Issue: Migrate the arcanum-split-issue commands to RepoContext

## Description

Sub-issue 2 of #308. Sub-issue 1 (`Dispatcher` + `core/lib/core/commands.js` +
the `takesRepoContext` flag) has already landed and is wired into
`core/bin/arcanum`. This issue migrates the four `arcanum-split-issue` commands
so they receive a `RepoContext` at construction time instead of taking
`repoPath` as a leading positional argument re-resolved per method call.

Commands in scope, all dispatched from `core/bin/arcanum`:

- `arcanum-split-issue-create-sub-issue` → `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`
- `arcanum-split-issue-create-sub-issue-file` → `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js`
- `arcanum-split-issue-finish` → `core/lib/commands/ArcanumSplitIssueFinish.js`
- `arcanum-split-issue-push-sub-issues` → `core/lib/commands/ArcanumSplitIssuePushSubIssues.js`

## Problem

Each command takes `repoPath` as a leading positional CLI argument and
re-derives context from it per call. Consequences:

- Every command is coupled to argv position (`args[0]` is `repoPath` by
  convention) and re-builds whatever context it needs on each invocation.
- `ArcanumSplitIssueCreateSubIssue` builds its **own** throwaway
  `new RepoContext({ repoPath })` inside a private `_issueStateService(repoPath)`
  helper purely to satisfy `IssueStateService`'s `context` param.
- Each constructor carries a deps key literally named `repoPath` that actually
  holds a `RepoPath` **validator** instance — confusing next to the `repoPath`
  string.

Sub-issue 1 already established the mechanism to fix this (`takesRepoContext`);
this issue applies it to the first command family.

## Expected Behavior

Internal-plumbing change only — **no observable behavior change**:

- The external CLI contract is unchanged: `core/bin/arcanum <cmd> <repoPath>
  <args…>` still works exactly as before (the `Dispatcher` consumes `args[0]` to
  build the `RepoContext` and strips it from the method args).
- The four `core/spec/bin/arcanumSplitIssue*Parity_spec.js` files must pass
  **unmodified** — byte-identical stdout, exit code, and stderr vs. the shell
  implementations. That is the acceptance gate.
- No `docs/agents/issues/` skill `.md` / `.sh` call-site changes; no
  `arcanum/_lib/migration-status.json` change (all four are already `true`).

## Solution

### Changes per command

- Set `takesRepoContext: true` on the entry in `core/lib/core/commands.js`.
- Change the constructor to `constructor(repoContext, { ...deps } = {})` (see
  "Constructor shape").
- Reach `repoPath` through `repoContext.repoPath` instead of the leading
  positional argument. (None of the four read config, so
  `repoContext.configChain` / `repoContext.readConfig(...)` do not come into
  play.)
- Drop the leading `repoPath` parameter from the entry method's signature; the
  `Dispatcher` strips it from `args` when the flag is set.
- Feed `this._repoContext.repoPath` to any collaborator that still takes
  `repoPath` per call.

### Constructor shape

The `Dispatcher` contract from sub-issue 1 is fixed: `dispatcher.js` does
`new ModuleClass(this.repoContext)` — a single positional argument — and
`DispatchFixtureRepoContext` matches it. So `repoContext` **must** be the
leading positional parameter; it cannot be folded into an options bag.

All four commands keep a deps object after migration (fs functions, the
`RepoPath` validator, the `SpawnIssue` / `SafeBranch` / `createSubIssue`
collaborators — all still injected for tests). Uniform shape:

```js
constructor(repoContext, { readFile = /* … */, writeFile = /* … */ } = {})
```

- `repoContext` — required positional, **no default**. The `Dispatcher` always
  supplies it; `ArcanumSplitIssuePushSubIssues` forwards its own `_repoContext`
  down when constructing `ArcanumSplitIssueCreateSubIssue`.
- The second argument defaults to `{}` so production `new Foo(repoContext)`
  keeps working.
- Stored as `this._repoContext` (private, matching the `this._<collaborator>`
  convention in these classes; the public `this.repoContext` in
  `DispatchFixtureRepoContext` is throwaway flag scaffolding, not a precedent).

**Naming cleanup:** rename the deps key `repoPath` (a `RepoPath` validator
instance) to `repoPathValidator` in all four constructors.

**Rule for #308 sub-issues 3–5:** always `constructor(repoContext, { ...deps }
= {})`, even if a class's deps object is momentarily empty — one pattern for
the rest of the sweep to copy.

**`ArcanumSplitIssueCreateSubIssue`'s final deps list** after this issue:
`spawnIssue`, `readFile`, `writeFile`, `mkdtemp`, `rm`, `repoPathValidator`
(the five `IssueStateService` knobs and the `_issueStateService` helper are
deleted — see "Issue-state access").

### Issue-state access

`ArcanumSplitIssueCreateSubIssue` needs `IssueStateService#appendJson` (to
track each new sub-issue id under the `sub-issues` field). Today it reaches it
via a private `_issueStateService(repoPath)` helper that builds its own
throwaway `new RepoContext({ repoPath })` and forwards five knobs (`lock`,
`jsonParser`, `jsonValueFormatter`, `jsonReader`, `issueStatePaths`) the spec
never overrides.

`RepoContext` already builds `this._issueStateService = new IssueStateService({
context: this })` internally but only exposes the **read** side, via
`getIssueState(id, key)` → `.get()` (the verb-passthrough style `PrOperations`
consumes). There is no write-side passthrough yet.

**Decision — add one write-side passthrough to `RepoContext`:**

```js
// core/lib/context/RepoContext.js — mirrors getIssueState
async appendIssueState(id, field, jsonValue) {
  return this._issueStateService.appendJson(id, field, jsonValue);
}
```

The migrated command then does:

```js
await this._repoContext.appendIssueState(issueId, SUB_ISSUES_FIELD, JSON.stringify(newId));
```

- `_issueStateService(repoPath)` helper deleted; the five knobs leave the
  constructor.
- Consistent with the `getIssueState` precedent; one `IssueStateService`
  instance (`RepoContext`'s own), no parallel build.
- Deliberately minimal: **one** method, limited to `appendJson`. Alternatives
  (a `get issueStateService()` getter; the command building its own service off
  the injected context) were rejected — leakier / defeats the "receive
  collaborators once" goal respectively. #308 sub-issue 5 (migrating
  `GithubIssue` and `IssueState`) decides whether to keep adding per-verb
  passthroughs or expose the service object.

### `repoPath` validation

Each command performs two independent `repoPath` checks, in this order;
**neither `Dispatcher` nor `RepoContext` performs either**, so both stay in
every command:

1. **Presence guard → `USAGE`**, runs first. The `repoPath` term now reads
   `this._repoContext.repoPath`; remaining positional args stay checked as
   method params. The `USAGE` string keeps its `<repo_path>` token.
2. **`RepoPath#validate`** (dir-exists + is-git-repo, mirrors the shell
   scripts' `repo_path_enter`), runs second, on `this._repoContext.repoPath`.

```js
async run(issueId, subIssueFile) {
  if (!this._repoContext.repoPath || !issueId || !subIssueFile) {
    throw new Error(USAGE);
  }

  await this._repoPathValidator.validate(this._repoContext.repoPath);
  // …
}
```

The renamed `repoPathValidator` dep therefore **survives in all four
constructors** — it is the only thing doing the dir/git-repo check, and the
byte-identical shell-parity contract requires it.

Hoisting the guard + `RepoPath#validate` into `Dispatcher` / `RepoContext` and
dropping the per-command `repoPathValidator` dep is **out of scope here** — it
changes error timing/messages uniformly across every command and needs one
coordinated shell-parity re-verification pass. Folded into #308 sub-issue 6.

### Cross-command wiring

`ArcanumSplitIssuePushSubIssues` is the only one of the four that calls another
of the four: it constructs `ArcanumSplitIssueCreateSubIssue` and invokes its
`run` per matched file. Both migrate together here. `repoContext` is
`ArcanumSplitIssuePushSubIssues`'s own first positional argument, in scope for
the second-arg defaults, so it forwards straight down:

```js
constructor(repoContext, {
  repoPathValidator = new RepoPath(),
  createSubIssue = new ArcanumSplitIssueCreateSubIssue(repoContext),
  readdir: readdirFn = readdir
} = {}) {
  this._repoContext = repoContext;
  // …
}
```

In `run(issueId)`, the per-file call drops the leading `repoPath`:

```js
output = await this._createSubIssue.run(issueId, file);   // was .run(repoPath, issueId, file)
```

Unchanged: `push`'s own presence guard + `repoPathValidator.validate` (and
`ArcanumSplitIssueCreateSubIssue.run` re-validating per file — the double
validation already exists today and mirrors the shell); the
`…STATUS=ok\nID=<id>\n` output format `push` parses via
`_extractField(output, 'ID')`; the `<file>:<newId>` CSV; the `DispatchFailure`
catch/re-throw; a default-constructed inner instance still getting its own real
`SpawnIssue`/fs defaults.

### Collaborators that still take `repoPath` per call

Three of the four feed `repoPath` to collaborators that migrate **later**
(`SpawnIssue` → #308 sub-issue 4; `SafeBranch` → #308 sub-issue 5). Per #308,
sub-issues 2–5 are independent, so this issue only passes
`this._repoContext.repoPath` into their unchanged signatures:

- **`ArcanumSplitIssueCreateSubIssue`** — `this._spawnIssue.run(repoPath,
  issueId, title, tmpBodyFile, AS_SUBISSUE_FLAG)` gets `repoPath =
  this._repoContext.repoPath`. The `spawnIssue` dep stays `new SpawnIssue()`;
  it already builds its own transient per-call `RepoContext` from the
  `repoPath` it receives — redundant but transient until sub-issue 4.
- **`ArcanumSplitIssueFinish`** — `this._repoContext.repoPath` in both the
  `path.join(repoPath, 'arcanum-split-issue', 'scripts', 'github.sh')` path and
  the `['mark-split', repoPath, issueId]` args of the shellout;
  `this._safeBranch.checkout(this._repoContext.repoPath)`. The `safeBranch` dep
  stays `new SafeBranch()`.
- **`ArcanumSplitIssueCreateSubIssueFile`** — no `repoPath`-taking
  collaborators; only `path.resolve(this._repoContext.repoPath, …)` plus its
  own fs deps.

Private helpers (`_spawn`, `_deleteWorkingFiles`, …) currently thread
`repoPath` as a parameter — implementer's choice whether to keep threading it
or read `this._repoContext.repoPath` directly; prefer reading from the instance
to shrink the private signatures.

### Call sites

The `arcanum-split-issue` skill's `steps/*.md` and `scripts/*.sh` invoke these
entrypoints as `engine_dispatch "$REPO_PATH" <command> … -- "$@"`, i.e.
`core/bin/arcanum <command> <repoPath> "$@"`. Keep them passing `repoPath` as
the leading positional argument — the `Dispatcher` consumes it. No skill-side
change; just verify each call site still lines up after the parameter shift.

### Testing strategy

**`RepoContext` test double, per command:**

| Command | Calls on `repoContext` | Double |
| --- | --- | --- |
| `ArcanumSplitIssueCreateSubIssueFile` | `.repoPath` only | plain `{ repoPath }` literal |
| `ArcanumSplitIssueFinish` | `.repoPath` only (`safeBranch` is an injected spy) | plain `{ repoPath }` literal |
| `ArcanumSplitIssuePushSubIssues` | `.repoPath` only (`createSubIssue` injected as a fake) | plain `{ repoPath }` literal |
| `ArcanumSplitIssueCreateSubIssue` | `.repoPath` **+ `.appendIssueState(...)`** | real `new RepoContext({ repoPath: <createTempDir()> })` |

`ArcanumSplitIssueCreateSubIssue` uses a real `RepoContext` so its existing
on-disk `.claude/state/issue-<id>.json` assertions stay verbatim and the new
`appendIssueState` → `appendJson` chain is exercised end to end (mirrors
`core/spec/lib/services/IssueStateService_spec.js`). The other three invoke no
methods on the context, so a plain literal suffices;
`createRepoContextMock()`'s 5 collaborator spies would be overkill.

**Test tasks:**

- Update `core/spec/lib/commands/ArcanumSplitIssue*_spec.js` for each command:
  construct with the double above instead of threading `repoPath` to the
  method; shift collaborator spy-call assertions by one argument; rename the
  `repoPath` dep key to `repoPathValidator`. **No expected-output / stdout line
  changes** — the migration is output-neutral.
- Add `appendJson: jasmine.createSpy()` to `createRepoContextMock`'s
  `issueStateService` mock in
  `core/spec/support/factories/repoContextFactory.js`.
- Add a `RepoContext#appendIssueState` unit test in
  `core/spec/lib/context/RepoContext_spec.js` alongside the `getIssueState` one.
- Leave the four `core/spec/bin/arcanumSplitIssue*Parity_spec.js` files
  unchanged — their passing is the backward-compat gate.
- Add/adjust a `Dispatcher`-level assertion that these four entries now take
  the flag path, and update `core/spec/lib/core/commands_spec.js`'s "only sets
  `takesRepoContext` on the `dispatch-fixture-repo-context` test entry"
  assertion to expect these four as well.

### Must not drift (shell-parity)

- **Error ordering** — presence guard (`USAGE`) before `validate`. The "missing
  `<repo_path>`" parity case asserts `shell.stdout === ''` + non-zero exit, so
  native must throw before any stdout.
- **Error routing** — `USAGE`/`validate` → stderr with the `arcanum: ` prefix;
  `DispatchFailure` → stdout + exit 1. Owned by `core/bin/arcanum` +
  `Dispatcher`, untouched here.
- **`SpawnIssue` interaction** (create-sub-issue's retry-exhausted parity
  case) — still `new SpawnIssue()` + `.run(repoPath, …)` until #308 sub-issue 4.

### Migration / ownership — N/A

- **Repo migration script?** No — internal `core/lib` refactor, no config-file
  shape change, nothing under `arcanum/migrations/repos/`.
- **New root-level folder?** No — all changes land under existing `core/lib/`
  and `core/spec/`.
- **Script-driven interaction?** No — dispatched `core/bin/arcanum`
  entrypoints; no skill prompts or multi-script interactive flows.

### Out of scope

- Other command families — #308 sub-issues 3–5.
- Removing the `takesRepoContext` flag / `commandArgs()` branch, and
  centralizing `repoPath` presence + validation into `Dispatcher`/`RepoContext`
  — #308 sub-issue 6.
- Migrating `SpawnIssue` (#308 sub-issue 4) and `SafeBranch` (#308 sub-issue 5)
  to constructor injection — this issue only feeds them
  `this._repoContext.repoPath`.
- Extending `RepoContext`'s state API beyond the single `appendIssueState`
  passthrough — #308 sub-issue 5.

## Benefits

- One injection seam per command instead of per-call context re-derivation;
  context is established once at construction.
- Removes `ArcanumSplitIssueCreateSubIssue`'s parallel throwaway `RepoContext`
  and five unused test knobs.
- Clears up the `repoPath` (string) vs `repoPathValidator` (`RepoPath`) naming
  collision.
- Establishes the exact constructor pattern the remaining #308 sub-issues
  (3–5) copy, and moves the ~16-command sweep one command family closer to
  dropping the `takesRepoContext` flag entirely.
