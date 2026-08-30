# Issue: Dispatcher-hoisted repoPath validation: decide the absent-leading-arg behaviour

## Description

Carved out of #331 (centralize `repoPath` validation into `Dispatcher`/`RepoContext`).

#331 has since merged (`88aec89`). It added `RepoContext#validate()` (backed by a
`RepoPath` collaborator) and hoisted the call into `Dispatcher.dispatch()` — run
once on the `context: 'repo'` path, after `InvocationLog#record` and before the
command module is `import()`ed, unless the registry entry sets
`validateRepoPath: false` (only `github-issue-info`, plus the five queue
file-only subcommands, are exempt).

#331 shipped the absent-leading-arg behaviour **provisionally**, with an extra
`&& this.args[0]` clause on the dispatch guard and a comment deferring the call
to this issue:

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

This issue is that decision. **Resolution: drop the `&& this.args[0]` clause** —
always run `RepoContext#validate()` on the `context: 'repo'` path (subject only
to `validateRepoPath`).

## Problem

The `&& this.args[0]` clause is not compensating for any real caller. Every
skill script and every `arcanum/_lib/*.sh` / `auto-fix-all/scripts/*.sh` wrapper
passes `<repo_path>` as `$1` and enforces its own
`[[ -n "$REPO_PATH" ]] || { echo "Usage: …"; exit 1; }` (or `${1:?…}`)
**before** it ever calls `engine_dispatch`. A truly argument-less invocation
therefore never reaches the native dispatcher through any supported path — it is
only reachable by calling `core/bin/arcanum <command>` directly with no
positionals (a bug or a manual test).

The clause's only effect is to pick which message that malformed invocation
prints:

- **With the clause** — `validate()` is skipped and control falls through to
  the command module's own `throw new Error(USAGE)`.
- **Without the clause** — `Dispatcher` calls `validate()` first, which throws
  `Error: repo_path is required` (surfaced by `core/bin/arcanum` as
  `arcanum: Error: repo_path is required`).

Two facts make dropping the clause the better call:

1. **Six `context: 'repo'` commands have no `!repoPath` guard of their own** —
   `github-issue-create`, `checkout-safe-branch`, `list-agents`,
   `resolve-and-fetch`, `resolve-id-and-file`, `resolve-plan-paths`. Today, a
   bare direct call to any of these skips `validate()` and then crashes with a
   raw `TypeError` (undefined path passed to `path.join` / `git -C`), or
   `core/bin/arcanum`'s generic catch prefixing that. Dropping the clause gives
   all six a clean `Error: repo_path is required` instead.
2. **No parity spec exercises the zero-arg case.** Every `*Parity_spec.js`
   tests a *present-but-non-directory* or *non-git* `repoPath` (i.e. `args[0]`
   is set), which runs through `validate()` identically with or without the
   clause. The only unit spec that changes is `dispatcher_spec.js`'s
   "does NOT validate an absent leading arg" case.

## Solution

1. In `core/lib/core/dispatcher.js`, drop the `&& this.args[0]` clause and its
   comment. The guard becomes:

   ```js
   if (this.entry.context === 'repo' && this.entry.validateRepoPath !== false) {
     await this.repoContext.validate();
   }
   ```

2. Update the `dispatcher_spec.js` case (currently
   "does NOT validate an absent leading arg — … (see #333)") to assert the
   opposite: an absent leading arg on a `context: 'repo'` entry now makes
   `Dispatcher.dispatch()` reject with `Error: repo_path is required`, before
   the command module is imported.

3. Leave each command module's own `if (!repoPath || !x || …) throw USAGE`
   guard in place — it is still required for the other missing-argument
   permutations. The `!repoPath` sub-clause is now redundant-but-harmless
   (the dispatch check fires first on a bare call); no churn across the ~15
   modules to strip it.

4. Record the one-time intentional shell-vs-native divergence for the
   direct-`core/bin/arcanum`, zero-positional case as a short "known
   intentional divergences" note beside the parity-contract bullet in
   `docs/agents/architecture/script-engine.md`: the shell wrappers short-circuit
   with their own `Usage:` block before dispatch, so the native
   `Error: repo_path is required` is only observable on a direct dispatcher
   call that no wrapper can produce.

## Benefits

- One uniform malformed-invocation error (`Error: repo_path is required`) across
  every `context: 'repo'` command, instead of a mix of per-command `Usage:`
  strings, raw `TypeError`s, and dispatcher-catch prefixes.
- The six currently-crashing commands get a clean, intentional error message.
- `Dispatcher`'s guard loses a special case and reads as "validate every repo
  context unless explicitly opted out".
- `RepoPath#validate`'s `Error: repo_path is required` branch becomes a live,
  reachable CLI path rather than effectively dead code.

## Out of scope

- The validation hoist itself, the `validateRepoPath: false` exemptions, and the
  newly-strict `context: 'repo'` surfaces — all handled by #331.
- Any change to `RepoPath#validate`'s message strings or checks.
- Stripping the now-redundant `!repoPath` sub-clause from the per-command
  `USAGE` guards — deliberately left as-is to keep the diff small; can be a
  later cleanup if desired.
