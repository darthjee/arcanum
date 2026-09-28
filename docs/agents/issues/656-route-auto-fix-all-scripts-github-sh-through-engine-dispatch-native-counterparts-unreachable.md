# Issue: Route auto-fix-all/scripts/github.sh through engine_dispatch (native counterparts unreachable)

## Description
`auto-fix-all/scripts/github.sh` is the only skill-called entrypoint that never goes through `arcanum/_lib/engine_dispatch.sh`. Its 7 subcommands (`pr-number`, `pr-state`, `pr-merge`, `cleanup-branch`, `has-shipit-label`, `add-tag`, `remove-tag`) always run bash, even with `engine.mode=native`. This blocks #655, which assumes every in-scope entrypoint has both a shell and a native implementation.

## Problem
- The native side is complete but unreachable: `core/lib/commands/auto-fix-all/AutoFixAllGithub.js`, the 7 `auto-fix-all-github-*` commands registered in `core/lib/core/commands.js`, and a parity spec per subcommand in `core/spec/bin/autoFixAllGithubParity/`.
- `github.sh` holds the full bash implementation directly and dispatches nothing. `auto-fix-all`'s markdown calls it about 20 times.
- `arcanum/_lib/migration-status.json` only has a whole-script placeholder, `"auto-fix-all-github": true` (added by #230). The shim split was explicitly deferred when the native side landed (#288/#290): `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` notes that "a future shim built against that single flag will need to map it to whichever specific `core/bin/arcanum` command each subcommand actually dispatches to — out of scope here". There are no per-subcommand keys, so even a correct shim would fall back to shell. The generated status doc therefore reports "Yes" for a command that can never run natively.
- `auto-fix-issue/scripts/github.sh` ends with a shell-only catch-all (`*) exec bash github_shell.sh "$@"`). It's dead code today (every subcommand is dispatched), but it would let a future subcommand quietly skip the native engine.

**Audit result (done while refining this issue):** every other non-dispatching `.sh` under `<skill>/scripts/` and `arcanum/_lib/` is a `*_shell.sh` implementation, a sourced `*_common.sh` or `_lib` helper (`lock.sh`, `tags.sh`, `origin.sh`, `config_chain.sh`, …, referenced from skill markdown only in prose, never invoked), a test script, `engine_dispatch.sh` itself, or a thin `exec` wrapper onto a dispatching `_lib` script. `auto-fix-all/scripts/github.sh` is the only gap.

## Expected Behavior
- With `engine.mode=native`, every `auto-fix-all/scripts/github.sh <subcommand>` call runs `core/bin/arcanum auto-fix-all-github-<subcommand>`. With `shell` (the default) or `docker`, it runs the existing bash code, with stdout and exit code unchanged.
- An unknown subcommand in either shim (`auto-fix-all` or `auto-fix-issue`) exits non-zero with a usage error instead of falling through to shell.

## Solution
Follow the existing `auto-fix-issue/scripts/github.sh` pattern. Steps 1–5 are owned by **scripter**; step 6 by **node**.
1. Move the current bash body of `auto-fix-all/scripts/github.sh` unchanged into `auto-fix-all/scripts/github_shell.sh`, including its `GH_INSECURE_SKIP_VERIFY=true` export (kept shell-side only, matching `auto-fix-issue/scripts/github_shell.sh`; native doesn't use it today).
2. Add one-line per-subcommand wrappers `github_shell_<subcommand>.sh` (`exec bash github_shell.sh <subcommand> "$@"`), like `auto-fix-issue/scripts/github_shell_info.sh`.
3. Rewrite `auto-fix-all/scripts/github.sh` as a `case` shim: one `engine_dispatch "$REPO_PATH" auto-fix-all-github-<subcommand> "${SCRIPT_DIR}/github_shell_<subcommand>.sh" HOME -- "${@:2}"` per subcommand (`HOME` forwarded for `gh` auth, like the other GitHub shims), and an `*)` branch that prints usage to stderr and exits 1.
4. Remove the shell-only catch-all in `auto-fix-issue/scripts/github.sh` the same way (usage error, exit 1).
5. In `arcanum/_lib/migration-status.json`, replace `"auto-fix-all-github"` with the 7 `auto-fix-all-github-*` keys set to `true`, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh` (never by hand). #655 later removes the map and the doc entirely, but dispatch needs these keys until then.

6. **node:** rewrite `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js`. Today it uses the whole-script key `auto-fix-all-github` and asserts that native mode ends in `unknown command`. Point it at the real per-subcommand keys (e.g. `auto-fix-all-github-pr-state`) and assert that native mode reaches `core/bin/arcanum` successfully. Drop the "future shim… out of scope" header note.

No skill markdown changes: the call sites (`scripts/github.sh <subcommand> ...`) keep the same signature. No `core/lib` changes.

### Testing
- The existing parity specs in `core/spec/bin/autoFixAllGithubParity/` (one per subcommand, plus `engine_dispatch_spec.js`) pass, with `engine_dispatch_spec.js` rewritten as in step 6.
- A manual or scripted check: with `engine.mode=native` and `engine.log.location` set, `auto-fix-all/scripts/github.sh pr-state "$REPO_PATH"` logs a `core/bin/arcanum` invocation.
- An unknown subcommand in both shims exits 1 with a usage message.

### Out of scope
- Removing `migration-status.json`, the status doc, or any migration wording (#655).
- Changing native behaviour (`core/lib`) or the `GH_INSECURE_SKIP_VERIFY` handling on the native side.

## Benefits
- `engine.mode=native` actually covers all of `auto-fix-all`'s GitHub calls.
- The migration status becomes truthful, which unblocks #655.
- No shim can silently bypass the native engine anymore.
