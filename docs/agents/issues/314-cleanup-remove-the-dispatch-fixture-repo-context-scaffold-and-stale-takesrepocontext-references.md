# Cleanup: remove the `dispatch-fixture-repo-context` scaffold and stale `takesRepoContext` references

## Scenario and problem

Final cleanup for #308 (sub-issue 6). The original plan for this sub-issue was to
drop the `takesRepoContext` boolean flag, make `repoContext` construction
unconditional, and document the exempt commands — **all of which #321 already
delivered** when it replaced the boolean with the `context: 'repo' | 'claude' |
'none'` enum in `core/lib/core/commands.js` / `core/lib/core/dispatcher.js`.

What #321 did **not** remove is the throwaway test scaffold that was always
earmarked to go "together with the flag": the `dispatch-fixture-repo-context`
registry entry, its module, and its spec, plus a handful of now-stale
`takesRepoContext` mentions left behind in comments. This issue is that final
teardown.

**Blocked by:** nothing — #308 sub-issues 2–5 and #321 are all merged.

## Changes

### `core/lib/core/commands.js`

- Delete the `dispatch-fixture-repo-context` registry entry and its preceding
  4-line comment (`// dispatch-fixture-repo-context is test-only: …`).

### `core/lib/commands/DispatchFixtureRepoContext.js`

- Delete the module. It exists solely to exercise the context-bound dispatch
  path end to end through the real registry; that path is now the settled design
  and is covered by real `context: 'repo'` commands.

### `core/spec/lib/commands/DispatchFixtureRepoContext_spec.js`

- Delete the spec.

### `core/spec/lib/core/dispatcher_spec.js`

- The `context: 'repo' path (dispatch-fixture-repo-context)` describe block and
  the `repoContext getter` block both drive the fixture. Re-anchor that coverage
  on a real `context: 'repo'` command (e.g. `spawn-issue`) so the enum's
  repo-context path stays exercised through the real `COMMANDS` registry:
  - `dispatcher.repoContext` is a `RepoContext` whose `repoPath === args[0]`.
  - `dispatcher.commandArgs()` strips the leading arg (`args.slice(1)`).
  - `(await dispatcher.commandInstance()).constructor.name` is the real command.
  - The fixture's end-to-end `dispatch()` string assertion
    (`dispatch-fixture: repoPath=… args=…`) has no equivalent on a real command
    without running it — drop it; the constituent behaviours above are each
    asserted directly.
  - Real commands store the context privately (`this._repoContext`), so assert
    on `dispatcher`'s own memoized `repoContext` rather than reaching into the
    command instance.

### `core/spec/lib/core/commands_spec.js`

- Remove `'dispatch-fixture-repo-context'` from the `withRepoContext` expected
  list (around line 33).

### Stale `takesRepoContext` references

- `core/spec/lib/commands/SpawnIssue_spec.js` — the `buildContext` docblock
  references "the `takesRepoContext` sibling specs"; reword to the current
  `context: 'repo'` framing.
- Grep the repo once more for `takesRepoContext`, `migration scaffold`,
  `Removed … in #314`, and `sub-issue 6` and reword/remove any remaining
  language that still frames the `context` enum as a temporary migration step.

## Out of scope

- **`repoPath` validation centralization** — hoisting the presence guard +
  `RepoPath#validate` into `Dispatcher` / `RepoContext` and dropping the
  per-command `repoPathValidator` dep (~28 references across 13 command files).
  #308 sub-issue 6's text folded this in, but it is a coordinated cross-command
  pass that deliberately changes error timing and messages and needs its own
  shell-parity re-verification. Tracked separately as **#331** (sub-issue of
  #308), not done here.
- **The `commandArgs()` `isContextBound()` ternary** — now permanent design, not
  a removal target: `context: 'none'` commands legitimately keep their full arg
  list.

## Tests

- `dispatcher_spec.js` still asserts all three context paths (`none` / `repo` /
  `claude`) through the real registry, with the `repo` path re-anchored on a
  real command as described above.
- `commands_spec.js` `withRepoContext` list matches the registry after the
  fixture entry is gone.
- Full `core/spec` suite green.
- No shell-parity impact: `dispatch-fixture-repo-context` is test-only
  (`log: false`), never invoked from any skill `.md`.
