# Scripter Plan: Create-issue: native command

Main plan: [plan.md](plan.md)

## Shared contracts

- Shim signatures, `engine_dispatch --native-only` calls and pass-through output/exit codes:
  see [plan.md](plan.md#shims-arcanum-create-issuescripts). Command names
  `arcanum-create-issue-start` and `arcanum-create-issue-publish` are registered by `node`.

## Implementation Steps

### Step 1 — Add `arcanum-create-issue/scripts/start.sh`

Thin native-only shim modeled on `arcanum-check-config/scripts/check_config.sh`: header comment
pointing at the spec and this plan, usage check (`<repo_path>` required), then
`engine_dispatch "$REPO_PATH" arcanum-create-issue-start "" --native-only <env vars> -- "$@"`.
No `*_shell.sh` twin. Executable bit set.

### Step 2 — Add `arcanum-create-issue/scripts/publish.sh`

Same shape for `arcanum-create-issue-publish`. Usage check requires `<repo_path>`, `<draft>`
and `<title>`; flags and labels are forwarded verbatim (the native command does the rest of the
validation and returns exit `2` itself).

## Files to Change

- `arcanum-create-issue/scripts/start.sh` — new shim
- `arcanum-create-issue/scripts/publish.sh` — new shim

## CI Checks

- shellcheck on the new scripts (same as CI's shell lint job).

## Notes

- The skill folder `arcanum-create-issue/` has no `SKILL.md` yet (that is #691); only the
  `scripts/` folder is created here.
- Confirm with `node` the exact env-var allowlist the native GitHub calls need (e.g. `HOME`,
  `GH_TOKEN`/`GITHUB_TOKEN`, `GH_CONFIG_DIR`) — mirror what existing native GitHub-calling shims
  forward.
