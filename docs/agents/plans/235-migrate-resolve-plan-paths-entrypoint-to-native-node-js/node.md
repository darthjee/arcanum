# node Plan: Migrate resolve-plan-paths entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- `ResolvePlanPaths#run(repoPath, issuesFolder, plansFolder, id)` — 4 positional args, in this order, matching what `core/bin/arcanum`'s dispatcher forwards from the shim.
- Registry key `resolve-plan-paths` — add to `core/bin/arcanum`'s `COMMANDS` map: `'resolve-plan-paths': { module: 'ResolvePlanPaths.js', method: 'run' }`.
- Output: exact `ISSUE_FILE=`/`PLAN_DIR=`/`PLAN_FILE=`/`PLAN_EXISTS=` lines and the two `Error:` messages, byte-identical to the shell implementation (see plan.md's "Output contract"). No `Usage:` handling needed here — that's shim-only, owned by scripter.
- Reuse `core/lib/IssueFile.js`'s `IssueFile.findExisting(repoPath, issuesFolder, id)` for the issue-file lookup instead of reimplementing the glob.

## Implementation Steps

### Step 1 — Native implementation + routing

Add `core/lib/ResolvePlanPaths.js`. `run(repoPath, issuesFolder, plansFolder, id)`:
- Validate `id` is numeric (`^[0-9]+$`); throw `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.` otherwise — same message/throwing convention as `ResolveIdAndFile#run`.
- Call `IssueFile.findExisting(repoPath, issuesFolder, id)`; throw `Error: no issue file found for id <id>` when it returns null.
- Derive `PLAN_DIR` as `path.posix.join(plansFolder, baseName)` and `PLAN_FILE` as `path.posix.join(PLAN_DIR, 'plan.md')`, where `baseName` is the matched issue file's basename without `.md` — mirrors the shell's `basename "$ISSUE_FILE" .md`.
- Compute `PLAN_EXISTS` by checking (relative to `repoPath`) whether `PLAN_FILE` already exists on disk.
- `mkdir -p` (recursive, relative to `repoPath`) the resolved `PLAN_DIR` as the side effect, unconditionally on success — same as the shell.
- Return the four `KEY=value\n` lines in the shell's exact order.

Add the routing entry to `core/bin/arcanum`'s `COMMANDS` map.

## Files to Change

- `core/lib/ResolvePlanPaths.js` — new native implementation
- `core/bin/arcanum` — add `'resolve-plan-paths'` routing entry

### Step 2 — Tests

Add `core/spec/lib/ResolvePlanPaths_spec.js` (unit, direct against the class, `createTempDir`/`removeTempDir` fixture, style matching `ResolveIdAndFile_spec.js`): a matching-file happy path with `PLAN_EXISTS=false`, the same happy path with an existing `plan.md` for `PLAN_EXISTS=true`, a non-numeric id (rejected with the exact error message), and no matching issue file (rejected with the exact error message).

Add `core/spec/bin/resolvePlanPathsParity_spec.js` (parity, style matching `resolveIdAndFileParity_spec.js`): runs the renamed `arcanum/_lib/resolve_plan_paths_shell.sh` directly (never through the new shim, to avoid circularity) against `core/bin/arcanum resolve-plan-paths` with a real `git init`'d temp repo and identical inputs, asserting identical stdout and exit code for the success cases, plus matching stderr content (native checked with `.toContain()`, since `core/bin/arcanum`'s router prefixes uncaught errors with `arcanum: `) for the two error cases.

## Files to Change

- `core/spec/lib/ResolvePlanPaths_spec.js` — new unit spec
- `core/spec/bin/resolvePlanPathsParity_spec.js` — new parity spec

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Depends on scripter's `arcanum/_lib/resolve_plan_paths_shell.sh` rename existing before the parity spec can run against it — coordinate merge order, or land scripter's rename first.
