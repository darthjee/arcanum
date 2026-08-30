# Node Plan: Dispatcher-hoisted repoPath validation: decide the absent-leading-arg behaviour

Main plan: [plan.md](plan.md)

## Overview

#331 hoisted `RepoContext#validate()` into `Dispatcher.dispatch()` for the
`context: 'repo'` path, but gated it behind an extra `&& this.args[0]` clause
with a comment deferring the keep/drop decision to this issue. The decision is
to **drop the clause**: always validate on the `context: 'repo'` path unless
the registry entry sets `validateRepoPath: false`.

Rationale (from the issue):

- No supported caller reaches the dispatcher without a `repoPath` — every
  skill script and every `arcanum/_lib/*.sh` / `auto-fix-all/scripts/*.sh`
  wrapper passes `<repo_path>` as `$1` and guards its emptiness (`[[ -n
  "$REPO_PATH" ]] || { echo "Usage: …"; exit 1; }` / `${1:?…}`) **before**
  calling `engine_dispatch`. A positional-less invocation is only reachable by
  calling `core/bin/arcanum <command>` directly (a bug or a manual test).
- Six `context: 'repo'` commands have no `!repoPath` guard of their own —
  `github-issue-create`, `checkout-safe-branch`, `list-agents`,
  `resolve-and-fetch`, `resolve-id-and-file`, `resolve-plan-paths`. Today a
  bare direct call to any of these skips `validate()` and then crashes with a
  raw `TypeError` (undefined path into `path.join` / `git -C`). Dropping the
  clause gives all six a clean `Error: repo_path is required`.
- No `*Parity_spec.js` exercises the zero-positional case — every one tests a
  *present-but-non-directory* or *non-git* `repoPath` (`args[0]` set), which
  runs through `validate()` identically either way. The only unit spec that
  changes is `core/spec/lib/core/dispatcher_spec.js`'s
  "does NOT validate an absent leading arg" case.

## Context

Current guard in `core/lib/core/dispatcher.js` `dispatch()`:

```js
if (
  this.entry.context === 'repo' &&
  this.entry.validateRepoPath !== false &&
  // The `&& this.args[0]` guard keeps shell parity for the
  // absent-leading-arg case (the command's own `USAGE` throw still
  // wins); whether to drop it is #333's call.
  this.args[0]
) {
  await this.repoContext.validate();
}
```

`RepoContext#validate()` delegates to `RepoPath#validate(this.repoPath)`, whose
first branch is `if (!repoPath) throw new Error('Error: repo_path is required')`
(`core/lib/utils/file/RepoPath.js`). `core/bin/arcanum`'s top-level `.catch`
prints a thrown `Error` as `arcanum: <message>` to stderr, exit 1
(see `docs/agents/architecture/script-engine.md` — "The output/exit-code
contract"). The `repoContext` getter builds `new RepoContext({ repoPath:
this.args[0] })` even when `args[0]` is `undefined`, so `validate()` is safe to
call unconditionally — it simply rejects with `Error: repo_path is required`.

The per-command `if (!repoPath || !x || …) throw USAGE` guards in the command
modules stay as-is: they are still needed for the other missing-argument
permutations, and the now-redundant `!repoPath` sub-clause is harmless (the
dispatch check fires first on a bare call). Stripping those sub-clauses is
explicitly out of scope.

## Implementation Steps

### Step 1 — Drop the `&& this.args[0]` clause and update its unit spec

In `core/lib/core/dispatcher.js`:

- Remove the `&& this.args[0]` line and the 3-line `//` comment above it from
  the `dispatch()` guard, leaving:

  ```js
  if (this.entry.context === 'repo' && this.entry.validateRepoPath !== false) {
    await this.repoContext.validate();
  }
  ```

- Update the `dispatch()` JSDoc: the phrase "the leading `repoPath` argument is
  validated" is still accurate; just drop any implication that an absent
  leading arg is skipped. No other prose in the file references the clause.

In `core/spec/lib/core/dispatcher_spec.js`:

- Replace the `it('does NOT validate an absent leading arg — the command\'s own
  USAGE throw still wins (see #333)', …)` case (currently asserts
  `validate` is **not** called and the rejection matches `/^Usage: spawn-issue/`)
  with one asserting the new behaviour: for a `context: 'repo'` entry invoked
  with `args: []`, `dispatch()` rejects with `Error: repo_path is required`
  and the command module is never imported (`commandInstance` not called, in
  the style of the existing "record() before validate()" and
  "validateRepoPath: false" cases). Do not spy `validate` into a fake here —
  let the real `RepoContext#validate()` → `RepoPath#validate(undefined)` throw,
  so the assertion covers the actual message. Keep the `(see #333)` reference
  in the new `it(...)` description.
- Scan the rest of `dispatcher_spec.js` for any other case that constructs a
  `context: 'repo'` `Dispatcher` with an empty/`args[0]`-less array and relies
  on `validate()` being skipped; there is currently only the one, but confirm
  during editing.

### Step 2 — Record the one-time intentional parity divergence

In `docs/agents/architecture/script-engine.md`, under "## The output/exit-code
contract", add a short note (a sentence or two, or a parenthetical) after the
byte-identical-stdout paragraph: the native `context: 'repo'` path now throws
`Error: repo_path is required` for a positional-less
`core/bin/arcanum <command>` call, whereas the shell wrappers short-circuit
with their own per-script `Usage:` block before ever calling `engine_dispatch`.
This divergence is intentional and only observable on a direct dispatcher call
that no supported wrapper or skill can produce; every wrapper still guards an
empty `REPO_PATH` itself, so the engine-agnostic contract skills rely on is
unaffected.

## Files to Change

- `core/lib/core/dispatcher.js` — drop the `&& this.args[0]` clause and its
  comment from the `dispatch()` `context: 'repo'` guard; tidy the `dispatch()`
  JSDoc.
- `core/spec/lib/core/dispatcher_spec.js` — flip the "does NOT validate an
  absent leading arg" case to assert `dispatch()` now rejects with
  `Error: repo_path is required` before importing the command module.
- `docs/agents/architecture/script-engine.md` — add the "known intentional
  divergence" note under "The output/exit-code contract".

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- No `*Parity_spec.js` changes: every parity spec's `repoPath` failure case
  passes a present-but-invalid path, which validates identically with or
  without the clause. Confirm `yarn test` stays green — no parity spec should
  regress.
- `RepoPath#validate`'s `Error: repo_path is required` branch (already unit
  tested in `core/spec/lib/utils/file/RepoPath_spec.js`) becomes a live CLI
  path; no change to its message or `RepoPath`/`RepoContext` code is needed.
- Out of scope: stripping the redundant `!repoPath` sub-clause from the
  per-command `USAGE` guards (~15 modules) — left as a possible later cleanup.
