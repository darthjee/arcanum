# Node Plan: Cleanup: remove the dispatch-fixture-repo-context scaffold and stale takesRepoContext references

Main plan: [plan.md](plan.md)

## Overview

Delete the `dispatch-fixture-repo-context` test-only command and everything that
references it, then move its "the `context: 'repo'` path works end to end through
the real registry" coverage onto a real `context: 'repo'` command (`spawn-issue`),
and reword the stale `takesRepoContext` comments left in `core/spec`. No
production code path changes — `Dispatcher`, `commands.js`'s real entries, and
`DispatchFixture` (the non-repo fixture) are all untouched.

## Context

- `core/lib/core/commands.js` registers `dispatch-fixture-repo-context`
  (`context: 'repo'`, `log: false`, module `commands/DispatchFixtureRepoContext.js`)
  behind a 4-line `// dispatch-fixture-repo-context is test-only: …` /
  `// Removed together with the fixture in #314.` comment (lines ~144–152).
- `core/lib/commands/DispatchFixtureRepoContext.js` is a ~32-line echo module:
  `constructor(repoContext)` stores `this.repoContext`; `run(...args)` returns
  `` `dispatch-fixture: repoPath=${this.repoContext.repoPath} args=${args.join(',')}\n` ``.
  Its docblock references "`takesRepoContext`" and "Removed together with the
  flag in #308 sub-issue 6".
- `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js` covers that module
  directly.
- `core/spec/lib/core/dispatcher_spec.js` drives the fixture in two `describe`
  blocks:
  - `context: 'repo' path (dispatch-fixture-repo-context)` (lines ~51–72) — three
    `it`s: RepoContext built from `args[0]`, leading arg stripped from
    `commandArgs()`, and an end-to-end `dispatch()` string assertion.
  - `repoContext getter` (lines ~99–111) — two `it`s (`lazy`, `memoized`) that
    only need *any* `context: 'repo'` command name.
- `core/spec/lib/core/commands_spec.js` — the `it('sets context: 'repo' on …
  and the test fixture')` block (lines ~12–43) asserts the full ordered
  `withRepoContext` list, which includes `'dispatch-fixture-repo-context'`
  (line ~33).
- `core/spec/lib/commands/SpawnIssue_spec.js` — the `buildContext` docblock
  (line ~35) says it "mirrors … the `takesRepoContext` sibling specs".
- Full-repo grep confirms these are the only live `takesRepoContext` references
  (`core/coverage/**` is generated and ignored; the issue file itself is
  expected). `DispatchFixture.js` does **not** reference the repo-context sibling
  and stays as-is.

## Implementation Steps

### Step 1 — Remove the `dispatch-fixture-repo-context` fixture and its registry entry

- **`core/lib/core/commands.js`** — delete the `dispatch-fixture-repo-context`
  entry object and its preceding comment block (`// dispatch-fixture-repo-context
  is test-only: …` through `// Removed together with the fixture in #314.`).
  Leave the `dispatch-fixture` and `dispatch-fixture-crash` entries and their
  comment untouched. The top-of-file `@property {'repo'|'claude'|'none'}
  [context]` JSDoc does not name the fixture, so it needs no change.
- **`core/lib/commands/DispatchFixtureRepoContext.js`** — delete the file.
- **`core/spec/lib/commands/DispatchFixtureRepoContext_spec.js`** — delete the
  file.

### Step 2 — Re-anchor and clean up the affected specs, then sweep

- **`core/spec/lib/core/dispatcher_spec.js`**
  - Rename the `context: 'repo' path (dispatch-fixture-repo-context)` describe to
    `context: 'repo' path (spawn-issue)` and point its `beforeEach` at
    `new Dispatcher('spawn-issue', ['/fake/repo', 'a', 'b'])`. `spawn-issue` is
    `context: 'repo'` and its module constructs without side effects
    (`new SpawnIssue(repoContext)` only assigns fields), so
    `await dispatcher.commandInstance()` is safe in a unit test.
  - Keep two assertions, reworked to not depend on a fixture-only public field:
    - construction: `const instance = await dispatcher.commandInstance();`
      then `expect(instance.constructor.name).toEqual('SpawnIssue');`,
      `expect(dispatcher.repoContext).toBeInstanceOf(RepoContext);`,
      `expect(dispatcher.repoContext.repoPath).toEqual('/fake/repo');`
      (`commandInstance()` triggers the memoized `dispatcher.repoContext`
      getter, so assert on the dispatcher's own context rather than reaching
      into `instance._repoContext`).
    - `commandArgs()`: `expect(dispatcher.commandArgs()).toEqual(['a', 'b']);`
      (unchanged).
  - Delete the third `it` (`reflects the stripped args and repoPath in the
    dispatch() result`) — a real `context: 'repo'` command can't have its
    `dispatch()` result asserted without running its I/O. The two behaviours it
    bundled (context from `args[0]`, leading arg stripped) are each still
    asserted above.
  - In the `repoContext getter` describe (lazy / memoized), swap both
    `new Dispatcher('dispatch-fixture-repo-context', ['/fake/repo'])` calls to
    `new Dispatcher('spawn-issue', ['/fake/repo'])`. Assertions are unchanged.
  - Leave the `context: 'none'` and `context: 'claude'` describes, the
    `InvocationLog recording` describe, and the `unknown command` describe
    untouched — all three context paths remain covered.
- **`core/spec/lib/core/commands_spec.js`**
  - Remove `'dispatch-fixture-repo-context'` from the `withRepoContext` expected
    array.
  - Reword the `it('sets context: 'repo' on the migrated … entries and the test
    fixture')` description to drop "and the test fixture".
- **`core/spec/lib/commands/SpawnIssue_spec.js`**
  - Reword the `buildContext` docblock line that says it "mirrors …
    `AutoFixAllWaitCi_spec.js`'s `newWaitCi` / the `takesRepoContext` sibling
    specs" — replace "`takesRepoContext` sibling specs" with the current
    framing (e.g. "the other `context: 'repo'` command specs"). No code change.
- **Final sweep** — `grep -rn "takesRepoContext" core/lib core/spec` and
  `grep -rn "sub-issue 6\|migration scaffold\|Removed .* in #314" core/lib
  core/spec` must come back clean (ignoring `core/coverage/**`). Fix any
  straggler by rewording, not by re-introducing the term.

## Files to Change

- `core/lib/core/commands.js` — delete the `dispatch-fixture-repo-context` entry
  and its comment block.
- `core/lib/commands/DispatchFixtureRepoContext.js` — **delete**.
- `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js` — **delete**.
- `core/spec/lib/core/dispatcher_spec.js` — re-anchor the `context: 'repo'` and
  `repoContext getter` describes onto `spawn-issue`; drop the end-to-end
  `dispatch()` `it`.
- `core/spec/lib/core/commands_spec.js` — drop `'dispatch-fixture-repo-context'`
  from the `withRepoContext` list; reword the `it` description.
- `core/spec/lib/commands/SpawnIssue_spec.js` — reword the stale
  `takesRepoContext` comment in the `buildContext` docblock.

## CI Checks

- `core`: `yarn test` (CI job: `test`) — run locally via `make core-test`.
- `core`: `yarn lint` (CI job: `checks`) — run locally via `make core-lint`.

## Notes

- Behaviour-neutral and shell-parity-neutral: `dispatch-fixture-repo-context`
  is `log: false` and is not invoked from any `arcanum/_lib/*.sh` or skill
  `.md`, so no `*_shell.sh` counterpart or parity check is affected.
- `repoPath` validation centralization (hoisting `RepoPath#validate` into
  `Dispatcher` / `RepoContext`, dropping the per-command `repoPathValidator`
  dep) is **not** part of this issue — it is tracked as #331. `SpawnIssue_spec`'s
  `stubDeps` keeps its `repoPathValidator` stub; only the prose comment changes
  here.
- If a lighter `context: 'repo'` command is preferred over `spawn-issue` for the
  re-anchor (e.g. `list-agents`, `issue-state`), any of them works — they all
  construct without side effects. `spawn-issue` is chosen because the issue text
  names it and it is the canonical `context: 'repo'` entry in the `commands.js`
  JSDoc.
