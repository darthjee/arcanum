# Node Plan: Route auto-fix-all/scripts/github.sh through engine_dispatch (native counterparts unreachable)

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on scripter producing exactly what [plan.md](plan.md)'s "Shared contracts" lists:
- `auto-fix-all/scripts/github_shell.sh`, taking `<subcommand> <repo_path> [args]` with the unchanged shell behaviour;
- the real shim `auto-fix-all/scripts/github.sh`, dispatching each subcommand to `auto-fix-all-github-<subcommand>` with `HOME` forwarded;
- the 7 per-subcommand keys in `migration-status.json`;
- `wait_ci_and_merge_shell.sh` calling `github_shell.sh pr-merge` directly.

No `core/lib` or `commands.js` change: the 7 native commands already exist.

## Implementation Steps

### Step 1 — Point the parity specs' shell side at github_shell.sh

`core/spec/support/utils/runCommand.js` exports `SHELL_SCRIPT = auto-fix-all/scripts/github.sh`, which the `autoFixAllGithubParity` specs use as "the shell side". Once `github.sh` is a shim, that would route through `engine_dispatch`. On a machine whose global `~/.claude/arcanum-config.json` says `engine.mode=native`, the parity specs would then quietly compare native against native. Repoint it to `auto-fix-all/scripts/github_shell.sh`, update its JSDoc to mirror `AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT` ("run directly, never through the router, except by `engine_dispatch_spec.js`"), and update the header comments in `core/spec/bin/autoFixAllGithubParity/*_spec.js` that say "Runs auto-fix-all/scripts/github.sh …".

Also update the comment in `core/spec/bin/autoFixAllWaitCiAndMergeParity/ci_outcomes_spec.js` that says "`github.sh` hasn't been split into its own engine_dispatch shim yet…". Now `wait_ci_and_merge_shell.sh` calls `github_shell.sh pr-merge` directly, which gives the same guarantee for a different reason.

### Step 2 — Rewrite the auto-fix-all-github engine_dispatch routing spec

`core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` currently drives a throwaway shim with the whole-script key `auto-fix-all-github`, and asserts that native mode ends in `unknown command`. Rewrite it like `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`: use the shared example `itRoutesEngineDispatch` (`core/spec/support/sharedExamples/engineDispatchRouting.js`) against the **real** shim `auto-fix-all/scripts/github.sh`. Include:
- at least one network-free subcommand routed under `shell` and `native`, with assertions that prove which side ran. Reuse the fake-`gh` technique (`createFakeGhBin`, e.g. `authTokenAlwaysFails`) or a `gh`-free path such as `pr-number` with a cached `pr_id` in issue state.
- an "engine.mode unset → shell" case, with `CLAUDE_CONFIG_DIR` pointed at an empty directory, as in the sibling spec.
- an unknown subcommand → exit 1 with the usage message on stderr, and neither implementation's output.

Drop the "future shim… out of scope here" header note, and describe the real shim instead.

## Files to Change
- `core/spec/support/utils/runCommand.js` — `SHELL_SCRIPT` → `github_shell.sh`, plus its JSDoc.
- `core/spec/bin/autoFixAllGithubParity/*_spec.js` — header comments only (which script is the shell side).
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` — rewritten against the real shim.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/ci_outcomes_spec.js` — comment update only.

## CI Checks
- `core/`: `yarn test` (CI job: tests with coverage), `yarn lint` (CI job: lint). Locally via the root `Makefile`'s `core-*` targets or `cd core && yarn test && yarn lint`.

## Notes
- If a parity spec (not just its comments) turns out to depend on `github.sh` being the shell implementation, keep the fix inside `core/spec/`. Never work around it by changing the scripter-owned shim contract. Escalate to the architect if the contract itself looks wrong.
